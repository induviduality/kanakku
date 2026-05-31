import uuid
from datetime import datetime
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GPayMatchStatus(StrEnum):
    pending = "pending"      # ambiguous — awaiting manual resolution
    resolved = "resolved"    # user picked a candidate
    orphan = "orphan"        # no bank transaction found
    auto_linked = "auto_linked"  # exact match, auto-applied


class GPayMatch(Base):
    __tablename__ = "gpay_matches"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    gpay_data: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    candidate_transaction_ids: Mapped[list[object]] = mapped_column(
        ARRAY(sa.UUID(as_uuid=True)), nullable=False, server_default="{}"
    )
    chosen_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    llm_suggestion_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True), nullable=True
    )
    status: Mapped[GPayMatchStatus] = mapped_column(
        sa.Enum(GPayMatchStatus, name="gpaymatchstatus"),
        nullable=False,
        default=GPayMatchStatus.pending,
        server_default="pending",
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False
    )
