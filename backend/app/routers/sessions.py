import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.db import get_session
from app.models import Book, ReadingPlan, Session, User, UserProgress
from app.rate_limit import enforce as enforce_rate_limit
from app.schemas.session import ProgressOut, ProgressUpdate, SessionOut

router = APIRouter(prefix="/sessions", tags=["sessions"])


class ExplainRequest(BaseModel):
    paragraph: str = Field(min_length=1, max_length=4000)
    intent: str | None = Field(default=None, max_length=120)


async def _ensure_owns_session(
    session_id: uuid.UUID, user: User, db: AsyncSession
) -> Session:
    session = await db.get(Session, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    plan = await db.get(ReadingPlan, session.reading_plan_id)
    if plan is None or plan.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/{session_id}", response_model=SessionOut)
async def get_session_detail(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> Session:
    return await _ensure_owns_session(session_id, user, db)


@router.put("/{session_id}/progress", response_model=ProgressOut)
async def update_progress(
    session_id: uuid.UUID,
    payload: ProgressUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UserProgress:
    await _ensure_owns_session(session_id, user, db)

    result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == user.id)
        .where(UserProgress.session_id == session_id)
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        progress = UserProgress(user_id=user.id, session_id=session_id)
        db.add(progress)

    progress.completion_percentage = payload.completion_percentage
    progress.last_read_position = payload.last_read_position
    progress.elapsed_sec = payload.elapsed_sec
    if payload.highlights is not None:
        progress.highlights = payload.highlights
    await db.commit()
    await db.refresh(progress)
    return progress


@router.post("/{session_id}/explain")
async def explain_passage(
    session_id: uuid.UUID,
    payload: ExplainRequest,
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Server-sent-events stream of an explanation for a clicked paragraph."""
    if not settings.claude_configured:
        raise HTTPException(status_code=503, detail="Claude not configured")

    enforce_rate_limit(key=f"explain:{user.id}", limit=20, window_sec=60)

    session_row = await _ensure_owns_session(session_id, user, db)
    plan = await db.get(ReadingPlan, session_row.reading_plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    book = await db.get(Book, plan.book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")

    from app.ai.explain import stream_explanation

    async def event_stream():
        try:
            async for chunk in stream_explanation(
                paragraph=payload.paragraph,
                book_title=book.title,
                book_author=book.author,
                chapter=session_row.chapter,
                intent=payload.intent,
            ):
                # SSE frame — `data:` prefix, blank line terminator. Newlines in the
                # chunk get escaped so each event stays on one line.
                escaped = chunk.replace("\r", "").replace("\n", "\\n")
                yield f"data: {escaped}\n\n"
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)[:200]}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering for streaming
        },
    )


@router.post("/{session_id}/complete", response_model=ProgressOut, status_code=status.HTTP_200_OK)
async def complete_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> UserProgress:
    await _ensure_owns_session(session_id, user, db)

    result = await db.execute(
        select(UserProgress)
        .where(UserProgress.user_id == user.id)
        .where(UserProgress.session_id == session_id)
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        progress = UserProgress(user_id=user.id, session_id=session_id)
        db.add(progress)

    progress.completed = True
    progress.completion_percentage = 1.0
    await db.commit()
    await db.refresh(progress)
    return progress
