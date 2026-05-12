"""Celery tasks. Keep these thin — push real work into app.services.*."""
from __future__ import annotations

import logging
from uuid import UUID

from app.config import get_settings
from app.services.analysis import analyze_book_sync
from app.services.parsing import parse_book_sync
from app.services.session_gen import generate_sessions_sync
from app.worker import SyncSessionLocal, celery_app

log = logging.getLogger(__name__)


@celery_app.task(bind=True, name="parse_book", autoretry_for=(Exception,), max_retries=2)
def parse_book(self, book_id: str) -> dict:
    """Parse a book. On success, chains analyze_book if AI providers are configured."""
    settings = get_settings()
    book_uuid = UUID(book_id)
    with SyncSessionLocal() as db:
        parse_book_sync(book_uuid, db, settings.r2_bucket)

    if settings.claude_configured and settings.embeddings_configured:
        analyze_book.delay(book_id)
    else:
        log.info(
            "Skipping AI analysis for book %s — Claude and/or Voyage not configured",
            book_id,
        )
    return {"book_id": book_id, "ok": True}


@celery_app.task(bind=True, name="analyze_book", autoretry_for=(Exception,), max_retries=2)
def analyze_book(self, book_id: str) -> dict:
    """Run embeddings + concept extraction + style profile."""
    settings = get_settings()
    if not (settings.claude_configured and settings.embeddings_configured):
        log.info("analyze_book: AI providers not configured, skipping %s", book_id)
        return {"book_id": book_id, "skipped": True}

    book_uuid = UUID(book_id)
    with SyncSessionLocal() as db:
        analyze_book_sync(book_uuid, db)
    return {"book_id": book_id, "ok": True}


@celery_app.task(bind=True, name="generate_sessions", autoretry_for=(Exception,), max_retries=1)
def generate_sessions(self, plan_id: str) -> dict:
    """Generate Session rows (rewrite + quiz) for a ReadingPlan."""
    settings = get_settings()
    if not settings.claude_configured:
        log.info("generate_sessions: Claude not configured, skipping %s", plan_id)
        return {"plan_id": plan_id, "skipped": True}
    plan_uuid = UUID(plan_id)
    with SyncSessionLocal() as db:
        generate_sessions_sync(plan_uuid, db)
    return {"plan_id": plan_id, "ok": True}
