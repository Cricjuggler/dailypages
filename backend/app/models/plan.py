import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPK


class Depth(str, enum.Enum):
    quick = "quick"
    balanced = "balanced"
    deep = "deep"


class Pace(str, enum.Enum):
    sprint = "sprint"
    steady = "steady"
    gentle = "gentle"


class ReadingPlan(UUIDPK, TimestampMixin, Base):
    __tablename__ = "reading_plans"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False
    )
    minutes_per_session: Mapped[int] = mapped_column(Integer, nullable=False)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, nullable=False)
    depth: Mapped[Depth] = mapped_column(Enum(Depth, name="depth"), nullable=False)
    pace: Mapped[Pace] = mapped_column(Enum(Pace, name="pace"), nullable=False)
