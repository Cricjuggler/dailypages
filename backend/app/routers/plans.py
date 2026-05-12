import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.db import get_session
from app.models import Book, BookStatus, ReadingPlan, Session, User
from app.schemas.plan import PlanCreate, PlanOut, PlanWithSessions, SessionSummary

router = APIRouter(prefix="/plans", tags=["plans"])

# Pace controls calendar (days between sessions), not session count.
# Sprint = daily, Steady = 5 days/wk, Gentle = 3 days/wk.
_PACE_MUL = {"sprint": 1.0, "steady": 7 / 5, "gentle": 7 / 3}


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    payload: PlanCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> ReadingPlan:
    """Create a plan with the user's chosen session count.

    Session count is now a direct user input, not derived from page length
    × depth. Depth still controls how dense each session is (see rewriter).
    The book only needs `status=ready`; page count is no longer required.
    """
    book = await db.get(Book, payload.book_id)
    if book is None or book.user_id != user.id:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.status != BookStatus.ready:
        raise HTTPException(
            status_code=409, detail=f"Book is not ready ({book.status}); finish processing first"
        )

    sessions = payload.target_sessions
    days = max(sessions, round(sessions * _PACE_MUL[payload.pace.value]))

    plan = ReadingPlan(
        user_id=user.id,
        book_id=book.id,
        minutes_per_session=payload.minutes_per_session,
        total_sessions=sessions,
        total_days=days,
        depth=payload.depth,
        pace=payload.pace,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.get("", response_model=list[PlanOut])
async def list_plans_for_book(
    book_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> list[ReadingPlan]:
    """List the current user's plans for a given book, newest first.

    Used by the frontend Library page to find a book's most recent plan
    so we can route the "open book" CTA without an extra hop.
    """
    result = await db.execute(
        select(ReadingPlan)
        .where(ReadingPlan.user_id == user.id)
        .where(ReadingPlan.book_id == book_id)
        .order_by(ReadingPlan.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{plan_id}", response_model=PlanWithSessions)
async def get_plan(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> PlanWithSessions:
    plan = await db.get(ReadingPlan, plan_id)
    if plan is None or plan.user_id != user.id:
        raise HTTPException(status_code=404, detail="Plan not found")

    result = await db.execute(
        select(Session)
        .where(Session.reading_plan_id == plan.id)
        .order_by(Session.session_number.asc())
    )
    sessions = result.scalars().all()

    return PlanWithSessions(
        **PlanOut.model_validate(plan).model_dump(),
        sessions=[SessionSummary.model_validate(s, from_attributes=True) for s in sessions],
    )


@router.post("/{plan_id}/generate", response_model=PlanOut, status_code=status.HTTP_202_ACCEPTED)
async def generate_plan_sessions(
    plan_id: uuid.UUID,
    user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    db: AsyncSession = Depends(get_session),
) -> ReadingPlan:
    """Queue an async job that produces Session rows for this plan.

    Runs the planner → rewriter → quiz pipeline. Idempotent — re-running
    replaces existing sessions for this plan.
    """
    plan = await db.get(ReadingPlan, plan_id)
    if plan is None or plan.user_id != user.id:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not settings.claude_configured:
        raise HTTPException(
            status_code=503,
            detail="Claude not configured (set ANTHROPIC_API_KEY)",
        )

    from app.tasks import generate_sessions as generate_sessions_task

    generate_sessions_task.delay(str(plan.id))
    return plan
