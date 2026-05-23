"""readonly_role

Revision ID: 0017
Revises: 0016
Create Date: 2026-05-23

"""
from collections.abc import Sequence

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CURATED_TABLES = [
    "accounts",
    "payment_methods",
    "payees",
    "categories",
    "tags",
    "transactions",
    "transaction_categories",
    "transaction_tags",
    "transaction_budgets",
    "splits",
    "split_shares",
    "budgets",
    "budget_categories",
    "subscriptions",
    "piggy_banks",
    "piggy_bank_contributions",
    "import_batches",
    "raw_import_records",
    "gpay_matches",
]


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            CREATE ROLE app_readonly WITH LOGIN PASSWORD 'kanakku_readonly';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END
        $$;
    """)

    op.execute("""
        DO $$
        DECLARE db TEXT := current_database();
        BEGIN
            EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_readonly', db);
        END
        $$;
    """)

    op.execute("GRANT USAGE ON SCHEMA public TO app_readonly")

    tables = ", ".join(_CURATED_TABLES)
    op.execute(f"GRANT SELECT ON {tables} TO app_readonly")


def downgrade() -> None:
    tables = ", ".join(_CURATED_TABLES)
    op.execute(f"REVOKE SELECT ON {tables} FROM app_readonly")
    op.execute("REVOKE USAGE ON SCHEMA public FROM app_readonly")
    op.execute("""
        DO $$
        DECLARE db TEXT := current_database();
        BEGIN
            EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM app_readonly', db);
        END
        $$;
    """)
    op.execute("DROP ROLE IF EXISTS app_readonly")
