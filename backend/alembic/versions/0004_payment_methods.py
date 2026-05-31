"""payment_methods

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payment_methods",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "debit_card", "credit_card", "netbanking", "upi",
                name="paymentmethodtype",
            ),
            nullable=False,
        ),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("upi_app", sa.String(64), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_methods_account_id", "payment_methods", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_payment_methods_account_id", table_name="payment_methods")
    op.drop_table("payment_methods")
    op.execute("DROP TYPE IF EXISTS paymentmethodtype")
