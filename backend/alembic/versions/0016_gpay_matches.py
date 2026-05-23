"""gpay_matches

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "gpay_matches",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("gpay_data", JSONB, nullable=False),
        sa.Column(
            "candidate_transaction_ids",
            ARRAY(sa.UUID(as_uuid=True)),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "chosen_transaction_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("llm_suggestion_id", sa.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pending", "resolved", "orphan", "auto_linked", name="gpaymatchstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_gpay_matches_user_id", "gpay_matches", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_gpay_matches_user_id", table_name="gpay_matches")
    op.drop_table("gpay_matches")
    op.execute("DROP TYPE IF EXISTS gpaymatchstatus")
