"""Fix transaction_with_net_amount view to include forgiven_amount for partial forgiveness.

The 0026 view only counted shares whose status = 'forgiven' (full forgiveness) toward
the net expense. It silently ignored forgiven_amount on shares that are otherwise
'pending' or 'settled' (partial forgiveness).  The corrected formula matches the
Python service in expense_calculator.py:

  net = own_share + fully_forgiven_shares + partial_forgiven_amounts

Revision ID: 0027
Revises: 0026
Create Date: 2026-06-03
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_VIEW_UP = """
CREATE OR REPLACE VIEW transaction_with_net_amount AS
SELECT
    t.id, t.user_id, t.type, t.transacted_at, t.amount, t.currency,
    t.description, t.notes, t.account_id, t.payment_method_id, t.payee_id,
    t.to_account_id, t.to_amount, t.to_currency, t.subscription_id,
    t.import_record_id, t.created_at, t.updated_at, t.deleted_at,
    CASE
        WHEN s.id IS NULL THEN t.amount
        ELSE COALESCE(
            (SELECT SUM(
               CASE
                 WHEN ss.payee_id IS NULL             THEN ss.amount
                 WHEN ss.status = 'forgiven'::splitsharestatus THEN ss.amount
                 ELSE ss.forgiven_amount
               END
             )
             FROM split_shares ss
             WHERE ss.split_id = s.id),
            t.amount
        )
    END AS net_amount
FROM transactions t
LEFT JOIN split_expenses se ON se.transaction_id = t.id
LEFT JOIN splits s ON s.id = se.split_id AND s.deleted_at IS NULL;
"""

# Restore the 0026 view (partial forgiveness not handled)
_VIEW_DOWN = """
CREATE OR REPLACE VIEW transaction_with_net_amount AS
SELECT
    t.id, t.user_id, t.type, t.transacted_at, t.amount, t.currency,
    t.description, t.notes, t.account_id, t.payment_method_id, t.payee_id,
    t.to_account_id, t.to_amount, t.to_currency, t.subscription_id,
    t.import_record_id, t.created_at, t.updated_at, t.deleted_at,
    CASE
        WHEN s.id IS NULL THEN t.amount
        ELSE COALESCE(
            (SELECT SUM(ss.amount)
             FROM split_shares ss
             WHERE ss.split_id = s.id
               AND (ss.payee_id IS NULL OR ss.status = 'forgiven'::splitsharestatus)),
            t.amount
        )
    END AS net_amount
FROM transactions t
LEFT JOIN split_expenses se ON se.transaction_id = t.id
LEFT JOIN splits s ON s.id = se.split_id AND s.deleted_at IS NULL;
"""


def upgrade() -> None:
    op.execute("DROP VIEW IF EXISTS transaction_with_net_amount")
    op.execute(_VIEW_UP)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS transaction_with_net_amount")
    op.execute(_VIEW_DOWN)
