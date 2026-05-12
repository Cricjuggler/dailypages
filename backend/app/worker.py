"""Celery app + sync DB session — workers run with synchronous SQLAlchemy.

The web app uses asyncpg; workers use psycopg2-binary so we keep the dialect
compatible. The worker URL is derived from DATABASE_URL by stripping the
+asyncpg driver suffix.
"""
from __future__ import annotations

from celery import Celery
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings

_settings = get_settings()


def _to_sync_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql+psycopg2://" + url[len("postgresql+asyncpg://") :]
    return url


sync_engine = create_engine(_to_sync_url(_settings.database_url), pool_pre_ping=True, future=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, expire_on_commit=False)

celery_app = Celery(
    "dailypages",
    broker=_settings.celery_broker_url,
    backend=_settings.celery_result_backend,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=30,
    broker_connection_retry_on_startup=True,
)
