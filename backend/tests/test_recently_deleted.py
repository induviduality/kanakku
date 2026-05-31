"""Integration tests for /api/v1/recently-deleted and budget restore."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account

from tests._helpers import register_second_user


async def _auth(client: AsyncClient, email: str = "admin@example.com") -> dict[str, str]:
    resp = await client.post(
        "/api/v1/auth/setup",
        json={"email": email, "password": "password123"},
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    return client, await _auth(client)


# ── GET /recently-deleted ────────────────────────────────────────────────────

async def test_recently_deleted_empty(authed) -> None:
    client, headers = authed
    resp = await client.get("/api/v1/recently-deleted", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["items"] == []


async def test_recently_deleted_shows_deleted_account(authed) -> None:
    client, headers = authed
    # Create then delete an account
    r = await client.post("/api/v1/accounts", json={"name": "Test Bank", "type": "bank", "currency": "INR"}, headers=headers)
    acc_id = r.json()["id"]
    await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)

    resp = await client.get("/api/v1/recently-deleted", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(i["id"] == acc_id and i["entity_type"] == "accounts" for i in items)


async def test_recently_deleted_excludes_old_items(authed, db_session: AsyncSession) -> None:
    client, headers = authed
    # Create and delete an account
    r = await client.post("/api/v1/accounts", json={"name": "Old Bank", "type": "bank", "currency": "INR"}, headers=headers)
    acc_id = r.json()["id"]
    await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)

    # Backdate the deleted_at to 31 days ago
    old_time = datetime.now(UTC) - timedelta(days=31)
    import uuid
    await db_session.execute(
        update(Account).where(Account.id == uuid.UUID(acc_id)).values(deleted_at=old_time)
    )
    await db_session.commit()

    resp = await client.get("/api/v1/recently-deleted", headers=headers)
    items = resp.json()["items"]
    assert not any(i["id"] == acc_id for i in items)


async def test_recently_deleted_requires_auth(client: AsyncClient, db_tables: None) -> None:
    resp = await client.get("/api/v1/recently-deleted")
    assert resp.status_code == 401


async def test_recently_deleted_cross_user_isolation(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _auth(client, "a@example.com")
    headers_b = await register_second_user(client, headers_a, "b@example.com")

    r = await client.post("/api/v1/accounts", json={"name": "A Bank", "type": "bank", "currency": "INR"}, headers=headers_a)
    acc_id = r.json()["id"]
    await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers_a)

    resp = await client.get("/api/v1/recently-deleted", headers=headers_b)
    items = resp.json()["items"]
    assert not any(i["id"] == acc_id for i in items)


# ── Budget restore ────────────────────────────────────────────────────────────

async def test_restore_budget(authed) -> None:
    client, headers = authed
    r = await client.post(
        "/api/v1/budgets",
        json={"name": "Groceries", "amount": "5000", "currency": "INR", "type": "adhoc"},
        headers=headers,
    )
    assert r.status_code == 201
    bid = r.json()["id"]

    # Delete then restore
    await client.delete(f"/api/v1/budgets/{bid}", headers=headers)
    resp = await client.post(f"/api/v1/budgets/{bid}/restore", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["deleted_at"] is None


async def test_restore_budget_not_found(authed) -> None:
    import uuid
    client, headers = authed
    resp = await client.post(f"/api/v1/budgets/{uuid.uuid4()}/restore", headers=headers)
    assert resp.status_code == 404


async def test_restore_budget_not_deleted(authed) -> None:
    client, headers = authed
    r = await client.post(
        "/api/v1/budgets",
        json={"name": "Groceries", "amount": "5000", "currency": "INR", "type": "adhoc"},
        headers=headers,
    )
    bid = r.json()["id"]
    resp = await client.post(f"/api/v1/budgets/{bid}/restore", headers=headers)
    assert resp.status_code == 400


# ── Purge worker ──────────────────────────────────────────────────────────────

async def test_purge_soft_deleted(authed, db_session: AsyncSession) -> None:
    client, headers = authed
    # Create and delete an account
    r = await client.post("/api/v1/accounts", json={"name": "Old", "type": "bank", "currency": "INR"}, headers=headers)
    acc_id = r.json()["id"]
    await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)

    # Backdate to beyond window
    import uuid
    old_time = datetime.now(UTC) - timedelta(days=31)
    await db_session.execute(
        update(Account).where(Account.id == uuid.UUID(acc_id)).values(deleted_at=old_time)
    )
    await db_session.commit()

    from app.workers.purge_worker import purge_soft_deleted
    totals = await purge_soft_deleted({})
    assert totals.get("accounts", 0) >= 1

    # Verify gone from DB
    from sqlalchemy import select
    row = (await db_session.execute(select(Account).where(Account.id == uuid.UUID(acc_id)))).scalar_one_or_none()
    # After purge, row should not exist
    assert row is None
