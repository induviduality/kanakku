"""splits

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION check_split_invariant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_split_id UUID;
    v_expected_amount NUMERIC(15,2);
    v_actual_amount NUMERIC(15,2);
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

    -- Split may not exist yet (race or mid-delete); skip check
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

_TRIGGER_SQL = """
CREATE CONSTRAINT TRIGGER trg_split_invariant
AFTER INSERT OR UPDATE OR DELETE ON split_shares
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_split_invariant();
"""


def upgrade() -> None:
    op.create_table(
        "splits",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("expense_transaction_id", sa.UUID(), nullable=False),
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
            ["expense_transaction_id"], ["transactions.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("expense_transaction_id", name="uq_splits_transaction"),
    )

    op.create_table(
        "split_shares",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("split_id", sa.UUID(), nullable=False),
        sa.Column("payee_id", sa.UUID(), nullable=True),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "settled", "forgiven", name="splitsharestatus"),
            nullable=False,
        ),
        sa.Column("settled_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("settlement_transaction_id", sa.UUID(), nullable=True),
        sa.Column("forgiven_at", sa.TIMESTAMP(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["split_id"], ["splits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["payee_id"], ["payees.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["settlement_transaction_id"], ["transactions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_split_shares_split_id", "split_shares", ["split_id"])

    op.execute(_TRIGGER_FUNCTION_SQL)
    op.execute(_TRIGGER_SQL)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_split_invariant ON split_shares")
    op.execute("DROP FUNCTION IF EXISTS check_split_invariant()")
    op.drop_index("ix_split_shares_split_id", table_name="split_shares")
    op.drop_table("split_shares")
    op.drop_table("splits")
    op.execute("DROP TYPE IF EXISTS splitsharestatus")
