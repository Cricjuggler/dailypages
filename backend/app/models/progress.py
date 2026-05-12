import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPK


class UserProgress(UUIDPK, TimestampMixin, Base):
    __tablename__ = "user_progress"
    __table_args__ = (UniqueConstraint("user_id", "session_id", name="uq_user_session"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    completion_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_read_position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    elapsed_sec: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    highlights: Mapped[list[int] | None] = mapped_column(JSONB, nullable=True)
    quiz_answers: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
