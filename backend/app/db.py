"""Async SQLAlchemy engine + session factory.

Includes a URL-normalizer that maps Neon/libpq-style connection-string params
to asyncpg-friendly ones. Most managed Postgres providers (Neon, Supabase,
Railway) hand you a URL with `?sslmode=require&channel_binding=require` — both
keywords asyncpg rejects. Rather than tell every operator to hand-edit, we
clean them here.
"""
from collections.abc import AsyncIterator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

# libpq-style params that need to become asyncpg-style (or be dropped).
# `channel_binding` has no asyncpg equivalent; modern Postgres negotiates it
# automatically when SSL is on.
_LIBPQ_TO_ASYNCPG = {
    "sslmode": "ssl",
    "sslcert": None,        # asyncpg uses ssl.SSLContext for these; drop here.
    "sslkey": None,
    "sslrootcert": None,
    "channel_binding": None,
}


def normalize_db_url(url: str) -> str:
    if "+asyncpg" not in url:
        return url
    parts = urlsplit(url)
    if not parts.query:
        return url
    pairs = parse_qsl(parts.query, keep_blank_values=True)
    cleaned: list[tuple[str, str]] = []
    for key, val in pairs:
        if key in _LIBPQ_TO_ASYNCPG:
            replacement = _LIBPQ_TO_ASYNCPG[key]
            if replacement is None:
                continue  # drop it
            cleaned.append((replacement, val))
        else:
            cleaned.append((key, val))
    return urlunsplit(parts._replace(query=urlencode(cleaned)))


_settings = get_settings()

engine = create_async_engine(
    normalize_db_url(_settings.database_url),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    future=True,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
