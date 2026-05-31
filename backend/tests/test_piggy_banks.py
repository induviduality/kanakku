"""Integration tests for /api/v1/piggy-banks."""

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


async def _create_piggy(
    client: AsyncClient, headers: dict, **overrides
) -> dict:
    payload = {
        "name": "Europe Trip",
        "target_amount": "200000.00",
        "currency": "INR",
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/piggy-banks", json=payload, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _create_txn(client: AsyncClient, headers: dict, account_id: str, amount: str = "5000.00") -> dict:
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-05-15T10:00:00Z",
            "amount": amount,
            "currency": "INR",
            "account_id": account_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    account_id = await _create_account(client, headers)
    return client, headers, account_id


# ── POST /piggy-banks ─────────────────────────────────────────────────────────

async def test_create_piggy_bank(authed) -> None:
    client, headers, _ = authed
    data = await _create_piggy(client, headers)
    assert data["name"] == "Europe Trip"
    assert data["target_amount"] == "200000.00"
    assert data["current_amount"] == "0.00"
    assert data["is_completed"] is False
    assert data["progress_pct"] == 0.0


async def test_create_piggy_bank_with_target_date(authed) -> None:
    client, headers, _ = authed
    data = await _create_piggy(client, headers, target_date="2027-12-31", notes="Holiday savings")
    assert data["target_date"] == "2027-12-31"
    assert data["notes"] == "Holiday savings"


async def test_create_piggy_bank_invalid_target(authed) -> None:
    client, headers, _ = authed
    resp = await client.post(
        "/api/v1/piggy-banks",
        json={"name": "Bad", "target_amount": "0", "currency": "INR"},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_piggy_bank_auth_guard(client: AsyncClient, db_tables: None) -> None:
    resp = await client.post(
        "/api/v1/piggy-banks",
        json={"name": "X", "target_amount": "1000", "currency": "INR"},
    )
    assert resp.status_code == 401


# ── GET /piggy-banks ──────────────────────────────────────────────────────────

async def test_list_piggy_banks(authed) -> None:
    client, headers, _ = authed
    await _create_piggy(client, headers, name="A")
    await _create_piggy(client, headers, name="B")
    resp = await client.get("/api/v1/piggy-banks", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_list_piggy_banks_cross_user(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _setup(client, "a@example.com")
    headers_b = await register_second_user(client, headers_a, "b@example.com")
    await _create_piggy(client, headers_a)
    resp = await client.get("/api/v1/piggy-banks", headers=headers_b)
    assert resp.json() == []


# ── GET /piggy-banks/{id} ─────────────────────────────────────────────────────

async def test_get_piggy_bank(authed) -> None:
    client, headers, _ = authed
    pig = await _create_piggy(client, headers)
    resp = await client.get(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == pig["id"]


async def test_get_piggy_bank_404(authed) -> None:
    client, headers, _ = authed
    resp = await client.get(
        "/api/v1/piggy-banks/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert resp.status_code == 404


# ── PATCH /piggy-banks/{id} ───────────────────────────────────────────────────

async def test_patch_piggy_bank(authed) -> None:
    client, headers, _ = authed
    pig = await _create_piggy(client, headers)
    resp = await client.patch(
        f"/api/v1/piggy-banks/{pig['id']}",
        json={"name": "Italy Trip", "target_amount": "300000.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Italy Trip"
    assert data["target_amount"] == "300000.00"


async def test_patch_triggers_auto_complete(authed) -> None:
    """Lowering target_amount below current_amount should set is_completed."""
    client, headers, account_id = authed
    pig = await _create_piggy(client, headers, target_amount="200000.00")
    txn = await _create_txn(client, headers, account_id, amount="100000.00")

    await client.post(
        f"/api/v1/piggy-banks/{pig['id']}/contributions",
        json={
            "transaction_id": txn["id"],
            "contribution_type": "expense",
            "amount": "100000.00",
            "date": "2026-05-15",
        },
        headers=headers,
    )

    # Now lower target below current_amount
    resp = await client.patch(
        f"/api/v1/piggy-banks/{pig['id']}",
        json={"target_amount": "50000.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["is_completed"] is True


# ── DELETE + restore ──────────────────────────────────────────────────────────

async def test_delete_piggy_bank(authed) -> None:
    client, headers, _ = authed
    pig = await _create_piggy(client, headers)
    resp = await client.delete(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    assert resp.status_code == 204
    resp = await client.get(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    assert resp.status_code == 404


async def test_restore_piggy_bank(authed) -> None:
    client, headers, _ = authed
    pig = await _create_piggy(client, headers)
    await client.delete(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    resp = await client.post(f"/api/v1/piggy-banks/{pig['id']}/restore", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["deleted_at"] is None


# ── Contributions ─────────────────────────────────────────────────────────────

async def test_add_contribution_updates_total(authed) -> None:
    client, headers, account_id = authed
    pig = await _create_piggy(client, headers, target_amount="10000.00")
    txn = await _create_txn(client, headers, account_id, amount="3000.00")

    resp = await client.post(
        f"/api/v1/piggy-banks/{pig['id']}/contributions",
        json={
            "transaction_id": txn["id"],
            "contribution_type": "expense",
            "amount": "3000.00",
            "date": "2026-05-15",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    contrib = resp.json()
    assert contrib["amount"] == "3000.00"

    pig_resp = await client.get(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    data = pig_resp.json()
    assert data["current_amount"] == "3000.00"
    assert data["progress_pct"] == 30.0
    assert data["is_completed"] is False


async def test_add_contribution_auto_complete(authed) -> None:
    client, headers, account_id = authed
    pig = await _create_piggy(client, headers, target_amount="5000.00")
    txn = await _create_txn(client, headers, account_id, amount="5000.00")

    await client.post(
        f"/api/v1/piggy-banks/{pig['id']}/contributions",
        json={
            "transaction_id": txn["id"],
            "contribution_type": "transfer",
            "amount": "5000.00",
            "date": "2026-05-15",
        },
        headers=headers,
    )

    pig_resp = await client.get(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    data = pig_resp.json()
    assert data["current_amount"] == "5000.00"
    assert data["is_completed"] is True


async def test_remove_contribution_updates_total(authed) -> None:
    client, headers, account_id = authed
    pig = await _create_piggy(client, headers, target_amount="5000.00")
    txn = await _create_txn(client, headers, account_id, amount="5000.00")

    contrib_resp = await client.post(
        f"/api/v1/piggy-banks/{pig['id']}/contributions",
        json={
            "transaction_id": txn["id"],
            "contribution_type": "expense",
            "amount": "5000.00",
            "date": "2026-05-15",
        },
        headers=headers,
    )
    assert contrib_resp.status_code == 201
    contrib_id = contrib_resp.json()["id"]

    # Verify completed
    pig_resp = await client.get(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    assert pig_resp.json()["is_completed"] is True

    # Remove contribution
    del_resp = await client.delete(
        f"/api/v1/piggy-banks/{pig['id']}/contributions/{contrib_id}",
        headers=headers,
    )
    assert del_resp.status_code == 204

    pig_resp = await client.get(f"/api/v1/piggy-banks/{pig['id']}", headers=headers)
    data = pig_resp.json()
    assert data["current_amount"] == "0.00"
    assert data["is_completed"] is False


async def test_list_contributions(authed) -> None:
    client, headers, account_id = authed
    pig = await _create_piggy(client, headers)
    txn = await _create_txn(client, headers, account_id)

    await client.post(
        f"/api/v1/piggy-banks/{pig['id']}/contributions",
        json={
            "transaction_id": txn["id"],
            "contribution_type": "expense",
            "amount": "1000.00",
            "date": "2026-05-15",
        },
        headers=headers,
    )

    resp = await client.get(f"/api/v1/piggy-banks/{pig['id']}/contributions", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["amount"] == "1000.00"


async def test_add_contribution_invalid_transaction(authed) -> None:
    client, headers, _ = authed
    pig = await _create_piggy(client, headers)
    resp = await client.post(
        f"/api/v1/piggy-banks/{pig['id']}/contributions",
        json={
            "transaction_id": "00000000-0000-0000-0000-000000000000",
            "contribution_type": "expense",
            "amount": "1000.00",
            "date": "2026-05-15",
        },
        headers=headers,
    )
    assert resp.status_code == 404


async def test_contribution_cross_user_transaction(client: AsyncClient, db_tables: None) -> None:
    headers_a = await _setup(client, "a@example.com")
    headers_b = await register_second_user(client, headers_a, "b@example.com")

    acc_b = (
        await client.post(
            "/api/v1/accounts",
            json={"name": "B", "type": "bank", "currency": "INR", "opening_balance": "0"},
            headers=headers_b,
        )
    ).json()["id"]
    txn_b = (
        await client.post(
            "/api/v1/transactions",
            json={
                "type": "expense",
                "transacted_at": "2026-05-15T10:00:00Z",
                "amount": "1000.00",
                "currency": "INR",
                "account_id": acc_b,
            },
            headers=headers_b,
        )
    ).json()["id"]

    pig_a = await _create_piggy(client, headers_a)

    resp = await client.post(
        f"/api/v1/piggy-banks/{pig_a['id']}/contributions",
        json={
            "transaction_id": txn_b,
            "contribution_type": "expense",
            "amount": "1000.00",
            "date": "2026-05-15",
        },
        headers=headers_a,
    )
    assert resp.status_code == 404
