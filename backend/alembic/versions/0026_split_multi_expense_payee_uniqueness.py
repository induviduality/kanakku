"""split_multi_expense: split_expenses join table, per-split payee uniqueness

Replaces the single expense_transaction_id FK on splits with a split_expenses
join table so multiple expense transactions can share one split parent.
Also adds a partial unique index enforcing one share per named payee per split.
Updates the DB-level invariant trigger to sum across all split expenses.

Revision ID: 0026
Revises: 0025
Create Date: 2026-05-31
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TRIGGER_FUNCTION_NEW = """
CREATE OR REPLACE FUNCTION check_split_invariant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_split_id UUID;
    v_expected_amount NUMERIC(15,2);
    v_actual_amount   NUMERIC(15,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_split_id := OLD.split_id;
    ELSE
        v_split_id := NEW.split_id;
    END IF;

    SELECT COALESCE(SUM(t.amount), 0) INTO v_expected_amount
    FROM split_expenses se
    JOIN transactions t ON t.id = se.transaction_id
    WHERE se.split_id = v_split_id;

    -- No expenses linked yet (mid-creation); skip check
    IF v_expected_amount = 0 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_amount
    FROM split_shares
    WHERE split_id = v_split_id;

    IF v_actual_amount != v_expected_amount THEN
        RAISE EXCEPTION 'Split invariant violated: shares sum % != expenses sum %',
            v_actual_amount, v_expected_amount;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
"""

# Restored original trigger function referencing expense_transaction_id
_TRIGGER_FUNCTION_OLD = """
CREATE OR REPLACE FUNCTION check_split_invariant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_split_id UUID;
    v_expected_amount NUMERIC(15,2);
    v_actual_amount   NUMERIC(15,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_split_id := OLD.split_id;
    ELSE
        v_split_id := NEW.split_id;
    END IF;

    SELECT t.amount INTO v_expected_amount
    FROM splits s
    JOIN transactions t ON t.id = s.expense_transaction_id
    WHERE s.id = v_split_id;

    IF v_expected_amount IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_amount
    FROM split_shares
    WHERE split_id = v_split_id;

    IF v_actual_amount != v_expected_amount THEN
        RAISE EXCEPTION 'Split invariant violated: shares sum % != transaction amount %',
            v_actual_amount, v_expected_amount;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
"""


def upgrade() -> None:
    # 1. Create split_expenses join table
    op.create_table(
        "split_expenses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("split_id", sa.UUID(), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["split_id"], ["splits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transaction_id", name="uq_split_expenses_transaction"),
    )
    op.create_index("ix_split_expenses_split_id", "split_expenses", ["split_id"])

    # 2. Migrate existing data: one row per split
    op.execute(
        """
        INSERT INTO split_expenses (id, split_id, transaction_id)
        SELECT gen_random_uuid(), id, expense_transaction_id
        FROM splits
        WHERE expense_transaction_id IS NOT NULL
        """
    )

    # 3. Update the invariant trigger to use split_expenses
    op.execute(_TRIGGER_FUNCTION_NEW)
    # Trigger itself (on split_shares) stays — only the function body changed

    # 4. Drop old unique constraint then column from splits
    op.drop_constraint("uq_splits_transaction", "splits", type_="unique")
    op.drop_constraint(
        "splits_expense_transaction_id_fkey", "splits", type_="foreignkey"
    )
    op.drop_column("splits", "expense_transaction_id")

    # 5. Per-split payee uniqueness for named payees (NULL allowed multiple times
    #    for anonymous/own shares created by bundle; only non-null is constrained here)
    op.execute(
        """
        CREATE UNIQUE INDEX uq_split_shares_payee_per_split
        ON split_shares (split_id, payee_id)
        WHERE payee_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_split_shares_payee_per_split")

    op.add_column(
        "splits",
        sa.Column("expense_transaction_id", sa.UUID(), nullable=True),
    )
    op.execute(
        """
        UPDATE splits s
        SET expense_transaction_id = (
            SELECT transaction_id
            FROM split_expenses e
            WHERE e.split_id = s.id
            ORDER BY e.created_at
            LIMIT 1
        )
        """
    )
    op.alter_column("splits", "expense_transaction_id", nullable=False)
    op.create_unique_constraint(
        "uq_splits_transaction", "splits", ["expense_transaction_id"]
    )
    op.create_foreign_key(
        "splits_expense_transaction_id_fkey",
        "splits",
        "transactions",
        ["expense_transaction_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.execute(_TRIGGER_FUNCTION_OLD)

    op.drop_index("ix_split_expenses_split_id", table_name="split_expenses")
    op.drop_table("split_expenses")
