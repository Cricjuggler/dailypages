"""Orchestrates the analysis pass that runs after parsing.

For each "real" chapter (front-matter dropped via chapter_filter):
- Voyage embedding
- Claude concept extraction + complexity + importance scoring

For the book as a whole: a one-shot Claude call for the style profile,
sampled from a handful of mid-length chapters (not the first few, which
are often introductions and don't reflect the body's voice).
"""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session as ORMSession

from app.ai.agents.semantic import analyze_chapters
from app.ai.agents.style import analyze_style
from app.models import Book, Chapter
from app.services.chapter_filter import filter_real_chapters

log = logging.getLogger(__name__)


def analyze_book_sync(book_id: UUID, db: ORMSession) -> None:
    book = db.execute(select(Book).where(Book.id == book_id)).scalar_one_or_none()
    if book is None:
        log.warning("analyze_book_sync: book %s not found", book_id)
        return

    all_chapters = (
        db.execute(
            select(Chapter).where(Chapter.book_id == book_id).order_by(Chapter.ordinal.asc())
        )
        .scalars()
        .all()
    )
    if not all_chapters:
        log.warning("analyze_book_sync: book %s has no chapters yet", book_id)
        return

    real_chapters = filter_real_chapters(
        all_chapters, lambda c: c.title, lambda c: c.raw_content
    )
    log.info(
        "analyze_book %s: %d chapters total, %d real after front-matter filter",
        book_id, len(all_chapters), len(real_chapters)
    )
    if not real_chapters:
        log.warning("analyze_book_sync: %s — no real chapters after filtering", book_id)
        return

    book_meta = {"title": book.title, "author": book.author}

    # Sample for style: 3 chapters from the middle of the book, not the
    # first one (often an introduction that doesn't reflect the body voice).
    mid = len(real_chapters) // 2
    style_sample = [
        c.raw_content for c in real_chapters[max(1, mid - 1) : mid + 2] if c.raw_content
    ]
    try:
        style_profile = analyze_style(style_sample, book_meta)
        book.style_profile = style_profile
        db.commit()
        log.info("Style profile saved for %s", book_id)
    except Exception as e:
        log.exception("Style analysis failed for %s: %s", book_id, e)

    # Per-chapter analysis — cap at 30 to bound cost on books with many
    # chapters. The planner only needs metadata for the rest.
    to_analyze = real_chapters[:30]
    texts = [c.raw_content or "" for c in to_analyze]
    try:
        analyses = analyze_chapters(texts, book_meta)
    except Exception:
        log.exception("Chapter analysis failed for %s", book_id)
        return

    for chapter, analysis in zip(to_analyze, analyses, strict=False):
        chapter.embedding = analysis.embedding
        chapter.concepts = analysis.concepts
        chapter.complexity_score = analysis.complexity
        chapter.importance_score = analysis.importance
    db.commit()
    log.info("Analyzed book %s — %d chapters embedded", book_id, len(to_analyze))
