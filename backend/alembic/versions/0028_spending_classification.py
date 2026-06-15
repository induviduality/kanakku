"""Add spending_classification to transactions.

Revision ID: 0028
Revises: 0027
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None

spending_classification_enum = sa.Enum(
    "routine",
    "planned_essential",
    "planned_discretionary",
    "unplanned_essential",
    "unplanned_discretionary",
    name="spendingclassification",
)


def upgrade() -> None:
    spending_classification_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "transactions",
        sa.Column(
            "spending_classification",
            spending_classification_enum,
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("transactions", "spending_classification")
    spending_classification_enum.drop(op.get_bind(), checkfirst=True)
