import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPK

# Voyage's voyage-3-large supports output_dimension in {256, 512, 1024, 2048}.
# 1024 is the recommended balance. If you swap providers, change this and
# add a migration that alters the column.
EMBEDDING_DIM = 1024


class Chapter(UUIDPK, TimestampMixin, Base):
    __tablename__ = "chapters"

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM), nullable=True)
    complexity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    importance_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # AI-derived concept list: [{ name, definition, dependencies: [name, ...] }]
    concepts: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
