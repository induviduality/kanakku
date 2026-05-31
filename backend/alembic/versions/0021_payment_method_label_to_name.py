"""Rename payment_methods.label to payment_methods.name

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-25
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("payment_methods", "label", new_column_name="name", existing_type=sa.String(255), nullable=False)


def downgrade() -> None:
    op.alter_column("payment_methods", "name", new_column_name="label", existing_type=sa.String(255), nullable=False)
