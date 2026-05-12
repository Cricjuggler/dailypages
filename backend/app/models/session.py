import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPK


class Session(UUIDPK, TimestampMixin, Base):
    """A single reading session (a chapter of the AI-paced plan)."""

    __tablename__ = "sessions"

    reading_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reading_plans.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    session_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    chapter: Mapped[str | None] = mapped_column(String(255), nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    # JSON array of typed prose blocks: { kind: 'p'|'h2'|'pullquote'|'intro'|'outro'|'section-mark', ... }
    content_blocks: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    recap: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    quiz: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
