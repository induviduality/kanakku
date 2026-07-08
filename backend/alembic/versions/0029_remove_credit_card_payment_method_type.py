"""Remove credit_card from payment_method_type; credit cards are now their own account type

Revision ID: 0029
Revises: 0028
Create Date: 2026-07-08
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0029"
down_revision: str | None = "0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Credit cards are modeled as their own Account type (accounttype.credit_card).
    # A nested payment_method of type 'credit_card' under that account is
    # redundant — the account itself represents the card. Drop any such rows
    # and remove the enum value.
    op.execute(
        "UPDATE transactions SET payment_method_id = NULL "
        "WHERE payment_method_id IN (SELECT id FROM payment_methods WHERE type = 'credit_card')"
    )
    op.execute("DELETE FROM payment_methods WHERE type = 'credit_card'")

    op.execute("ALTER TYPE paymentmethodtype RENAME TO paymentmethodtype_old")
    op.execute("CREATE TYPE paymentmethodtype AS ENUM ('debit_card', 'netbanking', 'upi')")
    op.execute(
        "ALTER TABLE payment_methods "
        "ALTER COLUMN type TYPE paymentmethodtype "
        "USING type::text::paymentmethodtype"
    )
    op.execute("DROP TYPE paymentmethodtype_old")


def downgrade() -> None:
    op.execute("ALTER TYPE paymentmethodtype ADD VALUE IF NOT EXISTS 'credit_card'")
