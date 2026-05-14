from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.db import get_session
from app.models import Session as SessionModel
from app.models import User, UserProgress
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


class WeeklyEntry(BaseModel):
    day: str  # "Mon", "Tue", ...
    min: int


class HeatmapDay(BaseModel):
    date: str  # ISO yyyy-mm-dd
    state: str  # "miss" | "light" | "read" | "today"


class MyStats(BaseModel):
    current_streak: int
    best_streak: int
    books_finished: int
    minutes_this_week: int
    minutes_goal_week: int
    avg_session: int
    completed_sessions: int
    weekly: list[WeeklyEntry]
    days_heatmap: list[HeatmapDay]


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    """Verify the bearer token and return the local user row (creating it if first sight)."""
    return user


@router.get("/me/stats", response_model=MyStats)
async def my_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> MyStats:
    """Aggregate stats for the Progress tab. All math done from user_progress
    + sessions; cheap enough to compute on every request.
    """
    # Pull all completed progress + each session's estimated minutes.
    rows = (
        await db.execute(
            select(
                UserProgress.session_id,
                UserProgress.updated_at,
                SessionModel.estimated_minutes,
            )
            .join(SessionModel, UserProgress.session_id == SessionModel.id)
            .where(UserProgress.user_id == user.id)
            .where(UserProgress.completed.is_(True))
        )
    ).all()

    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=today.weekday())  # Monday

    minutes_per_date: dict = {}
    for r in rows:
        d = r.updated_at.date()
        minutes_per_date[d] = minutes_per_date.get(d, 0) + (r.estimated_minutes or 0)

    completion_dates = sorted(minutes_per_date.keys())
    completion_set = set(completion_dates)

    # Current streak: consecutive days ending at today (allow ending yesterday
    # too so the streak doesn't break the moment midnight rolls over).
    current_streak = 0
    cursor = today
    if cursor not in completion_set and (today - timedelta(days=1)) in completion_set:
        cursor = today - timedelta(days=1)
    while cursor in completion_set:
        current_streak += 1
        cursor -= timedelta(days=1)

    # Best streak across history.
    best_streak = 0
    run = 0
    prev = None
    for d in completion_dates:
        if prev is None or (d - prev).days != 1:
            run = 1
        else:
            run += 1
        best_streak = max(best_streak, run)
        prev = d

    # Weekly bars (Mon..Sun of the current week).
    weekly: list[WeeklyEntry] = []
    for i in range(7):
        d = week_start + timedelta(days=i)
        weekly.append(WeeklyEntry(day=d.strftime("%a"), min=int(minutes_per_date.get(d, 0))))
    minutes_this_week = sum(w.min for w in weekly)

    # 70-day heatmap (oldest -> newest, today is the last cell).
    heatmap: list[HeatmapDay] = []
    for i in range(70):
        d = today - timedelta(days=69 - i)
        mins = minutes_per_date.get(d, 0)
        if d == today:
            state = "read" if mins > 0 else "today"
        elif mins >= 10:
            state = "read"
        elif mins > 0:
            state = "light"
        else:
            state = "miss"
        heatmap.append(HeatmapDay(date=d.isoformat(), state=state))

    avg = (
        int(round(sum(minutes_per_date.values()) / len(minutes_per_date)))
        if minutes_per_date
        else 0
    )

    # books_finished is approximate for now — requires plan/session aggregation
    # we'll add when the progress UX needs it. 0 keeps the UI honest.
    return MyStats(
        current_streak=current_streak,
        best_streak=best_streak,
        books_finished=0,
        minutes_this_week=minutes_this_week,
        minutes_goal_week=90,
        avg_session=avg,
        completed_sessions=len(rows),
        weekly=weekly,
        days_heatmap=heatmap,
    )
