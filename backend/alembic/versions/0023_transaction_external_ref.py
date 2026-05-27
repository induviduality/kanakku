"""transaction external_ref

Revision ID: 0023
Revises: 0022
Create Date: 2026-05-27

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("external_ref", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("transactions", "external_ref")
