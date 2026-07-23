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
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated
from zoneinfo import ZoneInfo

import arq
import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
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
from app.models.user_settings import UserSettings
from app.schemas.imports import ImportBatchResponse, RawImportRecordPatch, RawImportRecordResponse

router = APIRouter(prefix="/imports", tags=["imports"])

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


# ── GET /imports/{batch_id}/transfer-suggestions ─────────────────────────────

class TransferSuggestion(BaseModel):
    record_id: uuid.UUID
    to_account_id: uuid.UUID
    to_account_name: str
    matched_transaction_id: uuid.UUID


@router.get("/{batch_id}/transfer-suggestions", response_model=list[TransferSuggestion])
async def transfer_suggestions(
    batch_id: uuid.UUID,
    current_user: UserDep,
    session: SessionDep,
) -> list[TransferSuggestion]:
    """Suggest which pending bank debits are really credit-card/loan bill payments.

    Credit-cards review §3.3: a card bill paid from a bank account arrives on
    the *bank* statement as a plain debit → imported as an expense → the spend
    is counted twice (once at swipe on the card, once at payment from the
    bank). If the matching card/loan statement was also imported, that payment
    shows up as a *credit* (income) on the liability account. We match each
    pending bank debit against a recent liability-account credit of the same
    amount and suggest retyping it to a transfer to that account.
    """
    from datetime import timedelta

    from app.models.account import LIABILITY_ACCOUNT_TYPES, Account

    batch = await _get_batch_or_404(session, batch_id, current_user.id)
    if batch.account_id is None:
        return []

    # The source must be a liquid account; a card-to-card "payment" isn't the
    # bill-payment case this hint is for.
    source = await session.get(Account, batch.account_id)
    if source is None or source.type in LIABILITY_ACCOUNT_TYPES:
        return []

    liability_accounts = (
        await session.execute(
            sa.select(Account.id, Account.name).where(
                Account.user_id == current_user.id,
                Account.deleted_at.is_(None),
                Account.type.in_(LIABILITY_ACCOUNT_TYPES),
                Account.id != batch.account_id,
            )
        )
    ).all()
    if not liability_accounts:
        return []
    liability_ids = [row.id for row in liability_accounts]
    name_by_id = {row.id: row.name for row in liability_accounts}

    # Candidate credits: income transactions on those liability accounts.
    credits = (
        await session.execute(
            sa.select(
                Transaction.id, Transaction.account_id,
                Transaction.amount, Transaction.transacted_at,
            ).where(
                Transaction.user_id == current_user.id,
                Transaction.deleted_at.is_(None),
                Transaction.type == TransactionType.income,
                Transaction.account_id.in_(liability_ids),
            )
        )
    ).all()
    if not credits:
        return []

    tz_name = await _get_user_timezone(session, batch.user_id)
    records = (
        await session.execute(
            sa.select(RawImportRecord).where(
                RawImportRecord.batch_id == batch_id,
                RawImportRecord.status == RecordStatus.pending,
            )
        )
    ).scalars().all()

    WINDOW = timedelta(days=5)
    suggestions: list[TransferSuggestion] = []
    for record in records:
        data = record.parsed_json or {}
        if str(data.get("type", "expense")).lower() != "expense":
            continue
        try:
            amount = Decimal(str(data.get("amount", "0")))
            rec_dt = (
                datetime.strptime(str(data.get("date", "")), "%Y-%m-%d")
                .replace(tzinfo=ZoneInfo(tz_name))
                .astimezone(UTC)
            )
        except (ValueError, ArithmeticError):
            continue
        # First credit of the same amount within the date window wins.
        for c in credits:
            if c.amount == amount and abs(c.transacted_at - rec_dt) <= WINDOW:
                suggestions.append(TransferSuggestion(
                    record_id=record.id,
                    to_account_id=c.account_id,
                    to_account_name=name_by_id[c.account_id],
                    matched_transaction_id=c.id,
                ))
                break

    return suggestions


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


class BatchPatch(BaseModel):
    account_id: uuid.UUID | None = None


# ── PATCH /imports/{batch_id} ─────────────────────────────────────────────────

@router.patch("/{batch_id}", response_model=ImportBatchResponse)
async def patch_batch(
    batch_id: uuid.UUID,
    body: BatchPatch,
    current_user: UserDep,
    session: SessionDep,
) -> ImportBatch:
    """Update batch metadata (e.g. set account_id after upload)."""
    batch = await _get_batch_or_404(session, batch_id, current_user.id)
    if body.account_id is not None:
        batch.account_id = body.account_id
    await session.commit()
    await session.refresh(batch)
    return batch


@router.post("/{batch_id}/confirm", response_model=ImportBatchResponse)
async def confirm_records(
    batch_id: uuid.UUID,
    body: ConfirmRequest,
    current_user: UserDep,
    session: SessionDep,
) -> ImportBatch:
    """Convert pending (or duplicate if force=True) records into transactions."""
    batch = await _get_batch_or_404(session, batch_id, current_user.id)

    # A batch without an account_id cannot be confirmed — the resulting Transaction
    # row has no place to live. Surface this clearly instead of silently dropping
    # every record in _record_to_transaction.
    if batch.account_id is None:
        raise HTTPException(
            status_code=422,
            detail="Batch has no account_id; set one on the batch before confirming.",
        )

    # Status filter applies regardless of whether record_ids was provided —
    # otherwise already-confirmed/rejected records get re-imported as duplicates.
    allowed_statuses = (
        [RecordStatus.pending, RecordStatus.duplicate]
        if body.force
        else [RecordStatus.pending]
    )
    query = sa.select(RawImportRecord).where(
        RawImportRecord.batch_id == batch_id,
        RawImportRecord.status.in_(allowed_statuses),
    )
    if body.record_ids is not None:
        query = query.where(RawImportRecord.id.in_(body.record_ids))

    result = await session.execute(query)
    records = list(result.scalars().all())

    tz_name = await _get_user_timezone(session, batch.user_id)
    valid_account_ids = await _user_account_ids(session, batch.user_id)
    confirmed = 0
    for record in records:
        if record.status == RecordStatus.duplicate and not body.force:
            continue
        txn, error = _record_to_transaction(record, batch, tz_name, valid_account_ids)
        if txn is None:
            # Mark it (and remember why) instead of silently leaving it
            # pending — the previous behavior made records vanish from the
            # Confirm flow with no error, no toast, no count anywhere.
            record.status = RecordStatus.failed
            record.parsed_json = {**(record.parsed_json or {}), "_import_error": error}
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


# ── POST /imports/{batch_id}/records/{record_id}/replace ─────────────────────

class ReplaceRequest(BaseModel):
    transaction_ids: list[uuid.UUID]  # IDs of existing transactions to soft-delete


@router.post("/{batch_id}/records/{record_id}/replace", response_model=ImportBatchResponse)
async def replace_existing(
    batch_id: uuid.UUID,
    record_id: uuid.UUID,
    body: ReplaceRequest,
    current_user: UserDep,
    session: SessionDep,
) -> ImportBatch:
    """Soft-delete matched transactions and import the new record in their place."""
    from app.models.transaction import Transaction

    batch = await _get_batch_or_404(session, batch_id, current_user.id)
    if batch.account_id is None:
        raise HTTPException(status_code=422, detail="Batch has no account_id")

    record = await _get_record_or_404(session, record_id, batch_id)
    if record.status != RecordStatus.duplicate:
        raise HTTPException(status_code=422, detail="Record is not a duplicate")

    # Build the replacement transaction first and bail out before touching
    # anything if the record can't be parsed — otherwise a failure here would
    # soft-delete the existing transaction below and leave the user with
    # neither the old nor the new one.
    tz_name = await _get_user_timezone(session, batch.user_id)
    valid_account_ids = await _user_account_ids(session, batch.user_id)
    txn, error = _record_to_transaction(record, batch, tz_name, valid_account_ids)
    if txn is None:
        raise HTTPException(status_code=422, detail=error or "Could not import this record")

    # Soft-delete specified transactions (must belong to this user)
    if body.transaction_ids:
        res = await session.execute(
            sa.select(Transaction).where(
                Transaction.id.in_(body.transaction_ids),
                Transaction.user_id == current_user.id,
                Transaction.deleted_at.is_(None),
            )
        )
        for old_txn in res.scalars().all():
            old_txn.deleted_at = datetime.now(UTC)

    session.add(txn)
    await session.flush()
    record.status = RecordStatus.confirmed
    record.transaction_id = txn.id
    batch.total_confirmed = (batch.total_confirmed or 0) + 1

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


async def _get_user_timezone(session: AsyncSession, user_id: uuid.UUID) -> str:
    result = await session.execute(
        sa.select(UserSettings.timezone).where(UserSettings.user_id == user_id)
    )
    return result.scalar_one_or_none() or "UTC"


async def _user_account_ids(session: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Set of the user's live account ids — used to validate transfer destinations."""
    from app.models.account import Account

    rows = await session.execute(
        sa.select(Account.id).where(
            Account.user_id == user_id,
            Account.deleted_at.is_(None),
        )
    )
    return set(rows.scalars().all())


def _record_to_transaction(
    record: RawImportRecord,
    batch: ImportBatch,
    tz_name: str,
    valid_account_ids: set[uuid.UUID] | None = None,
) -> tuple[Transaction | None, str | None]:
    """Convert a RawImportRecord's parsed_json into a Transaction.

    A bank statement's date (e.g. "Opening Balance as of 01 Jan 2026") is a
    calendar date with no time-of-day, meant in the user's own local
    timezone — not UTC. Attaching tzinfo=UTC directly to that date treats
    "01 Jan 2026" as midnight UTC, which for any timezone ahead of UTC (e.g.
    IST, UTC+5:30) is ~5.5h later than the user's real local midnight. That
    was enough to push an opening_balance transaction dated exactly on a
    period boundary to the wrong side of it — see docs/decisions/log.md
    2026-07-11 (14). tz_name comes from the user's own UserSettings.timezone.

    A record retyped to ``transfer`` at review time (e.g. a card-bill payment
    that arrives on the *bank* statement as a plain debit — see the
    credit-cards review §3.3) carries a ``to_account_id`` in parsed_json: the
    liability account the money moves to. That destination must be one of the
    user's own accounts (``valid_account_ids``) and cannot equal the source
    account. Modelling the payment as a transfer keeps it out of expense
    totals, so the card swipe isn't double-counted at both swipe and payment.

    Returns (transaction, None) on success, or (None, reason) on failure —
    the caller is responsible for surfacing the reason rather than silently
    dropping the record (see docs/decisions/log.md 2026-07-23, review bug #6).
    """
    data = record.parsed_json
    if not data:
        return None, "No parsed data on this record"

    try:
        raw_date = str(data.get("date", ""))
        transacted_at = (
            datetime.strptime(raw_date, "%Y-%m-%d")
            .replace(tzinfo=ZoneInfo(tz_name))
            .astimezone(UTC)
        )
        amount = Decimal(str(data.get("amount", "0")))
        txn_type_str = str(data.get("type", "expense")).lower()
        txn_type = {
            "income": TransactionType.income,
            "opening_balance": TransactionType.opening_balance,
            "transfer": TransactionType.transfer,
        }.get(txn_type_str, TransactionType.expense)
        description = str(data.get("description", ""))

        if batch.account_id is None:
            return None, "Batch has no account selected"

        to_account_id: uuid.UUID | None = None
        if txn_type == TransactionType.transfer:
            raw_to = data.get("to_account_id")
            if not raw_to:
                return None, "Transfer record needs a destination account"
            try:
                to_account_id = uuid.UUID(str(raw_to))
            except ValueError:
                return None, "Transfer destination account is not a valid id"
            if to_account_id == batch.account_id:
                return None, "Transfer destination must differ from the source account"
            if valid_account_ids is not None and to_account_id not in valid_account_ids:
                return None, "Transfer destination account not found"

        return Transaction(
            user_id=batch.user_id,
            type=txn_type,
            transacted_at=transacted_at,
            amount=amount,
            currency="INR",
            description=description,
            account_id=batch.account_id,
            to_account_id=to_account_id,
            import_record_id=record.id,
        ), None
    except Exception as exc:
        return None, f"Could not parse this record: {exc}"
