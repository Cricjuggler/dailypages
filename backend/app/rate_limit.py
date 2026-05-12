"""Simple Redis-backed sliding-window rate limiter for AI endpoints.

Falls back to a no-op when Redis isn't reachable so dev environments keep
working without a Redis dep. Real production setups should use a proper
limiter (e.g. slowapi) — this is intentionally minimal.
"""
from __future__ import annotations

import logging
import time
from functools import lru_cache

import redis
from fastapi import HTTPException, status

from app.config import get_settings

log = logging.getLogger(__name__)


@lru_cache
def _redis_client() -> redis.Redis | None:
    settings = get_settings()
    try:
        client = redis.Redis.from_url(settings.celery_broker_url, decode_responses=True)
        client.ping()
        return client
    except Exception as e:
        log.warning("Rate limiter disabled — Redis unavailable: %s", e)
        return None


def enforce(*, key: str, limit: int, window_sec: int) -> None:
    """Token-bucket-ish: count requests in the last `window_sec` seconds.

    Raises 429 when over `limit`. Caller passes a stable key like
    `f"ai:{user.id}:{endpoint}"`.
    """
    client = _redis_client()
    if client is None:
        return  # fail-open in environments without Redis

    now = int(time.time())
    bucket = f"rl:{key}:{now // window_sec}"
    try:
        count = client.incr(bucket)
        if count == 1:
            client.expire(bucket, window_sec + 5)
    except redis.RedisError as e:
        log.warning("Rate limit check failed: %s — fail-open", e)
        return
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({limit} requests / {window_sec}s)",
        )
