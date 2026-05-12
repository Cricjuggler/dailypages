from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(
    db: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> dict:
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "db": db_ok,
        "auth_configured": settings.auth_configured,
        "storage_configured": settings.storage_configured,
        "claude_configured": settings.claude_configured,
        "embeddings_configured": settings.embeddings_configured,
        "environment": settings.environment,
    }
