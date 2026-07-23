"""Integration tests for /api/v1/accounts."""

import pytest
from httpx import AsyncClient


async def _auth_token(client: AsyncClient, email: str = "admin@example.com") -> str:
    resp = await client.post(
        "/api/v1/auth/setup",
        json={"email": email, "password": "password123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


@pytest.fixture
async def setup_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    return client


@pytest.fixture
async def authed(setup_client: AsyncClient):
    token = await _auth_token(setup_client)
    return setup_client, {"Authorization": f"Bearer {token}"}


# ── Create ──────────────────────────────────────────────────────────────────

async def test_create_account_basic(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "HDFC Savings", "type": "bank", "currency": "INR"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "HDFC Savings"
    assert data["type"] == "bank"
    assert data["currency"] == "INR"
    assert data["opening_balance"] == "0.00"
    assert data["current_balance"] == "0.00"
    assert data["is_active"] is True
    assert data["deleted_at"] is None


async def test_create_account_currency_defaults_from_settings(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Cash Wallet", "type": "cash"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["currency"] == "INR"  # user settings default


async def test_create_account_with_opening_balance(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Savings", "type": "bank", "currency": "INR", "opening_balance": "10000.50"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["opening_balance"] == "10000.50"
    assert data["current_balance"] == "10000.50"


async def test_create_credit_card_with_outstanding_seeds_debt(authed) -> None:
    """Credit-cards review §5 (approach a): a card's outstanding is entered as
    a positive opening_balance and shows up as a negative computed balance
    (money owed), not a positive credit."""
    client, headers = authed
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "HDFC Credit Card", "type": "credit_card", "currency": "INR",
              "opening_balance": "8000.00"},
        headers=headers,
    )
    assert resp.status_code == 201
    account_id = resp.json()["id"]

    acc = (await client.get(f"/api/v1/accounts/{account_id}", headers=headers)).json()
    assert acc["current_balance"] == "-8000.00"  # owed, not held


async def test_opening_balance_on_liability_allowed_via_transactions(authed) -> None:
    """The old application guard blocking opening_balance on liability accounts
    is gone; a manual opening_balance on a card is accepted and debits it."""
    client, headers = authed
    card_id = (await client.post(
        "/api/v1/accounts",
        json={"name": "Card", "type": "credit_card", "currency": "INR"},
        headers=headers,
    )).json()["id"]

    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "opening_balance", "transacted_at": "2026-01-01T00:00:00Z",
              "amount": "5000.00", "account_id": card_id},
        headers=headers,
    )
    assert resp.status_code == 201

    acc = (await client.get(f"/api/v1/accounts/{card_id}", headers=headers)).json()
    assert acc["current_balance"] == "-5000.00"


async def test_create_account_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/accounts",
        json={"name": "Savings", "type": "bank"},
    )
    assert resp.status_code == 401


# ── List ────────────────────────────────────────────────────────────────────

async def test_list_accounts_excludes_deleted_by_default(authed) -> None:
    client, headers = authed
    resp1 = await client.post(
        "/api/v1/accounts",
        json={"name": "A", "type": "cash"},
        headers=headers,
    )
    acc_id = resp1.json()["id"]
    await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)

    resp = await client.get("/api/v1/accounts", headers=headers)
    ids = [a["id"] for a in resp.json()]
    assert acc_id not in ids


async def test_list_accounts_include_deleted(authed) -> None:
    client, headers = authed
    resp1 = await client.post(
        "/api/v1/accounts",
        json={"name": "A", "type": "cash"},
        headers=headers,
    )
    acc_id = resp1.json()["id"]
    await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)

    resp = await client.get(
        "/api/v1/accounts", params={"include_deleted": True}, headers=headers
    )
    ids = [a["id"] for a in resp.json()]
    assert acc_id in ids


# ── Get ─────────────────────────────────────────────────────────────────────

async def test_get_account(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/accounts",
        json={"name": "Loan", "type": "loan", "currency": "INR"},
        headers=headers,
    )
    acc_id = create.json()["id"]
    resp = await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == acc_id


async def test_get_account_404_for_other_user(setup_client: AsyncClient, db_tables) -> None:
    # Create user A and their account
    resp_a = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "a@example.com", "password": "password123"},
    )
    token_a = resp_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    create = await setup_client.post(
        "/api/v1/accounts",
        json={"name": "Private", "type": "bank"},
        headers=headers_a,
    )
    acc_id = create.json()["id"]

    # Create user B via invite
    inv = await setup_client.post(
        "/api/v1/auth/invites", json={}, headers=headers_a
    )
    token_raw = inv.json()["token"]
    acc_resp = await setup_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token_raw, "email": "b@example.com", "password": "password123"},
    )
    token_b = acc_resp.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    resp = await setup_client.get(f"/api/v1/accounts/{acc_id}", headers=headers_b)
    assert resp.status_code == 404


# ── Patch ───────────────────────────────────────────────────────────────────

async def test_patch_account(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/accounts",
        json={"name": "Old Name", "type": "bank"},
        headers=headers,
    )
    acc_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/accounts/{acc_id}",
        json={"name": "New Name", "is_active": False},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["is_active"] is False


# ── Soft delete & restore ───────────────────────────────────────────────────

async def test_soft_delete_account(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/accounts", json={"name": "X", "type": "cash"}, headers=headers
    )
    acc_id = create.json()["id"]

    del_resp = await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)
    assert get_resp.status_code == 404


async def test_restore_account(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/accounts", json={"name": "X", "type": "cash"}, headers=headers
    )
    acc_id = create.json()["id"]
    await client.delete(f"/api/v1/accounts/{acc_id}", headers=headers)

    restore = await client.post(
        f"/api/v1/accounts/{acc_id}/restore", headers=headers
    )
    assert restore.status_code == 200
    assert restore.json()["deleted_at"] is None

    get_resp = await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)
    assert get_resp.status_code == 200


async def test_restore_non_deleted_account_returns_400(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/accounts", json={"name": "X", "type": "cash"}, headers=headers
    )
    acc_id = create.json()["id"]
    resp = await client.post(f"/api/v1/accounts/{acc_id}/restore", headers=headers)
    assert resp.status_code == 400
