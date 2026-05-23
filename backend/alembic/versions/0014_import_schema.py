"""import_schema

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "import_batches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "source",
            sa.Enum("pdf", "gpay_takeout", "manual", name="importsource"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("account_id", sa.UUID(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "processing", "completed", "failed", name="importbatchstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "verification_status",
            sa.Enum("verified", "discrepancy", "indeterminate", name="verificationstatus"),
            nullable=True,
        ),
        sa.Column("total_parsed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_confirmed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_rejected", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "imported_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["account_id"], ["accounts.id"], ondelete="SET NULL"
        ),
    )
    op.create_index("ix_import_batches_user_id", "import_batches", ["user_id"])

    op.create_table(
        "raw_import_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("parsed_json", sa.dialects.postgresql.JSONB(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "confirmed", "rejected", "duplicate", name="recordstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("transaction_id", sa.UUID(), nullable=True),
        sa.Column(
            "confidence",
            sa.Enum("high", "medium", "low", name="recordconfidence"),
            nullable=True,
        ),
        sa.Column(
            "match_type",
            sa.Enum("new", "duplicate", "low_confidence", name="recordmatchtype"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["batch_id"], ["import_batches.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["transaction_id"], ["transactions.id"], ondelete="SET NULL"
        ),
    )
    op.create_index(
        "ix_raw_import_records_batch_id", "raw_import_records", ["batch_id"]
    )

    # Add FK from transactions.import_record_id → raw_import_records.id
    # The column already exists (added in 0008), just needs the FK constraint
    op.create_foreign_key(
        "fk_transactions_import_record_id",
        "transactions",
        "raw_import_records",
        ["import_record_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_transactions_import_record_id", "transactions", type_="foreignkey"
    )
    op.drop_index("ix_raw_import_records_batch_id", table_name="raw_import_records")
    op.drop_table("raw_import_records")
    op.drop_index("ix_import_batches_user_id", table_name="import_batches")
    op.drop_table("import_batches")
    op.execute("DROP TYPE IF EXISTS recordmatchtype")
    op.execute("DROP TYPE IF EXISTS recordconfidence")
    op.execute("DROP TYPE IF EXISTS recordstatus")
    op.execute("DROP TYPE IF EXISTS verificationstatus")
    op.execute("DROP TYPE IF EXISTS importbatchstatus")
    op.execute("DROP TYPE IF EXISTS importsource")
