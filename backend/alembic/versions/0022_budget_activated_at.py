"""budget activated_at

Revision ID: 0022
Revises: 0021
Create Date: 2026-05-26

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "budgets",
        sa.Column(
            "activated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_column("budgets", "activated_at")
