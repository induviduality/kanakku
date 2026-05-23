"""budgets

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "budgets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column(
            "period",
            sa.Enum("daily", "weekly", "monthly", "quarterly", "yearly", name="budgetperiod"),
            nullable=True,
        ),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "type",
            sa.Enum("recurring", "adhoc", name="budgettype"),
            nullable=False,
        ),
        sa.Column("recurrence_rule", sa.Text(), nullable=True),
        sa.Column("parent_budget_id", sa.UUID(), nullable=True),
        sa.Column("is_modified_instance", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["parent_budget_id"], ["budgets.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_budgets_user_id", "budgets", ["user_id"])

    op.create_table(
        "budget_categories",
        sa.Column("budget_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["budget_id"], ["budgets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("budget_id", "category_id"),
    )

    # Add FK from transaction_budgets.budget_id → budgets.id (deferred from M3)
    op.create_foreign_key(
        "fk_transaction_budgets_budget_id",
        "transaction_budgets",
        "budgets",
        ["budget_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transaction_budgets_budget_id", "transaction_budgets", type_="foreignkey"
    )
    op.drop_table("budget_categories")
    op.drop_index("ix_budgets_user_id", table_name="budgets")
    op.drop_table("budgets")
    op.execute("DROP TYPE IF EXISTS budgetperiod")
    op.execute("DROP TYPE IF EXISTS budgettype")
