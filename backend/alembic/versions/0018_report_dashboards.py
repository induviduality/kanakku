"""report_dashboards

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-23

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "report_dashboards",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_report_dashboards_user_id", "report_dashboards", ["user_id"])

    op.create_table(
        "report_widgets",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dashboard_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("report_dashboards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("query", sa.Text, nullable=False),
        sa.Column(
            "viz_type",
            sa.Enum("bar", "line", "pie", "kpi", "table", name="viztype"),
            nullable=False,
        ),
        sa.Column("viz_config", JSONB, nullable=True),
        sa.Column("position", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_report_widgets_dashboard_id", "report_widgets", ["dashboard_id"])

    # Grant readonly access to new tables
    op.execute("DO $$ BEGIN GRANT SELECT ON report_dashboards TO app_readonly; EXCEPTION WHEN undefined_object THEN NULL; END $$;")
    op.execute("DO $$ BEGIN GRANT SELECT ON report_widgets TO app_readonly; EXCEPTION WHEN undefined_object THEN NULL; END $$;")


def downgrade() -> None:
    op.drop_index("ix_report_widgets_dashboard_id", table_name="report_widgets")
    op.drop_table("report_widgets")
    op.drop_index("ix_report_dashboards_user_id", table_name="report_dashboards")
    op.drop_table("report_dashboards")
    op.execute("DROP TYPE IF EXISTS viztype")
