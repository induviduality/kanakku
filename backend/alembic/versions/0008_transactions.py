"""transactions

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "transactions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "type",
            sa.Enum("expense", "income", "transfer", name="transactiontype"),
            nullable=False,
        ),
        sa.Column("transacted_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("account_id", sa.UUID(), nullable=False),
        sa.Column("payment_method_id", sa.UUID(), nullable=True),
        sa.Column("payee_id", sa.UUID(), nullable=True),
        sa.Column("to_account_id", sa.UUID(), nullable=True),
        sa.Column("to_amount", sa.Numeric(15, 2), nullable=True),
        sa.Column("to_currency", sa.String(10), nullable=True),
        sa.Column("subscription_id", sa.UUID(), nullable=True),
        sa.Column("import_record_id", sa.UUID(), nullable=True),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["payment_method_id"], ["payment_methods.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["payee_id"], ["payees.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["to_account_id"], ["accounts.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "(type = 'transfer' AND to_account_id IS NOT NULL) OR "
            "(type != 'transfer' AND to_account_id IS NULL)",
            name="ck_transaction_transfer_to_account",
        ),
        sa.CheckConstraint("amount > 0", name="ck_transaction_amount_positive"),
    )

    # Indexes
    op.create_index(
        "ix_transactions_user_transacted_at",
        "transactions",
        ["user_id", sa.text("transacted_at DESC")],
    )
    op.create_index(
        "ix_transactions_user_account_transacted_at",
        "transactions",
        ["user_id", "account_id", sa.text("transacted_at DESC")],
    )
    op.create_index(
        "ix_transactions_user_deleted_at",
        "transactions",
        ["user_id", "deleted_at"],
    )

    # Join tables
    op.create_table(
        "transaction_categories",
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("transaction_id", "category_id"),
    )

    op.create_table(
        "transaction_tags",
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("transaction_id", "tag_id"),
    )

    # budget_id FK deferred to M5 when budgets table is created
    op.create_table(
        "transaction_budgets",
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("budget_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("transaction_id", "budget_id"),
    )


def downgrade() -> None:
    op.drop_table("transaction_budgets")
    op.drop_table("transaction_tags")
    op.drop_table("transaction_categories")
    op.drop_index("ix_transactions_user_deleted_at", table_name="transactions")
    op.drop_index(
        "ix_transactions_user_account_transacted_at", table_name="transactions"
    )
    op.drop_index("ix_transactions_user_transacted_at", table_name="transactions")
    op.drop_table("transactions")
    op.execute("DROP TYPE IF EXISTS transactiontype")
