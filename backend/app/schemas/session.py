from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import TimestampedOut


class SessionOut(TimestampedOut):
    reading_plan_id: UUID
    session_number: int
    title: str
    chapter: str | None = None
    estimated_minutes: int
    content_blocks: list[dict] | None = None
    recap: dict | None = None
    quiz: list[dict] | None = None


class ProgressUpdate(BaseModel):
    completion_percentage: float = Field(ge=0, le=1)
    last_read_position: int = Field(ge=0)
    elapsed_sec: int = Field(ge=0)
    highlights: list[int] | None = None


class ProgressOut(TimestampedOut):
    user_id: UUID
    session_id: UUID
    completion_percentage: float
    completed: bool
    last_read_position: int
    elapsed_sec: int
    highlights: list[int] | None = None
