"""Integration tests for /api/v1/imports endpoints."""

import io
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from tests._helpers import register_second_user


async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_account(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "HDFC", "type": "bank", "currency": "INR", "opening_balance": "10000"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _minimal_pdf_bytes() -> bytes:
    """Return the smallest possible valid PDF bytes (no real content needed for API tests)."""
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f\r\n"
        b"0000000009 00000 n\r\n"
        b"0000000058 00000 n\r\n"
        b"0000000115 00000 n\r\n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
    )


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    account_id = await _create_account(client, headers)
    return client, headers, account_id


# ── POST /imports/pdf ─────────────────────────────────────────────────────────

async def test_upload_pdf_creates_batch(authed) -> None:
    client, headers, account_id = authed
    pdf_bytes = _minimal_pdf_bytes()

    with patch("app.routers.imports.arq") as mock_arq:
        mock_pool = AsyncMock()
        mock_arq.create_pool = AsyncMock(return_value=mock_pool)
        mock_arq.connections.RedisSettings.from_dsn = lambda x: x

        resp = await client.post(
            f"/api/v1/imports/pdf?account_id={account_id}",
            files={"file": ("hdfc_jan.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            headers=headers,
        )

    assert resp.status_code == 202
    data = resp.json()
    assert data["source"] == "pdf"
    assert data["filename"] == "hdfc_jan.pdf"
    assert data["account_id"] == account_id


async def test_upload_pdf_rejects_non_pdf(authed) -> None:
    client, headers, _ = authed
    resp = await client.post(
        "/api/v1/imports/pdf",
        files={"file": ("data.csv", io.BytesIO(b"a,b,c"), "text/csv")},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_upload_pdf_rejects_empty_file(authed) -> None:
    client, headers, _ = authed
    resp = await client.post(
        "/api/v1/imports/pdf",
        files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_upload_pdf_requires_auth(client: AsyncClient, db_tables: None) -> None:
    pdf_bytes = _minimal_pdf_bytes()
    resp = await client.post(
        "/api/v1/imports/pdf",
        files={"file": ("f.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )
    assert resp.status_code == 401


# ── GET /imports ──────────────────────────────────────────────────────────────

async def test_list_batches_empty(authed) -> None:
    client, headers, _ = authed
    resp = await client.get("/api/v1/imports", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_batches_cross_user_isolation(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _setup(client, "a@x.com")
    headers_b = await register_second_user(client, headers_a, "b@x.com")
    account_id = await _create_account(client, headers_a)
    pdf_bytes = _minimal_pdf_bytes()

    with patch("app.routers.imports.arq") as mock_arq:
        mock_pool = AsyncMock()
        mock_arq.create_pool = AsyncMock(return_value=mock_pool)
        mock_arq.connections.RedisSettings.from_dsn = lambda x: x
        await client.post(
            f"/api/v1/imports/pdf?account_id={account_id}",
            files={"file": ("f.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            headers=headers_a,
        )

    resp_b = await client.get("/api/v1/imports", headers=headers_b)
    assert resp_b.json() == []


# ── GET /imports/{batch_id} ───────────────────────────────────────────────────

async def test_get_batch_not_found(authed) -> None:
    client, headers, _ = authed
    resp = await client.get(f"/api/v1/imports/{uuid.uuid4()}", headers=headers)
    assert resp.status_code == 404


# ── GET /imports/{batch_id}/records ──────────────────────────────────────────

async def test_list_records_returns_empty_for_new_batch(authed) -> None:
    client, headers, account_id = authed
    pdf_bytes = _minimal_pdf_bytes()

    with patch("app.routers.imports.arq") as mock_arq:
        mock_pool = AsyncMock()
        mock_arq.create_pool = AsyncMock(return_value=mock_pool)
        mock_arq.connections.RedisSettings.from_dsn = lambda x: x
        upload_resp = await client.post(
            f"/api/v1/imports/pdf?account_id={account_id}",
            files={"file": ("f.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            headers=headers,
        )

    batch_id = upload_resp.json()["id"]
    resp = await client.get(f"/api/v1/imports/{batch_id}/records", headers=headers)
    assert resp.status_code == 200


# ── PATCH /imports/{batch_id}/records/{record_id} ────────────────────────────

async def _create_batch_with_record(client, headers, account_id):
    """Helper: create a batch with one pending record via direct DB injection."""
    import sqlalchemy as sa

    from app.db.session import async_session_factory
    from app.models.import_batch import (
        ImportBatch,
        ImportBatchStatus,
        ImportSource,
        RawImportRecord,
    )

    async with async_session_factory() as session:
        user_result = await session.execute(
            sa.text("SELECT id FROM users LIMIT 1")
        )
        user_id = user_result.scalar_one()

        batch = ImportBatch(
            user_id=user_id,
            source=ImportSource.pdf,
            filename="test.pdf",
            account_id=uuid.UUID(account_id),
            status=ImportBatchStatus.completed,
        )
        session.add(batch)
        await session.flush()

        record = RawImportRecord(
            batch_id=batch.id,
            raw_text="15/01/25 SWIGGY 350.00",
            parsed_json={
                "date": "2025-01-15", "description": "SWIGGY",
                "amount": "350.00", "type": "expense",
            },
        )
        session.add(record)
        await session.commit()
        return str(batch.id), str(record.id)


async def test_patch_record_updates_parsed_json(authed) -> None:
    client, headers, account_id = authed
    batch_id, record_id = await _create_batch_with_record(client, headers, account_id)

    resp = await client.patch(
        f"/api/v1/imports/{batch_id}/records/{record_id}",
        json={"parsed_json": {
            "date": "2025-01-15", "description": "Swiggy Food",
            "amount": "350.00", "type": "expense",
        }},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["parsed_json"]["description"] == "Swiggy Food"


# ── POST /imports/{batch_id}/confirm ─────────────────────────────────────────

async def test_confirm_creates_transaction(authed) -> None:
    client, headers, account_id = authed
    batch_id, record_id = await _create_batch_with_record(client, headers, account_id)

    resp = await client.post(
        f"/api/v1/imports/{batch_id}/confirm",
        json={"record_ids": [record_id]},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_confirmed"] == 1


async def test_confirm_updates_account_balance(authed) -> None:
    """Regression: confirm_records used to insert the Transaction row without
    ever crediting/debiting the account — balance stayed frozen at whatever
    it was before the import. Since balance is now computed from the ledger
    (not a maintained column), this is really testing that the confirmed
    transaction is visible to that computation at all."""
    client, headers, account_id = authed
    batch_id, record_id = await _create_batch_with_record(client, headers, account_id)

    await client.post(
        f"/api/v1/imports/{batch_id}/confirm",
        json={"record_ids": [record_id]},
        headers=headers,
    )

    acc = (await client.get(f"/api/v1/accounts/{account_id}", headers=headers)).json()
    assert acc["current_balance"] == "9650.00"  # 10000 opening - 350 expense


async def test_confirm_localizes_date_to_user_timezone(authed) -> None:
    """Regression: a statement's date-only field ("2025-01-15") was attached
    tzinfo=UTC directly, treating it as midnight UTC. For any timezone ahead
    of UTC (the default UserSettings.timezone is Asia/Kolkata, UTC+5:30)
    that's ~5.5h after the user's real local midnight — enough to push a
    transaction dated exactly on a period boundary to the wrong side of it.
    Must localize to the user's own configured timezone instead."""
    client, headers, account_id = authed
    batch_id, record_id = await _create_batch_with_record(client, headers, account_id)

    resp = await client.post(
        f"/api/v1/imports/{batch_id}/confirm",
        json={"record_ids": [record_id]},
        headers=headers,
    )
    confirm_data = resp.json()
    assert confirm_data["total_confirmed"] == 1

    txns = (await client.get(
        "/api/v1/transactions", params={"account_id": account_id}, headers=headers,
    )).json()["items"]
    swiggy = next(t for t in txns if t["description"] == "SWIGGY")
    # 2025-01-15 local midnight in Asia/Kolkata (UTC+5:30) == 2025-01-14T18:30:00Z
    assert swiggy["transacted_at"] == "2025-01-14T18:30:00Z"


async def test_replace_existing_updates_account_balance(authed) -> None:
    """Regression: replace_existing soft-deleted the old transaction and added
    the new one without ever touching account balance, so it stayed frozen
    unless old/new amounts happened to match exactly."""
    import sqlalchemy as sa

    from app.db.session import async_session_factory
    from app.models.import_batch import (
        ImportBatch,
        ImportBatchStatus,
        ImportSource,
        RawImportRecord,
        RecordStatus,
    )

    client, headers, account_id = authed

    # An existing manually-entered expense that's about to be replaced by a
    # more accurate imported record with a DIFFERENT amount (e.g. a bank fee
    # the manual entry missed) — this is exactly the scenario that silently
    # desynced real account balances.
    old_txn_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense", "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "300.00", "account_id": account_id,
        },
        headers=headers,
    )
    old_txn_id = old_txn_resp.json()["id"]

    async with async_session_factory() as session:
        user_result = await session.execute(sa.text("SELECT id FROM users LIMIT 1"))
        user_id = user_result.scalar_one()

        batch = ImportBatch(
            user_id=user_id,
            source=ImportSource.pdf,
            filename="replace.pdf",
            account_id=uuid.UUID(account_id),
            status=ImportBatchStatus.completed,
        )
        session.add(batch)
        await session.flush()

        record = RawImportRecord(
            batch_id=batch.id,
            raw_text="line",
            parsed_json={
                "date": "2026-01-15", "description": "SWIGGY",
                "amount": "325.00", "type": "expense",
            },
            status=RecordStatus.duplicate,
        )
        session.add(record)
        await session.commit()
        batch_id = str(batch.id)
        record_id = str(record.id)

    resp = await client.post(
        f"/api/v1/imports/{batch_id}/records/{record_id}/replace",
        json={"transaction_ids": [old_txn_id]},
        headers=headers,
    )
    assert resp.status_code == 200

    acc = (await client.get(f"/api/v1/accounts/{account_id}", headers=headers)).json()
    assert acc["current_balance"] == "9675.00"  # 10000 opening - 325 (not 300)

    # GET excludes soft-deleted transactions by default.
    old_txn_resp = await client.get(f"/api/v1/transactions/{old_txn_id}", headers=headers)
    assert old_txn_resp.status_code == 404


async def test_confirm_force_flag_confirms_duplicates(authed) -> None:
    client, headers, account_id = authed

    import sqlalchemy as sa

    from app.db.session import async_session_factory
    from app.models.import_batch import (
        ImportBatch,
        ImportBatchStatus,
        ImportSource,
        RawImportRecord,
        RecordStatus,
    )

    async with async_session_factory() as session:
        user_result = await session.execute(sa.text("SELECT id FROM users LIMIT 1"))
        user_id = user_result.scalar_one()

        batch = ImportBatch(
            user_id=user_id,
            source=ImportSource.pdf,
            filename="dup.pdf",
            account_id=uuid.UUID(account_id),
            status=ImportBatchStatus.completed,
        )
        session.add(batch)
        await session.flush()

        record = RawImportRecord(
            batch_id=batch.id,
            raw_text="line",
            parsed_json={
                "date": "2025-01-15", "description": "SWIGGY",
                "amount": "350.00", "type": "expense",
            },
            status=RecordStatus.duplicate,
        )
        session.add(record)
        await session.commit()
        dup_batch_id = str(batch.id)
        dup_record_id = str(record.id)

    # Without force: 0 confirmed
    resp = await client.post(
        f"/api/v1/imports/{dup_batch_id}/confirm",
        json={"record_ids": [dup_record_id], "force": False},
        headers=headers,
    )
    assert resp.json()["total_confirmed"] == 0

    # With force: 1 confirmed
    resp = await client.post(
        f"/api/v1/imports/{dup_batch_id}/confirm",
        json={"record_ids": [dup_record_id], "force": True},
        headers=headers,
    )
    assert resp.json()["total_confirmed"] == 1


# ── POST /imports/{batch_id}/reject ──────────────────────────────────────────

async def test_reject_records(authed) -> None:
    client, headers, account_id = authed
    batch_id, record_id = await _create_batch_with_record(client, headers, account_id)

    resp = await client.post(
        f"/api/v1/imports/{batch_id}/reject",
        json={"record_ids": [record_id]},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total_rejected"] == 1


async def test_reject_all_pending(authed) -> None:
    client, headers, account_id = authed
    batch_id, record_id = await _create_batch_with_record(client, headers, account_id)

    # Reject all (no record_ids = all pending)
    resp = await client.post(
        f"/api/v1/imports/{batch_id}/reject",
        json={},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total_rejected"] == 1
