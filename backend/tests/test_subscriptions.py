"""Integration tests for /api/v1/subscriptions."""

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
        json={"name": "Main", "type": "bank", "currency": "INR", "opening_balance": "0"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_subscription(
    client: AsyncClient, headers: dict, account_id: str, **overrides
) -> dict:
    payload = {
        "name": "Netflix",
        "amount": "649.00",
        "currency": "INR",
        "billing_cycle": "monthly",
        "billing_day": 15,
        "account_id": account_id,
        "is_active": True,
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/subscriptions", json=payload, headers=headers)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    account_id = await _create_account(client, headers)
    return client, headers, account_id


# ── POST /subscriptions ───────────────────────────────────────────────────────

async def test_create_subscription(authed) -> None:
    client, headers, account_id = authed
    data = await _create_subscription(client, headers, account_id)
    assert data["name"] == "Netflix"
    assert data["amount"] == "649.00"
    assert data["billing_cycle"] == "monthly"
    assert data["billing_day"] == 15
    assert data["is_active"] is True
    assert data["next_billing_date"] is not None
    assert data["status"] in ("upcoming", "due_soon", "overdue")


async def test_create_subscription_all_fields(authed) -> None:
    client, headers, account_id = authed
    data = await _create_subscription(
        client,
        headers,
        account_id,
        name="Spotify",
        billing_cycle="yearly",
        billing_day=1,
        url="https://spotify.com",
        notes="Family plan",
    )
    assert data["url"] == "https://spotify.com"
    assert data["notes"] == "Family plan"
    assert data["billing_cycle"] == "yearly"


async def test_create_subscription_invalid_amount(authed) -> None:
    client, headers, account_id = authed
    resp = await client.post(
        "/api/v1/subscriptions",
        json={
            "name": "Bad",
            "amount": "-10",
            "currency": "INR",
            "billing_cycle": "monthly",
            "billing_day": 1,
            "account_id": account_id,
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_subscription_auth_guard(client: AsyncClient, db_tables: None) -> None:
    resp = await client.post(
        "/api/v1/subscriptions",
        json={
            "name": "X",
            "amount": "10",
            "currency": "INR",
            "billing_cycle": "monthly",
            "billing_day": 1,
            "account_id": "00000000-0000-0000-0000-000000000000",
        },
    )
    assert resp.status_code == 401


# ── GET /subscriptions ────────────────────────────────────────────────────────

async def test_list_subscriptions_active_only(authed) -> None:
    client, headers, account_id = authed
    await _create_subscription(client, headers, account_id, name="Active")
    await _create_subscription(client, headers, account_id, name="Inactive", is_active=False)

    resp = await client.get("/api/v1/subscriptions", headers=headers)
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "Active" in names
    assert "Inactive" not in names


async def test_list_subscriptions_include_inactive(authed) -> None:
    client, headers, account_id = authed
    await _create_subscription(client, headers, account_id, name="Active")
    await _create_subscription(client, headers, account_id, name="Inactive", is_active=False)

    resp = await client.get(
        "/api/v1/subscriptions", params={"include_inactive": True}, headers=headers
    )
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "Active" in names
    assert "Inactive" in names


async def test_list_subscriptions_cross_user_isolation(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _setup(client, "a@example.com")
    headers_b = await register_second_user(client, headers_a, "b@example.com")

    acc_a_resp = await client.post(
        "/api/v1/accounts",
        json={"name": "A", "type": "bank", "currency": "INR", "opening_balance": "0"},
        headers=headers_a,
    )
    acc_a = acc_a_resp.json()["id"]
    await _create_subscription(client, headers_a, acc_a)

    resp = await client.get("/api/v1/subscriptions", headers=headers_b)
    assert resp.json() == []


# ── GET /subscriptions/{id} ───────────────────────────────────────────────────

async def test_get_subscription(authed) -> None:
    client, headers, account_id = authed
    created = await _create_subscription(client, headers, account_id)
    resp = await client.get(f"/api/v1/subscriptions/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


async def test_get_subscription_404(authed) -> None:
    client, headers, _ = authed
    resp = await client.get(
        "/api/v1/subscriptions/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert resp.status_code == 404


async def test_get_subscription_cross_user_404(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _setup(client, "a@example.com")
    headers_b = await register_second_user(client, headers_a, "b@example.com")
    acc_resp = await client.post(
        "/api/v1/accounts",
        json={"name": "A", "type": "bank", "currency": "INR", "opening_balance": "0"},
        headers=headers_a,
    )
    acc_id = acc_resp.json()["id"]
    sub = await _create_subscription(client, headers_a, acc_id)

    resp = await client.get(f"/api/v1/subscriptions/{sub['id']}", headers=headers_b)
    assert resp.status_code == 404


# ── PATCH /subscriptions/{id} ─────────────────────────────────────────────────

async def test_patch_subscription(authed) -> None:
    client, headers, account_id = authed
    sub = await _create_subscription(client, headers, account_id)

    resp = await client.patch(
        f"/api/v1/subscriptions/{sub['id']}",
        json={"name": "Netflix Premium", "amount": "799.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Netflix Premium"
    assert data["amount"] == "799.00"


# ── DELETE /subscriptions/{id} ────────────────────────────────────────────────

async def test_delete_subscription(authed) -> None:
    client, headers, account_id = authed
    sub = await _create_subscription(client, headers, account_id)

    resp = await client.delete(f"/api/v1/subscriptions/{sub['id']}", headers=headers)
    assert resp.status_code == 204

    resp = await client.get(f"/api/v1/subscriptions/{sub['id']}", headers=headers)
    assert resp.status_code == 404


async def test_restore_subscription(authed) -> None:
    client, headers, account_id = authed
    sub = await _create_subscription(client, headers, account_id)

    await client.delete(f"/api/v1/subscriptions/{sub['id']}", headers=headers)

    resp = await client.post(f"/api/v1/subscriptions/{sub['id']}/restore", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["deleted_at"] is None


# ── Link transaction ──────────────────────────────────────────────────────────

async def _create_txn(client: AsyncClient, headers: dict, account_id: str) -> dict:
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-05-15T10:00:00Z",
            "amount": "649.00",
            "currency": "INR",
            "account_id": account_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


async def test_link_transaction(authed) -> None:
    client, headers, account_id = authed
    sub = await _create_subscription(client, headers, account_id)
    txn = await _create_txn(client, headers, account_id)

    resp = await client.post(
        f"/api/v1/subscriptions/{sub['id']}/link-transaction",
        json={"transaction_id": txn["id"]},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["subscription_id"] == sub["id"]


async def test_link_transaction_cross_user_404(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _setup(client, "a@example.com")
    headers_b = await register_second_user(client, headers_a, "b@example.com")

    acc_a = (
        await client.post(
            "/api/v1/accounts",
            json={"name": "A", "type": "bank", "currency": "INR", "opening_balance": "0"},
            headers=headers_a,
        )
    ).json()["id"]
    acc_b = (
        await client.post(
            "/api/v1/accounts",
            json={"name": "B", "type": "bank", "currency": "INR", "opening_balance": "0"},
            headers=headers_b,
        )
    ).json()["id"]

    sub_a = await _create_subscription(client, headers_a, acc_a)
    txn_b = await _create_txn(client, headers_b, acc_b)

    # User A tries to link user B's transaction → 404
    resp = await client.post(
        f"/api/v1/subscriptions/{sub_a['id']}/link-transaction",
        json={"transaction_id": txn_b["id"]},
        headers=headers_a,
    )
    assert resp.status_code == 404


# ── GET /subscriptions/{id}/history ──────────────────────────────────────────

async def test_history(authed) -> None:
    client, headers, account_id = authed
    sub = await _create_subscription(client, headers, account_id)
    txn = await _create_txn(client, headers, account_id)

    await client.post(
        f"/api/v1/subscriptions/{sub['id']}/link-transaction",
        json={"transaction_id": txn["id"]},
        headers=headers,
    )

    resp = await client.get(f"/api/v1/subscriptions/{sub['id']}/history", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == txn["id"]


async def test_history_empty(authed) -> None:
    client, headers, account_id = authed
    sub = await _create_subscription(client, headers, account_id)

    resp = await client.get(f"/api/v1/subscriptions/{sub['id']}/history", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


# ── Transaction subscription_id ───────────────────────────────────────────────

async def test_create_transaction_with_subscription_id(authed) -> None:
    client, headers, account_id = authed
    sub = await _create_subscription(client, headers, account_id)

    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-05-15T10:00:00Z",
            "amount": "649.00",
            "currency": "INR",
            "account_id": account_id,
            "subscription_id": sub["id"],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["subscription_id"] == sub["id"]
