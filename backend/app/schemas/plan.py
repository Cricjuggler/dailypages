from uuid import UUID

from pydantic import BaseModel, Field

from app.models.plan import Depth, Pace
from app.schemas.common import TimestampedOut


class PlanCreate(BaseModel):
    book_id: UUID
    minutes_per_session: int = Field(ge=5, le=120)
    target_sessions: int = Field(ge=5, le=120, description="How many sittings the user wants")
    depth: Depth = Depth.balanced
    pace: Pace = Pace.steady


class PlanOut(TimestampedOut):
    user_id: UUID
    book_id: UUID
    minutes_per_session: int
    total_sessions: int
    total_days: int
    depth: Depth
    pace: Pace


class SessionSummary(BaseModel):
    id: UUID
    session_number: int
    title: str
    chapter: str | None = None
    estimated_minutes: int


class PlanWithSessions(PlanOut):
    sessions: list[SessionSummary] = []
