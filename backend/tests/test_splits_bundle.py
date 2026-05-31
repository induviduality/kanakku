"""Integration tests for POST /api/v1/splits/bundle."""

import pytest
from httpx import AsyncClient

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_account(client: AsyncClient, headers: dict, name: str = "Bank") -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": name, "type": "bank", "currency": "INR", "opening_balance": "10000.00"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_txn(
    client: AsyncClient, headers: dict, acc_id: str, txn_type: str, amount: str
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


# ── Happy paths ───────────────────────────────────────────────────────────────

async def test_bundle_expense_only(authed) -> None:
    """Expense with no income legs and no forgiven → single user share."""
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")

    resp = await client.post(
        "/api/v1/splits/bundle",
        json={"expense_transaction_id": exp_id},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["shares"]) == 1
    assert data["shares"][0]["amount"] == "300.00"
    assert data["shares"][0]["status"] == "pending"


async def test_bundle_with_income_leg(authed) -> None:
    """Expense 300, income leg 200 → settled share 200 + user own 100."""
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")

    resp = await client.post(
        "/api/v1/splits/bundle",
        json={
            "expense_transaction_id": exp_id,
            "income_transaction_ids": [inc_id],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    shares = data["shares"]
    assert len(shares) == 2
    settled = [s for s in shares if s["status"] == "settled"]
    pending = [s for s in shares if s["status"] == "pending"]
    assert len(settled) == 1
    assert settled[0]["amount"] == "200.00"
    assert settled[0]["paid_amount"] == "200.00"
    assert settled[0]["settlements"][0]["transaction_id"] == inc_id
    assert pending[0]["amount"] == "100.00"


async def test_bundle_with_forgiven_share(authed) -> None:
    """Expense 300, forgiven 100 → forgiven share 100 + user own 200."""
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")

    resp = await client.post(
        "/api/v1/splits/bundle",
        json={
            "expense_transaction_id": exp_id,
            "forgiven_shares": [{"amount": "100.00"}],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    shares = data["shares"]
    forgiven = [s for s in shares if s["status"] == "forgiven"]
    pending = [s for s in shares if s["status"] == "pending"]
    assert forgiven[0]["amount"] == "100.00"
    assert pending[0]["amount"] == "200.00"


async def test_bundle_zero_remainder(authed) -> None:
    """Income legs cover entire expense → no user share row created."""
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")
    inc_id = await _create_txn(client, headers, acc_id, "income", "300.00")

    resp = await client.post(
        "/api/v1/splits/bundle",
        json={
            "expense_transaction_id": exp_id,
            "income_transaction_ids": [inc_id],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["shares"]) == 1
    assert data["shares"][0]["status"] == "settled"


# ── Error cases ───────────────────────────────────────────────────────────────

async def test_bundle_sum_over_expense(authed) -> None:
    """Income + forgiven > expense → 422."""
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")

    resp = await client.post(
        "/api/v1/splits/bundle",
        json={
            "expense_transaction_id": exp_id,
            "income_transaction_ids": [inc_id],
            "forgiven_shares": [{"amount": "150.00"}],
        },
        headers=headers,
    )
    assert resp.status_code == 422
    assert "exceed" in resp.json()["detail"].lower()


async def test_bundle_already_has_split(authed) -> None:
    """Expense already bundled → 409."""
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")

    payload = {"expense_transaction_id": exp_id}
    resp1 = await client.post("/api/v1/splits/bundle", json=payload, headers=headers)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/splits/bundle", json=payload, headers=headers)
    assert resp2.status_code == 409


async def test_bundle_nonexistent_expense(authed) -> None:
    import uuid
    client, headers, _ = authed
    resp = await client.post(
        "/api/v1/splits/bundle",
        json={"expense_transaction_id": str(uuid.uuid4())},
        headers=headers,
    )
    assert resp.status_code == 404


async def test_bundle_nonexistent_income_leg(authed) -> None:
    import uuid
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")

    resp = await client.post(
        "/api/v1/splits/bundle",
        json={
            "expense_transaction_id": exp_id,
            "income_transaction_ids": [str(uuid.uuid4())],
        },
        headers=headers,
    )
    assert resp.status_code == 404


async def test_bundle_income_leg_already_linked(authed) -> None:
    """Income transaction already used as a settlement → 409."""
    client, headers, acc_id = authed
    exp1_id = await _create_txn(client, headers, acc_id, "expense", "300.00")
    exp2_id = await _create_txn(client, headers, acc_id, "expense", "200.00")
    inc_id = await _create_txn(client, headers, acc_id, "income", "200.00")

    # Bundle first expense with the income leg
    resp1 = await client.post(
        "/api/v1/splits/bundle",
        json={"expense_transaction_id": exp1_id, "income_transaction_ids": [inc_id]},
        headers=headers,
    )
    # exp1 = 300, inc leg = 200, user own = 100 → OK
    assert resp1.status_code == 201

    # Try to use same income leg for second expense
    resp2 = await client.post(
        "/api/v1/splits/bundle",
        json={"expense_transaction_id": exp2_id, "income_transaction_ids": [inc_id]},
        headers=headers,
    )
    assert resp2.status_code == 409


async def test_bundle_non_income_leg_rejected(authed) -> None:
    """Passing an expense txn as income_transaction_id → 422."""
    client, headers, acc_id = authed
    exp_id = await _create_txn(client, headers, acc_id, "expense", "300.00")
    exp2_id = await _create_txn(client, headers, acc_id, "expense", "100.00")

    resp = await client.post(
        "/api/v1/splits/bundle",
        json={
            "expense_transaction_id": exp_id,
            "income_transaction_ids": [exp2_id],
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_bundle_requires_auth(client: AsyncClient, db_tables: None) -> None:
    import uuid
    resp = await client.post(
        "/api/v1/splits/bundle",
        json={"expense_transaction_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401
