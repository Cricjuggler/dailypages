"""End-to-end book-parsing service.

Downloads the source object from R2, dispatches to PDF or EPUB extractor,
persists chapter rows, and updates the book's status. Called by the
Celery task in app.tasks.
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session as ORMSession

from app.models import Book, BookStatus, Chapter
from app.services.epub_extractor import extract_epub
from app.services.extracted import ExtractedBook
from app.services.pdf_extractor import extract_pdf
from app.storage import get_s3_client

log = logging.getLogger(__name__)

_PDF_TYPES = {"application/pdf"}
_EPUB_TYPES = {"application/epub+zip"}


def _scrub(s: str | None) -> str | None:
    """Postgres `text` columns reject NUL (0x00) bytes — strip them and other
    C0 control chars that occasionally leak from PDF text streams.
    """
    if s is None:
        return None
    # Drop NUL outright.
    s = s.replace("\x00", "")
    # Drop other C0 controls except \t, \n, \r.
    return "".join(
        ch for ch in s if ch in "\t\n\r" or ord(ch) >= 0x20
    )


def _download_source(storage_key: str, bucket: str) -> bytes:
    client = get_s3_client()
    if client is None:
        raise RuntimeError("R2 not configured")
    response = client.get_object(Bucket=bucket, Key=storage_key)
    return response["Body"].read()


def _dispatch(content_type: str, data: bytes) -> ExtractedBook:
    if content_type in _PDF_TYPES:
        return extract_pdf(data)
    if content_type in _EPUB_TYPES:
        return extract_epub(data)
    raise ValueError(f"Unsupported content type for parsing: {content_type}")


def parse_book_sync(book_id: UUID, db: ORMSession, bucket: str) -> None:
    """Synchronous worker entry point — uses the sync SQLAlchemy session.

    The Celery worker uses sync sessions because that's what Celery expects;
    the FastAPI app stays async.
    """
    book = db.execute(select(Book).where(Book.id == book_id)).scalar_one_or_none()
    if book is None:
        log.warning("parse_book_sync: book %s not found", book_id)
        return
    if not book.storage_key:
        log.warning("parse_book_sync: book %s has no storage_key", book_id)
        book.status = BookStatus.failed
        book.error_message = "No source file to parse"
        db.commit()
        return

    book.status = BookStatus.parsing
    book.error_message = None
    db.commit()

    try:
        data = _download_source(book.storage_key, bucket)
        extracted = _dispatch(book.content_type or "application/pdf", data)

        # Prefer the PDF/EPUB metadata title over the filename-derived one when
        # available — filenames often carry repository tags like "(z-lib.org)".
        extracted_title = _scrub(extracted.title) if extracted.title else None
        if extracted_title and extracted_title.strip():
            book.title = extracted_title.strip()
        if extracted.author and not book.author:
            book.author = _scrub(extracted.author)
        if extracted.pages and not book.pages:
            book.pages = extracted.pages

        # Replace any existing chapter rows for this book (idempotent re-parses).
        db.execute(delete(Chapter).where(Chapter.book_id == book.id))
        for ch in extracted.chapters:
            db.add(
                Chapter(
                    book_id=book.id,
                    ordinal=ch.ordinal,
                    title=(_scrub(ch.title) or "")[:500],
                    raw_content=_scrub(ch.content),
                )
            )

        if not extracted.chapters:
            raise RuntimeError("No chapters extracted")

        book.status = BookStatus.ready
        db.commit()
        log.info(
            "Parsed book %s — %d chapters, %s pages",
            book.id,
            len(extracted.chapters),
            book.pages,
        )
    except Exception as e:
        log.exception("Parsing failed for book %s", book_id)
        db.rollback()
        # Re-fetch since rollback expires our objects.
        book = db.execute(select(Book).where(Book.id == book_id)).scalar_one()
        book.status = BookStatus.failed
        book.error_message = str(e)[:500]
        db.commit()
