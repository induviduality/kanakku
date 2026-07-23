import uuid
from datetime import datetime
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ImportSource(StrEnum):
    pdf = "pdf"
    gpay_takeout = "gpay_takeout"
    manual = "manual"


class ImportBatchStatus(StrEnum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class VerificationStatus(StrEnum):
    verified = "verified"
    discrepancy = "discrepancy"
    indeterminate = "indeterminate"


class RecordStatus(StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"
    duplicate = "duplicate"
    failed = "failed"


class RecordConfidence(StrEnum):
    high = "high"
    medium = "medium"
    low = "low"


class RecordMatchType(StrEnum):
    new = "new"
    duplicate = "duplicate"
    low_confidence = "low_confidence"


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    source: Mapped[ImportSource] = mapped_column(
        sa.Enum(ImportSource, name="importsource"), nullable=False
    )
    filename: Mapped[str] = mapped_column(sa.String(500), nullable=False)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[ImportBatchStatus] = mapped_column(
        sa.Enum(ImportBatchStatus, name="importbatchstatus"),
        nullable=False,
        default=ImportBatchStatus.pending,
        server_default="pending",
    )
    verification_status: Mapped[VerificationStatus | None] = mapped_column(
        sa.Enum(VerificationStatus, name="verificationstatus"), nullable=True
    )
    total_parsed: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, default=0, server_default="0"
    )
    total_confirmed: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, default=0, server_default="0"
    )
    total_rejected: Mapped[int] = mapped_column(
        sa.Integer, nullable=False, default=0, server_default="0"
    )
    imported_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        sa.TIMESTAMP(timezone=True), nullable=True
    )


class RawImportRecord(Base):
    __tablename__ = "raw_import_records"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("import_batches.id", ondelete="CASCADE"),
        nullable=False,
    )
    raw_text: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    parsed_json: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[RecordStatus] = mapped_column(
        sa.Enum(RecordStatus, name="recordstatus"),
        nullable=False,
        default=RecordStatus.pending,
        server_default="pending",
    )
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    confidence: Mapped[RecordConfidence | None] = mapped_column(
        sa.Enum(RecordConfidence, name="recordconfidence"), nullable=True
    )
    match_type: Mapped[RecordMatchType | None] = mapped_column(
        sa.Enum(RecordMatchType, name="recordmatchtype"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False
    )
