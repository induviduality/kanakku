"""piggy_bank_date_started

Revision ID: 0025
Revises: 0024
Create Date: 2026-05-31

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "piggy_banks",
        sa.Column("date_started", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("piggy_banks", "date_started")
