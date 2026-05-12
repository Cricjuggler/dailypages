"""ai-derived columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-08

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("books", sa.Column("style_profile", postgresql.JSONB, nullable=True))
    op.add_column("chapters", sa.Column("concepts", postgresql.JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("chapters", "concepts")
    op.drop_column("books", "style_profile")
