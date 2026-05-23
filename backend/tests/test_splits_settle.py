"""Integration tests for settle/forgive/unsettle share endpoints."""

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_account(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Bank", "type": "bank", "currency": "INR", "opening_balance": "10000.00"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_txn(client: AsyncClient, headers: dict, acc_id: str, txn_type: str, amount: str) -> str:
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": txn_type,
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": amount,
            "account_id": acc_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_split_with_two_shares(client, headers, acc_id):
    """Creates expense 300, split with share 200 + share 100. Returns (split_id, share_ids)."""
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")
    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_id": exp_id,
            "shares": [{"amount": "200.00"}, {"amount": "100.00"}],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    return data["id"], [s["id"] for s in data["shares"]]


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    acc_id = await _create_account(client, headers)
    return client, headers, acc_id


# ── Settle ────────────────────────────────────────────────────────────────────

async def test_settle_share(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"settlement_transaction_id": inc_id},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "settled"
    assert data["settlement_transaction_id"] == inc_id
    assert data["settled_at"] is not None


async def test_settle_already_settled_fails(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")
    share_id = share_ids[0]

    resp1 = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"settlement_transaction_id": inc_id},
        headers=headers,
    )
    assert resp1.status_code == 200

    inc2_id = await _create_txn(client, headers, acc_id, "income", "200.00")
    resp2 = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"settlement_transaction_id": inc2_id},
        headers=headers,
    )
    assert resp2.status_code == 422
    assert "settled" in resp2.json()["detail"].lower()


async def test_settle_forgiven_share_fails(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    # Forgive the share first
    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive", headers=headers
    )

    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")
    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"settlement_transaction_id": inc_id},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_settle_with_expense_txn_fails(authed) -> None:
    """Settlement transaction must be income type."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    exp2_id = await _create_txn(client, headers, acc_id, "expense", "100.00")
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"settlement_transaction_id": exp2_id},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "income" in resp.json()["detail"].lower()


async def test_settle_income_already_used_fails(authed) -> None:
    """Same income transaction can't settle two shares."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")

    resp1 = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_ids[0]}/settle",
        json={"settlement_transaction_id": inc_id},
        headers=headers,
    )
    assert resp1.status_code == 200

    resp2 = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_ids[1]}/settle",
        json={"settlement_transaction_id": inc_id},
        headers=headers,
    )
    assert resp2.status_code == 409


# ── Forgive ───────────────────────────────────────────────────────────────────

async def test_forgive_share(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "forgiven"
    assert data["forgiven_at"] is not None


async def test_forgive_already_settled_fails(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")

    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"settlement_transaction_id": inc_id},
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        headers=headers,
    )
    assert resp.status_code == 422


# ── Unsettle ──────────────────────────────────────────────────────────────────

async def test_unsettle_share(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")

    # Settle then unsettle
    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"settlement_transaction_id": inc_id},
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/unsettle",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert data["settled_at"] is None
    assert data["settlement_transaction_id"] is None


async def test_unsettle_pending_fails(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/unsettle",
        headers=headers,
    )
    assert resp.status_code == 422
    assert "pending" in resp.json()["detail"].lower()


async def test_unsettle_forgiven_fails(authed) -> None:
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/unsettle",
        headers=headers,
    )
    assert resp.status_code == 422


# ── Auth + not found guards ───────────────────────────────────────────────────

async def test_settle_requires_auth(client: AsyncClient, db_tables: None) -> None:
    import uuid
    sid, shid = str(uuid.uuid4()), str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/splits/{sid}/shares/{shid}/settle",
        json={"settlement_transaction_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


async def test_share_not_found(authed) -> None:
    import uuid
    client, headers, acc_id = authed
    split_id, _ = await _create_split_with_two_shares(client, headers, acc_id)

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{uuid.uuid4()}/forgive",
        headers=headers,
    )
    assert resp.status_code == 404
