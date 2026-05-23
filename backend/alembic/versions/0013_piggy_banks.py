"""piggy_banks

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "piggy_banks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("target_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column(
            "current_amount",
            sa.Numeric(15, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default="false"),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_piggy_banks_user_id", "piggy_banks", ["user_id"])

    op.create_table(
        "piggy_bank_contributions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("piggy_bank_id", sa.UUID(), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column(
            "contribution_type",
            sa.Enum("transfer", "expense", name="contributiontype"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["piggy_bank_id"], ["piggy_banks.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="RESTRICT"
        ),
    )
    op.create_index(
        "ix_piggy_bank_contributions_piggy_bank_id",
        "piggy_bank_contributions",
        ["piggy_bank_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_piggy_bank_contributions_piggy_bank_id",
        table_name="piggy_bank_contributions",
    )
    op.drop_table("piggy_bank_contributions")
    op.drop_index("ix_piggy_banks_user_id", table_name="piggy_banks")
    op.drop_table("piggy_banks")
    op.execute("DROP TYPE IF EXISTS contributiontype")
