"""Import pipeline endpoints.

POST  /imports/pdf               — upload + queue processing
GET   /imports                   — list batches for current user
GET   /imports/{batch_id}        — get batch detail
GET   /imports/{batch_id}/records — list raw records (grouped by status)
PATCH /imports/{batch_id}/records/{record_id} — edit a pending record inline
POST  /imports/{batch_id}/confirm — confirm selected (or all pending) records
POST  /imports/{batch_id}/reject  — reject selected records
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.dependencies import get_current_user
from app.models.import_batch import (
    ImportBatch,
    ImportBatchStatus,
    ImportSource,
    RawImportRecord,
    RecordStatus,
)
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.imports import ImportBatchResponse, RawImportRecordPatch, RawImportRecordResponse

router = APIRouter(prefix="/imports", tags=["imports"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[User, Depends(get_current_user)]


# ── POST /imports/pdf ─────────────────────────────────────────────────────────

@router.post("/pdf", status_code=status.HTTP_202_ACCEPTED, response_model=ImportBatchResponse)
async def upload_pdf(
    file: UploadFile,
    current_user: UserDep,
    session: SessionDep,
    password: str | None = Query(default=None),
    account_id: uuid.UUID | None = Query(default=None),
) -> ImportBatch:
    """Upload a PDF bank statement. Returns a batch immediately; processing is async."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=422, detail="Empty file")

    batch = ImportBatch(
        user_id=current_user.id,
        source=ImportSource.pdf,
        filename=file.filename,
        account_id=account_id,
        status=ImportBatchStatus.pending,
    )
    session.add(batch)
    await session.flush()

    # Enqueue the ARQ job; fall back to inline processing if Redis is unavailable
    try:
        import arq

        from app.config import settings
        redis_settings = arq.connections.RedisSettings.from_dsn(settings.redis_url)
        redis_pool = await arq.create_pool(redis_settings)
        await redis_pool.enqueue_job("process_pdf_import", str(batch.id), pdf_bytes, password)
        await redis_pool.aclose()
    except Exception:
        from app.workers.import_worker import process_pdf_import
        await process_pdf_import({}, str(batch.id), pdf_bytes, password)

    await session.commit()
    await session.refresh(batch)
    return batch


# ── GET /imports ──────────────────────────────────────────────────────────────

@router.get("", response_model=list[ImportBatchResponse])
async def list_batches(current_user: UserDep, session: SessionDep) -> list[ImportBatch]:
    result = await session.execute(
        sa.select(ImportBatch)
        .where(
            ImportBatch.user_id == current_user.id,
            ImportBatch.deleted_at.is_(None),
        )
        .order_by(ImportBatch.imported_at.desc())
    )
    return list(result.scalars().all())


# ── GET /imports/{batch_id} ───────────────────────────────────────────────────

@router.get("/{batch_id}", response_model=ImportBatchResponse)
async def get_batch(batch_id: uuid.UUID, current_user: UserDep, session: SessionDep) -> ImportBatch:
    return await _get_batch_or_404(session, batch_id, current_user.id)


# ── GET /imports/{batch_id}/records ──────────────────────────────────────────

@router.get("/{batch_id}/records", response_model=list[RawImportRecordResponse])
async def list_records(
    batch_id: uuid.UUID,
    current_user: UserDep,
    session: SessionDep,
    status_filter: RecordStatus | None = Query(default=None, alias="status"),
) -> list[RawImportRecord]:
    await _get_batch_or_404(session, batch_id, current_user.id)

    query = sa.select(RawImportRecord).where(RawImportRecord.batch_id == batch_id)
    if status_filter is not None:
        query = query.where(RawImportRecord.status == status_filter)
    query = query.order_by(RawImportRecord.created_at)

    result = await session.execute(query)
    return list(result.scalars().all())


# ── PATCH /imports/{batch_id}/records/{record_id} ────────────────────────────

@router.patch("/{batch_id}/records/{record_id}", response_model=RawImportRecordResponse)
async def patch_record(
    batch_id: uuid.UUID,
    record_id: uuid.UUID,
    body: RawImportRecordPatch,
    current_user: UserDep,
    session: SessionDep,
) -> RawImportRecord:
    await _get_batch_or_404(session, batch_id, current_user.id)
    record = await _get_record_or_404(session, record_id, batch_id)

    if body.parsed_json is not None:
        record.parsed_json = body.parsed_json
    if body.status is not None:
        record.status = body.status

    await session.commit()
    await session.refresh(record)
    return record


# ── POST /imports/{batch_id}/confirm ─────────────────────────────────────────

class ConfirmRequest(BaseModel):
    record_ids: list[uuid.UUID] | None = None  # None = confirm all pending
    force: bool = False  # confirm even if duplicate


class RejectRequest(BaseModel):
    record_ids: list[uuid.UUID] | None = None  # None = reject all pending


@router.post("/{batch_id}/confirm", response_model=ImportBatchResponse)
async def confirm_records(
    batch_id: uuid.UUID,
    body: ConfirmRequest,
    current_user: UserDep,
    session: SessionDep,
) -> ImportBatch:
    """Convert pending (or duplicate if force=True) records into transactions."""
    batch = await _get_batch_or_404(session, batch_id, current_user.id)

    query = sa.select(RawImportRecord).where(RawImportRecord.batch_id == batch_id)
    if body.record_ids is not None:
        query = query.where(RawImportRecord.id.in_(body.record_ids))
    elif body.force:
        query = query.where(
            RawImportRecord.status.in_([RecordStatus.pending, RecordStatus.duplicate])
        )
    else:
        query = query.where(RawImportRecord.status == RecordStatus.pending)

    result = await session.execute(query)
    records = list(result.scalars().all())

    confirmed = 0
    for record in records:
        if record.status == RecordStatus.duplicate and not body.force:
            continue
        txn = _record_to_transaction(record, batch)
        if txn is None:
            continue
        session.add(txn)
        await session.flush()
        record.status = RecordStatus.confirmed
        record.transaction_id = txn.id
        confirmed += 1

    batch.total_confirmed = (batch.total_confirmed or 0) + confirmed
    await session.commit()
    await session.refresh(batch)
    return batch


@router.post("/{batch_id}/reject", response_model=ImportBatchResponse)
async def reject_records(
    batch_id: uuid.UUID,
    body: RejectRequest,
    current_user: UserDep,
    session: SessionDep,
) -> ImportBatch:
    """Mark pending records as rejected."""
    batch = await _get_batch_or_404(session, batch_id, current_user.id)

    query = sa.select(RawImportRecord).where(
        RawImportRecord.batch_id == batch_id,
        RawImportRecord.status == RecordStatus.pending,
    )
    if body.record_ids is not None:
        query = query.where(RawImportRecord.id.in_(body.record_ids))

    result = await session.execute(query)
    records = list(result.scalars().all())

    rejected = 0
    for record in records:
        record.status = RecordStatus.rejected
        rejected += 1

    batch.total_rejected = (batch.total_rejected or 0) + rejected
    await session.commit()
    await session.refresh(batch)
    return batch


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_batch_or_404(
    session: AsyncSession, batch_id: uuid.UUID, user_id: uuid.UUID
) -> ImportBatch:
    result = await session.execute(
        sa.select(ImportBatch).where(
            ImportBatch.id == batch_id,
            ImportBatch.user_id == user_id,
            ImportBatch.deleted_at.is_(None),
        )
    )
    batch = result.scalar_one_or_none()
    if batch is None:
        raise HTTPException(status_code=404, detail="Import batch not found")
    return batch


async def _get_record_or_404(
    session: AsyncSession, record_id: uuid.UUID, batch_id: uuid.UUID
) -> RawImportRecord:
    result = await session.execute(
        sa.select(RawImportRecord).where(
            RawImportRecord.id == record_id,
            RawImportRecord.batch_id == batch_id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


def _record_to_transaction(record: RawImportRecord, batch: ImportBatch) -> Transaction | None:
    """Convert a RawImportRecord's parsed_json into a Transaction."""
    data = record.parsed_json
    if not data:
        return None

    try:
        raw_date = str(data.get("date", ""))
        transacted_at = datetime.strptime(raw_date, "%Y-%m-%d").replace(tzinfo=UTC)
        amount = Decimal(str(data.get("amount", "0")))
        txn_type_str = str(data.get("type", "expense")).lower()
        txn_type = TransactionType.income if txn_type_str == "income" else TransactionType.expense
        description = str(data.get("description", ""))

        if batch.account_id is None:
            return None

        return Transaction(
            user_id=batch.user_id,
            type=txn_type,
            transacted_at=transacted_at,
            amount=amount,
            currency="INR",
            description=description,
            account_id=batch.account_id,
            import_record_id=record.id,
        )
    except Exception:
        return None
