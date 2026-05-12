"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-08

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 1024


def upgrade() -> None:
    # Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # Enums — create types explicitly via DO block (idempotent) and mark
    # create_type=False on the column references so create_table() doesn't
    # try to create them a second time.
    op.execute("""
    DO $$ BEGIN
      CREATE TYPE book_status AS ENUM ('pending', 'parsing', 'ready', 'failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
    DO $$ BEGIN
      CREATE TYPE depth AS ENUM ('quick', 'balanced', 'deep');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    op.execute("""
    DO $$ BEGIN
      CREATE TYPE pace AS ENUM ('sprint', 'steady', 'gentle');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    """)
    book_status = postgresql.ENUM(
        "pending", "parsing", "ready", "failed", name="book_status", create_type=False
    )
    depth_enum = postgresql.ENUM(
        "quick", "balanced", "deep", name="depth", create_type=False
    )
    pace_enum = postgresql.ENUM(
        "sprint", "steady", "gentle", name="pace", create_type=False
    )

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clerk_user_id", sa.String(64), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("clerk_user_id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_clerk_user_id", "users", ["clerk_user_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # books
    op.create_table(
        "books",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("pages", sa.Integer, nullable=True),
        sa.Column("cover_params", postgresql.JSONB, nullable=True),
        sa.Column("cover_url", sa.Text, nullable=True),
        sa.Column("storage_key", sa.Text, nullable=True),
        sa.Column("content_type", sa.String(120), nullable=True),
        sa.Column("size_bytes", sa.Integer, nullable=True),
        sa.Column("status", book_status, nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_books_user_id", "books", ["user_id"])

    # chapters
    op.create_table(
        "chapters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ordinal", sa.Integer, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("raw_content", sa.Text, nullable=True),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
        sa.Column("complexity_score", sa.Float, nullable=True),
        sa.Column("importance_score", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chapters_book_id", "chapters", ["book_id"])

    # IVFFlat index — fast cosine search over chapter embeddings.
    # Note: requires populated rows + ANALYZE for ideal perf; create empty is fine.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chapters_embedding "
        "ON chapters USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # reading_plans
    op.create_table(
        "reading_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "book_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("minutes_per_session", sa.Integer, nullable=False),
        sa.Column("total_sessions", sa.Integer, nullable=False),
        sa.Column("total_days", sa.Integer, nullable=False),
        sa.Column("depth", depth_enum, nullable=False),
        sa.Column("pace", pace_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_reading_plans_user_id", "reading_plans", ["user_id"])
    op.create_index("ix_reading_plans_book_id", "reading_plans", ["book_id"])

    # sessions
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "reading_plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("reading_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("session_number", sa.Integer, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("chapter", sa.String(255), nullable=True),
        sa.Column("estimated_minutes", sa.Integer, nullable=False),
        sa.Column("content_blocks", postgresql.JSONB, nullable=True),
        sa.Column("recap", postgresql.JSONB, nullable=True),
        sa.Column("quiz", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_reading_plan_id", "sessions", ["reading_plan_id"])

    # user_progress
    op.create_table(
        "user_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("completion_percentage", sa.Float, nullable=False, server_default="0"),
        sa.Column("completed", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("last_read_position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("elapsed_sec", sa.Integer, nullable=False, server_default="0"),
        sa.Column("highlights", postgresql.JSONB, nullable=True),
        sa.Column("quiz_answers", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "session_id", name="uq_user_session"),
    )
    op.create_index("ix_user_progress_user_id", "user_progress", ["user_id"])
    op.create_index("ix_user_progress_session_id", "user_progress", ["session_id"])


def downgrade() -> None:
    op.drop_table("user_progress")
    op.drop_table("sessions")
    op.drop_table("reading_plans")
    op.execute("DROP INDEX IF EXISTS ix_chapters_embedding")
    op.drop_table("chapters")
    op.drop_table("books")
    op.drop_table("users")
    for name in ("pace", "depth", "book_status"):
        op.execute(f"DROP TYPE IF EXISTS {name}")
