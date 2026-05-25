"""Add opening_balance to transactiontype enum

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-25
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'opening_balance'")


def downgrade() -> None:
    # Postgres does not support removing enum values — downgrade is a no-op.
    # Remove all opening_balance transactions manually before rolling back.
    pass
