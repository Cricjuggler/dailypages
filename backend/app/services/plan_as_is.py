"""Build a reading plan from raw chapter text, no AI in the loop.

For each non-frontmatter chapter we synthesize the same typed prose-block
shape the AI rewriter produces, so the Reader doesn't care which path
produced the content.
"""
from __future__ import annotations

import logging
import math
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session as ORMSession

from app.models import Book, Chapter, Depth, Pace, ReadingPlan, Session
from app.services.chapter_filter import filter_real_chapters

log = logging.getLogger(__name__)

# Rough reading speed: ~250 words/min, ~1250 chars/min for typical English prose.
CHARS_PER_MINUTE = 1250

# Insert a visual divider every N paragraphs to break up long chapters.
SECTION_MARK_EVERY = 8

_PACE_MUL = {"sprint": 1.0, "steady": 7 / 5, "gentle": 7 / 3}


def _estimate_minutes(text: str) -> int:
    return max(1, math.ceil(len(text) / CHARS_PER_MINUTE))


def _chapter_to_blocks(
    *, chapter: Chapter, session_number: int, total_sessions: int, author: str
) -> list[dict]:
    """Wrap one chapter's raw paragraphs in the reader's prose-block JSON."""
    body = (chapter.raw_content or "").strip()
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    minutes = _estimate_minutes(body)

    blocks: list[dict] = [
        {
            "kind": "intro",
            "eyebrow": f"Session {session_number} of {total_sessions}",
            "title": chapter.title,
            "meta": f"{author} · {chapter.title} · ~{minutes} min".strip(" ·"),
        }
    ]
    for i, p in enumerate(paragraphs):
        block: dict = {"kind": "p", "text": p}
        if i == 0:
            block["dropcap"] = True
        blocks.append(block)
        # Visual rhythm: a divider every N paragraphs, but not as the last block.
        if (i + 1) % SECTION_MARK_EVERY == 0 and i < len(paragraphs) - 1:
            blocks.append({"kind": "section-mark", "text": "·  ·  ·"})

    blocks.append({"kind": "outro"})
    return blocks


def build_plan_as_is(
    *,
    book_id: UUID,
    user_id: UUID,
    minutes_per_session: int,
    pace: Pace,
    db: ORMSession,
) -> ReadingPlan:
    """Create a ReadingPlan + Session rows from the book's parsed chapters.

    No AI calls. One real chapter = one session. The reader gets the
    author's exact words wrapped in the prose-block shape.
    """
    book = db.execute(select(Book).where(Book.id == book_id)).scalar_one_or_none()
    if book is None:
        raise ValueError(f"Book {book_id} not found")
    if book.user_id != user_id:
        raise ValueError("Book not owned by this user")

    all_chapters = (
        db.execute(
            select(Chapter).where(Chapter.book_id == book_id).order_by(Chapter.ordinal.asc())
        )
        .scalars()
        .all()
    )
    real_chapters = filter_real_chapters(
        all_chapters, lambda c: c.title, lambda c: c.raw_content
    )
    if not real_chapters:
        raise ValueError("No real chapters to build a plan from")

    total_sessions = len(real_chapters)
    days = max(total_sessions, round(total_sessions * _PACE_MUL[pace.value]))

    # Depth is recorded as 'quick' for as-is plans — the reader doesn't actually
    # see depth anywhere, and 'quick' is the closest semantic match for "tight,
    # original prose, no embellishment". Could become its own enum value later.
    plan = ReadingPlan(
        user_id=user_id,
        book_id=book_id,
        minutes_per_session=minutes_per_session,
        total_sessions=total_sessions,
        total_days=days,
        depth=Depth.quick,
        pace=pace,
    )
    db.add(plan)
    db.flush()

    # Wipe any previous sessions for idempotency on re-run.
    db.execute(delete(Session).where(Session.reading_plan_id == plan.id))

    author = (book.author or "").strip()
    for i, chap in enumerate(real_chapters, start=1):
        body = chap.raw_content or ""
        blocks = _chapter_to_blocks(
            chapter=chap, session_number=i, total_sessions=total_sessions, author=author
        )
        db.add(
            Session(
                reading_plan_id=plan.id,
                session_number=i,
                title=chap.title[:500],
                chapter=chap.title[:255],
                estimated_minutes=_estimate_minutes(body),
                content_blocks=blocks,
                recap=None,
                quiz=None,
            )
        )

    db.commit()
    db.refresh(plan)
    log.info(
        "plan-as-is built for book %s: %d sessions, %d days", book_id, total_sessions, days
    )
    return plan
