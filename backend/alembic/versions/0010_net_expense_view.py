"""transaction_with_net_amount view

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-23

"""
from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Net expense = user_own_share (payee_id IS NULL) + forgiven_shares (status='forgiven').
# For non-split transactions net_amount = amount.
_VIEW_SQL = """
CREATE OR REPLACE VIEW transaction_with_net_amount AS
SELECT
    t.*,
    CASE
        WHEN s.id IS NULL THEN t.amount
        ELSE COALESCE(
            (
                SELECT SUM(ss.amount)
                FROM split_shares ss
                WHERE ss.split_id = s.id
                  AND (ss.payee_id IS NULL OR ss.status = 'forgiven')
            ),
            t.amount
        )
    END AS net_amount
FROM transactions t
LEFT JOIN splits s
    ON s.expense_transaction_id = t.id
    AND s.deleted_at IS NULL;
"""


def upgrade() -> None:
    op.execute(_VIEW_SQL)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS transaction_with_net_amount")
