"""export_jobs table

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE exportjobstatus AS ENUM ('pending', 'running', 'done', 'failed');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$
        """
    )
    op.create_table(
        "export_jobs",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM("pending", "running", "done", "failed", name="exportjobstatus", create_type=False),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("file_path", sa.Text, nullable=True),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_export_jobs_user_id", "export_jobs", ["user_id"])


def downgrade() -> None:
    op.drop_table("export_jobs")
    op.execute("DROP TYPE IF EXISTS exportjobstatus")
