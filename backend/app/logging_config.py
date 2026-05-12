"""Structured logging — plain text for local, JSON for production."""
from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from app.config import get_settings


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        for k in ("request_id", "user_id", "book_id", "plan_id", "session_id"):
            if hasattr(record, k):
                payload[k] = getattr(record, k)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    settings = get_settings()
    root = logging.getLogger()
    # Strip handlers that uvicorn / celery may have installed first.
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    if settings.environment == "production":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-5s [%(name)s] %(message)s", "%H:%M:%S")
        )
    root.addHandler(handler)
    root.setLevel(settings.log_level.upper())

    # Quiet down chatty libraries
    for noisy in ("httpx", "botocore", "boto3", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
