"""Add failed to recordstatus enum

Revision ID: 0030
Revises: 0029
Create Date: 2026-07-23
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE recordstatus ADD VALUE IF NOT EXISTS 'failed'")


def downgrade() -> None:
    # Postgres does not support removing enum values — downgrade is a no-op.
    # Reset any 'failed' records to 'pending' manually before rolling back.
    pass
