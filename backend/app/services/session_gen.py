"""Generate Session rows for a ReadingPlan: planner → rewriter → quiz."""
from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session as ORMSession

from app.ai.agents.planner import ChapterMeta, plan_sessions
from app.ai.agents.rewriter import rewrite_session
from app.models import Book, Chapter, ReadingPlan, Session
from app.services.chapter_filter import filter_real_chapters

log = logging.getLogger(__name__)


def _slice_text(chapter: Chapter, start_para: int, end_para: int) -> str:
    body = chapter.raw_content or ""
    if not body:
        return ""
    paras = [p for p in body.split("\n\n") if p.strip()]
    if end_para < 0 or end_para > len(paras):
        end_para = len(paras)
    if start_para < 0:
        start_para = 0
    return "\n\n".join(paras[start_para:end_para]).strip()


def generate_sessions_sync(plan_id: UUID, db: ORMSession) -> None:
    plan = db.execute(select(ReadingPlan).where(ReadingPlan.id == plan_id)).scalar_one_or_none()
    if plan is None:
        log.warning("generate_sessions_sync: plan %s not found", plan_id)
        return

    book = db.get(Book, plan.book_id)
    if book is None:
        return

    all_chapters = (
        db.execute(
            select(Chapter).where(Chapter.book_id == plan.book_id).order_by(Chapter.ordinal.asc())
        )
        .scalars()
        .all()
    )
    if not all_chapters:
        log.warning("generate_sessions_sync: plan %s has no chapters", plan_id)
        return

    # Drop front-matter (Cover, Copyright, Contents, etc.) and very short
    # entries before handing to the planner — they pollute the input and
    # blow past the output token cap.
    chapters = filter_real_chapters(
        all_chapters, lambda c: c.title, lambda c: c.raw_content
    )
    log.info(
        "generate_sessions plan %s: %d chapters total, %d real after filter",
        plan_id, len(all_chapters), len(chapters)
    )
    if not chapters:
        log.warning("generate_sessions_sync: plan %s — no real chapters after filter", plan_id)
        return

    chapters_by_ordinal = {c.ordinal: c for c in chapters}

    # Estimate length via raw_content / 1000 chars ≈ 4 minutes (rough).
    chapter_metas: list[ChapterMeta] = []
    for c in chapters:
        body_len = len(c.raw_content or "")
        minutes = max(1, round(body_len / 1000 * 4))
        chapter_metas.append(
            ChapterMeta(
                ordinal=c.ordinal,
                title=c.title,
                length_minutes=minutes,
                complexity=c.complexity_score or 0.5,
            )
        )

    boundaries = plan_sessions(
        chapter_metas,
        target_sessions=plan.total_sessions,
        minutes_per_session=plan.minutes_per_session,
        pace=plan.pace.value,
        depth=plan.depth.value,
    )

    # Replace any prior sessions for idempotent regenerations.
    db.execute(delete(Session).where(Session.reading_plan_id == plan.id))
    db.commit()

    book_meta = {"title": book.title, "author": book.author}

    for boundary in boundaries:
        # Stitch source text from the indicated chapter ranges.
        parts: list[str] = []
        for r in boundary.source_ranges:
            ord_ = r.get("chapter_ordinal")
            if ord_ is None:
                continue
            chap = chapters_by_ordinal.get(int(ord_))
            if chap is None:
                continue
            parts.append(
                _slice_text(
                    chap,
                    int(r.get("start_paragraph", 0)),
                    int(r.get("end_paragraph", -1)),
                )
            )
        source_text = "\n\n".join(p for p in parts if p)
        if not source_text:
            continue

        try:
            blocks = rewrite_session(
                source_text=source_text,
                style_profile=book.style_profile or {},
                book_meta=book_meta,
                session_number=boundary.session_number,
                sessions_total=plan.total_sessions,
                chapter_label=boundary.chapter_label,
                estimated_minutes=boundary.estimated_minutes,
                depth=plan.depth.value,
            )
        except Exception:
            log.exception("Rewrite failed for session %s", boundary.session_number)
            continue

        # Quiz + recap dropped from the product — sessions are just paced reads.
        db.add(
            Session(
                reading_plan_id=plan.id,
                session_number=boundary.session_number,
                title=boundary.title[:500],
                chapter=boundary.chapter_label[:255] if boundary.chapter_label else None,
                estimated_minutes=boundary.estimated_minutes,
                content_blocks=blocks,
                recap=None,
                quiz=None,
            )
        )
        db.commit()

    log.info("Generated %d sessions for plan %s", len(boundaries), plan_id)
