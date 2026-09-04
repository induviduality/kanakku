"""earmarks

Revision ID: 0031
Revises: 0030
Create Date: 2026-09-04

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "earmarks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=True),
        sa.Column("piggy_bank_id", sa.UUID(), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["piggy_bank_id"], ["piggy_banks.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_earmarks_user_id", "earmarks", ["user_id"])
    op.create_index("ix_earmarks_account_id", "earmarks", ["account_id"])
    op.create_index("ix_earmarks_piggy_bank_id", "earmarks", ["piggy_bank_id"])


def downgrade() -> None:
    op.drop_index("ix_earmarks_piggy_bank_id", table_name="earmarks")
    op.drop_index("ix_earmarks_account_id", table_name="earmarks")
    op.drop_index("ix_earmarks_user_id", table_name="earmarks")
    op.drop_table("earmarks")
