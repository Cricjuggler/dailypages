"""PDF text + outline extraction.

Strategy:
1. pypdf gives us metadata, page count, and the document outline (TOC bookmarks).
2. pdfminer.six is the workhorse for text extraction — generally cleaner than pypdf
   for narrative prose.
3. If the PDF has a usable outline, we slice text by outline page ranges to produce
   chapters. If not, we hand off to chapter_detector for heuristic detection.

We deliberately avoid PyMuPDF — its C dependency makes the build path brittle on
Windows. pypdf + pdfminer is pure Python and adequate for the MVP.
"""
from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass

from pdfminer.high_level import extract_text
from pypdf import PdfReader

from app.services.chapter_detector import detect_chapters_from_text
from app.services.extracted import ExtractedBook, ExtractedChapter

log = logging.getLogger(__name__)

_WHITESPACE = re.compile(r"[ \t]+")
_MULTI_NEWLINE = re.compile(r"\n{3,}")


def _clean(s: str) -> str:
    s = _WHITESPACE.sub(" ", s)
    s = _MULTI_NEWLINE.sub("\n\n", s)
    return s.strip()


@dataclass
class _OutlineEntry:
    title: str
    page_index: int  # 0-based


def _flatten_outline(reader: PdfReader, items, depth: int = 0, out: list[_OutlineEntry] | None = None) -> list[_OutlineEntry]:
    if out is None:
        out = []
    for item in items:
        if isinstance(item, list):
            _flatten_outline(reader, item, depth + 1, out)
            continue
        try:
            page_index = reader.get_destination_page_number(item)
        except Exception:
            continue
        title = (item.title or "").strip()
        if title and depth <= 1:
            out.append(_OutlineEntry(title=title, page_index=page_index))
    return out


def _extract_pages_text(data: bytes, start: int, end: int) -> str:
    page_numbers = list(range(start, end))
    if not page_numbers:
        return ""
    try:
        return _clean(extract_text(io.BytesIO(data), page_numbers=page_numbers) or "")
    except Exception as e:
        log.warning("pdfminer page extraction failed (pages %s-%s): %s", start, end, e)
        return ""


def extract_pdf(data: bytes) -> ExtractedBook:
    """Extract chapters from a PDF byte buffer."""
    reader = PdfReader(io.BytesIO(data))
    info = reader.metadata or {}
    title = (info.get("/Title") or "").strip() or None
    author = (info.get("/Author") or "").strip() or None
    pages = len(reader.pages)

    book = ExtractedBook(title=title, author=author, pages=pages)

    # Try outline-based slicing first.
    outline_entries: list[_OutlineEntry] = []
    try:
        if reader.outline:
            outline_entries = _flatten_outline(reader, reader.outline)
    except Exception as e:
        log.info("Outline traversal failed: %s — falling back to heuristic detection", e)

    # Deduplicate by page_index, sorted ascending.
    outline_entries.sort(key=lambda e: e.page_index)
    seen: set[int] = set()
    deduped = []
    for e in outline_entries:
        if e.page_index in seen:
            continue
        seen.add(e.page_index)
        deduped.append(e)

    if len(deduped) >= 3:  # require at least a few entries to trust the outline
        for i, entry in enumerate(deduped):
            start = entry.page_index
            end = deduped[i + 1].page_index if i + 1 < len(deduped) else pages
            content = _extract_pages_text(data, start, end)
            if not content:
                continue
            book.chapters.append(
                ExtractedChapter(ordinal=i + 1, title=entry.title, content=content)
            )
        if book.chapters:
            return book

    # No usable outline — extract everything and run heuristics.
    full_text = _extract_pages_text(data, 0, pages)
    book.chapters = detect_chapters_from_text(full_text)
    return book
