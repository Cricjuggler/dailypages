import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPK


class BookStatus(str, enum.Enum):
    pending = "pending"          # awaiting upload completion
    parsing = "parsing"          # PDF parsing / structure extraction
    ready = "ready"              # parsed, plan can be generated
    failed = "failed"


class Book(UUIDPK, TimestampMixin, Base):
    __tablename__ = "books"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pages: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Procedural cover params: { hue, sat, dark, light }
    cover_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Source file in R2 (object key, not a public URL)
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[BookStatus] = mapped_column(
        Enum(BookStatus, name="book_status"), default=BookStatus.pending, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # AI-derived voice/tone profile produced by app.ai.agents.style.
    # Shape: { tone, sentence_rhythm, vocabulary, voice_summary, sample_phrases }
    style_profile: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
