"""llm_activity_log

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "llm_activity_log",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("operation", sa.String(64), nullable=False),
        sa.Column("payload_summary", JSONB, nullable=False, server_default="{}"),
        sa.Column("backend", sa.String(32), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("duration_ms", sa.Integer, nullable=False),
        sa.Column("succeeded", sa.Boolean, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_llm_activity_log_user_id", "llm_activity_log", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_llm_activity_log_user_id", table_name="llm_activity_log")
    op.drop_table("llm_activity_log")
