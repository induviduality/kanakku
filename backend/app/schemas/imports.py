import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.import_batch import (
    ImportBatchStatus,
    ImportSource,
    RecordConfidence,
    RecordMatchType,
    RecordStatus,
    VerificationStatus,
)


class ImportBatchResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    source: ImportSource
    filename: str
    account_id: uuid.UUID | None
    status: ImportBatchStatus
    verification_status: VerificationStatus | None
    total_parsed: int
    total_confirmed: int
    total_rejected: int
    imported_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class ParsedTransaction(BaseModel):
    date: str
    description: str
    amount: Decimal
    type: str  # expense / income
    balance: Decimal | None = None
    reference: str | None = None


class RawImportRecordResponse(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    raw_text: str | None
    parsed_json: dict[str, object] | None
    status: RecordStatus
    transaction_id: uuid.UUID | None
    confidence: RecordConfidence | None
    match_type: RecordMatchType | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RawImportRecordPatch(BaseModel):
    parsed_json: dict[str, object] | None = None
    status: RecordStatus | None = None
