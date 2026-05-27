"""Integration tests for POST /api/v1/splits."""

import pytest
from httpx import AsyncClient


# ── Fixtures ──────────────────────────────────────────────────────────────────

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


async def _create_transaction(
    client: AsyncClient, headers: dict, acc_id: str, txn_type: str = "expense", amount: str = "300.00"
) -> str:
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


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    acc_id = await _create_account(client, headers)
    return client, headers, acc_id


# ── Happy path ────────────────────────────────────────────────────────────────

async def test_create_split_happy_path(authed) -> None:
    client, headers, acc_id = authed
    txn_id = await _create_transaction(client, headers, acc_id, amount="300.00")

    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_id": txn_id,
            "notes": "dinner split",
            "shares": [
                {"amount": "200.00", "notes": "my share"},
                {"amount": "100.00"},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["expense_transaction_id"] == txn_id
    assert data["notes"] == "dinner split"
    assert len(data["shares"]) == 2
    amounts = {s["amount"] for s in data["shares"]}
    assert amounts == {"200.00", "100.00"}
    for share in data["shares"]:
        assert share["status"] == "pending"
        assert share["paid_amount"] == "0.00"
        assert share["forgiven_amount"] == "0.00"
        assert share["settlements"] == []


async def test_get_split(authed) -> None:
    client, headers, acc_id = authed
    txn_id = await _create_transaction(client, headers, acc_id, amount="500.00")

    create_resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_id": txn_id,
            "shares": [{"amount": "300.00"}, {"amount": "200.00"}],
        },
        headers=headers,
    )
    assert create_resp.status_code == 201
    split_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/splits/{split_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == split_id
    assert len(get_resp.json()["shares"]) == 2


# ── Validation errors ─────────────────────────────────────────────────────────

async def test_create_split_sum_mismatch(authed) -> None:
    client, headers, acc_id = authed
    txn_id = await _create_transaction(client, headers, acc_id, amount="300.00")

    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_id": txn_id,
            "shares": [{"amount": "200.00"}],  # only 200 of 300
        },
        headers=headers,
    )
    assert resp.status_code == 422
    assert "does not equal" in resp.json()["detail"]


async def test_create_split_income_transaction_rejected(authed) -> None:
    client, headers, acc_id = authed
    txn_id = await _create_transaction(client, headers, acc_id, txn_type="income", amount="300.00")

    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_id": txn_id,
            "shares": [{"amount": "300.00"}],
        },
        headers=headers,
    )
    assert resp.status_code == 422
    assert "expense" in resp.json()["detail"].lower()


async def test_create_split_transfer_transaction_rejected(authed) -> None:
    client, headers, acc_id = authed
    acc2_resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Savings", "type": "bank", "currency": "INR", "opening_balance": "0.00"},
        headers=headers,
    )
    acc2_id = acc2_resp.json()["id"]

    resp_txn = await client.post(
        "/api/v1/transactions",
        json={
            "type": "transfer",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "300.00",
            "account_id": acc_id,
            "to_account_id": acc2_id,
        },
        headers=headers,
    )
    assert resp_txn.status_code == 201
    txn_id = resp_txn.json()["id"]

    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_id": txn_id,
            "shares": [{"amount": "300.00"}],
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_split_nonexistent_transaction(authed) -> None:
    client, headers, _ = authed
    import uuid
    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_id": str(uuid.uuid4()),
            "shares": [{"amount": "300.00"}],
        },
        headers=headers,
    )
    assert resp.status_code == 404


async def test_create_split_duplicate_rejected(authed) -> None:
    client, headers, acc_id = authed
    txn_id = await _create_transaction(client, headers, acc_id, amount="300.00")

    payload = {
        "expense_transaction_id": txn_id,
        "shares": [{"amount": "300.00"}],
    }
    resp1 = await client.post("/api/v1/splits", json=payload, headers=headers)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/splits", json=payload, headers=headers)
    assert resp2.status_code == 409


async def test_create_split_empty_shares_rejected(authed) -> None:
    client, headers, acc_id = authed
    txn_id = await _create_transaction(client, headers, acc_id, amount="300.00")

    resp = await client.post(
        "/api/v1/splits",
        json={"expense_transaction_id": txn_id, "shares": []},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_split_requires_auth(client: AsyncClient, db_tables: None) -> None:
    import uuid
    resp = await client.post(
        "/api/v1/splits",
        json={"expense_transaction_id": str(uuid.uuid4()), "shares": [{"amount": "100.00"}]},
    )
    assert resp.status_code == 401


async def test_get_split_cross_user_404(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _setup(client, "a@example.com")
    headers_b = await _setup(client, "b@example.com")

    acc_id = await _create_account(client, headers_a)
    txn_id = await _create_transaction(client, headers_a, acc_id, amount="100.00")
    split_resp = await client.post(
        "/api/v1/splits",
        json={"expense_transaction_id": txn_id, "shares": [{"amount": "100.00"}]},
        headers=headers_a,
    )
    split_id = split_resp.json()["id"]

    resp = await client.get(f"/api/v1/splits/{split_id}", headers=headers_b)
    assert resp.status_code == 404
