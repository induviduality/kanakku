"""split_share_settlements: multi-payment settlement + partial forgiveness

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-27

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add forgiven_amount to split_shares
    op.add_column(
        "split_shares",
        sa.Column(
            "forgiven_amount",
            sa.Numeric(15, 2),
            nullable=False,
            server_default="0.00",
        ),
    )

    # Drop the old single-settlement columns from split_shares
    op.drop_constraint(
        "split_shares_settlement_transaction_id_fkey",
        "split_shares",
        type_="foreignkey",
    )
    op.drop_column("split_shares", "settlement_transaction_id")
    op.drop_column("split_shares", "settled_at")
    op.drop_column("split_shares", "forgiven_at")

    # Create the new join table: one share → many income transactions
    op.create_table(
        "split_share_settlements",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("share_id", sa.UUID(), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["share_id"], ["split_shares.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("share_id", "transaction_id", name="uq_settlement_share_txn"),
    )
    op.create_index(
        "ix_split_share_settlements_share_id",
        "split_share_settlements",
        ["share_id"],
    )
    op.create_index(
        "ix_split_share_settlements_transaction_id",
        "split_share_settlements",
        ["transaction_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_split_share_settlements_transaction_id", table_name="split_share_settlements")
    op.drop_index("ix_split_share_settlements_share_id", table_name="split_share_settlements")
    op.drop_table("split_share_settlements")

    op.add_column("split_shares", sa.Column("forgiven_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("split_shares", sa.Column("settled_at", sa.TIMESTAMP(timezone=True), nullable=True))
    op.add_column("split_shares", sa.Column("settlement_transaction_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "split_shares_settlement_transaction_id_fkey",
        "split_shares",
        "transactions",
        ["settlement_transaction_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_column("split_shares", "forgiven_amount")
