"""Model-level tests for ImportBatch and RawImportRecord."""

import uuid

import sqlalchemy as sa

from app.models.import_batch import (
    ImportBatch,
    ImportBatchStatus,
    ImportSource,
    RawImportRecord,
    RecordConfidence,
    RecordMatchType,
    RecordStatus,
    VerificationStatus,
)


async def _make_user(session) -> uuid.UUID:
    uid = uuid.uuid4()
    await session.execute(
        sa.text(
            "INSERT INTO users (id, email, password_hash, created_at) "
            "VALUES (:id, :email, 'x', now())"
        ),
        {"id": uid, "email": f"u{uid.hex[:6]}@test.com"},
    )
    return uid


async def _make_account(session, user_id: uuid.UUID) -> uuid.UUID:
    aid = uuid.uuid4()
    await session.execute(
        sa.text(
            "INSERT INTO accounts (id, user_id, name, type, currency, "
            "opening_balance, current_balance, is_active, created_at, updated_at) "
            "VALUES (:id, :uid, 'Bank', 'bank', 'INR', 0, 0, true, now(), now())"
        ),
        {"id": aid, "uid": user_id},
    )
    return aid


# ── ImportBatch ───────────────────────────────────────────────────────────────

async def test_create_import_batch(db_session) -> None:
    user_id = await _make_user(db_session)
    account_id = await _make_account(db_session, user_id)

    batch = ImportBatch(
        user_id=user_id,
        source=ImportSource.pdf,
        filename="hdfc_jan.pdf",
        account_id=account_id,
    )
    db_session.add(batch)
    await db_session.commit()
    await db_session.refresh(batch)

    assert batch.id is not None
    assert batch.source == ImportSource.pdf
    assert batch.status == ImportBatchStatus.pending
    assert batch.total_parsed == 0
    assert batch.total_confirmed == 0
    assert batch.total_rejected == 0
    assert batch.verification_status is None
    assert batch.completed_at is None


async def test_import_batch_all_sources(db_session) -> None:
    user_id = await _make_user(db_session)
    for source in ImportSource:
        batch = ImportBatch(user_id=user_id, source=source, filename="f.pdf")
        db_session.add(batch)
    await db_session.commit()


async def test_import_batch_status_transitions(db_session) -> None:
    user_id = await _make_user(db_session)
    batch = ImportBatch(user_id=user_id, source=ImportSource.pdf, filename="f.pdf")
    db_session.add(batch)
    await db_session.commit()

    batch.status = ImportBatchStatus.processing
    await db_session.commit()
    assert batch.status == ImportBatchStatus.processing

    batch.status = ImportBatchStatus.completed
    batch.verification_status = VerificationStatus.verified
    await db_session.commit()
    assert batch.verification_status == VerificationStatus.verified


async def test_import_batch_without_account(db_session) -> None:
    user_id = await _make_user(db_session)
    batch = ImportBatch(user_id=user_id, source=ImportSource.pdf, filename="f.pdf")
    db_session.add(batch)
    await db_session.commit()
    assert batch.account_id is None


async def test_import_batch_cascade_delete(db_session) -> None:
    user_id = await _make_user(db_session)
    batch = ImportBatch(user_id=user_id, source=ImportSource.pdf, filename="f.pdf")
    db_session.add(batch)
    await db_session.flush()

    record = RawImportRecord(
        batch_id=batch.id,
        raw_text="DR 500 SWIGGY",
        status=RecordStatus.pending,
    )
    db_session.add(record)
    await db_session.commit()

    # Deleting batch should cascade to records
    await db_session.delete(batch)
    await db_session.commit()

    result = await db_session.execute(
        sa.select(RawImportRecord).where(RawImportRecord.id == record.id)
    )
    assert result.scalar_one_or_none() is None


# ── RawImportRecord ───────────────────────────────────────────────────────────

async def test_create_raw_import_record(db_session) -> None:
    user_id = await _make_user(db_session)
    batch = ImportBatch(user_id=user_id, source=ImportSource.pdf, filename="f.pdf")
    db_session.add(batch)
    await db_session.flush()

    record = RawImportRecord(
        batch_id=batch.id,
        raw_text="15/01/2025 SWIGGY UPI 350.00 CR",
        parsed_json={
            "date": "2025-01-15",
            "description": "SWIGGY UPI",
            "amount": "350.00",
            "type": "expense",
        },
        status=RecordStatus.pending,
        confidence=RecordConfidence.high,
        match_type=RecordMatchType.new,
    )
    db_session.add(record)
    await db_session.commit()
    await db_session.refresh(record)

    assert record.id is not None
    assert record.status == RecordStatus.pending
    assert record.confidence == RecordConfidence.high
    assert record.match_type == RecordMatchType.new
    assert record.parsed_json["amount"] == "350.00"
    assert record.transaction_id is None


async def test_raw_import_record_all_statuses(db_session) -> None:
    user_id = await _make_user(db_session)
    batch = ImportBatch(user_id=user_id, source=ImportSource.pdf, filename="f.pdf")
    db_session.add(batch)
    await db_session.flush()

    for status in RecordStatus:
        r = RawImportRecord(batch_id=batch.id, status=status)
        db_session.add(r)
    await db_session.commit()


async def test_verification_status_values(db_session) -> None:
    user_id = await _make_user(db_session)
    for vs in VerificationStatus:
        batch = ImportBatch(
            user_id=user_id,
            source=ImportSource.pdf,
            filename="f.pdf",
            verification_status=vs,
        )
        db_session.add(batch)
    await db_session.commit()
