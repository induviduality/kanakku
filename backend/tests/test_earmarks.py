"""Integration tests for /api/v1/earmarks."""
from decimal import Decimal

import pytest
from httpx import AsyncClient

from tests._helpers import register_second_user


async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_account(
    client: AsyncClient,
    headers: dict,
    name: str = "Main Bank",
    acc_type: str = "bank",
    currency: str = "INR",
    opening_balance: str = "100000.00",
) -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={
            "name": name,
            "type": acc_type,
            "currency": currency,
            "opening_balance": opening_balance,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_piggy(
    client: AsyncClient, headers: dict, name: str = "Laptop Fund", target_amount: str = "50000.00", currency: str = "INR"
) -> str:
    resp = await client.post(
        "/api/v1/piggy-banks",
        json={"name": name, "target_amount": target_amount, "currency": currency},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_earmark(
    client: AsyncClient, headers: dict, **overrides
) -> dict:
    payload = {
        "name": "Emergency Fund",
        "amount": "20000.00",
        "currency": "INR",
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/earmarks", json=payload, headers=headers)
    return resp


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    account_id = await _create_account(client, headers, opening_balance="100000.00")
    return client, headers, account_id


# ── POST /earmarks ────────────────────────────────────────────────────────────

async def test_create_general_earmark(authed) -> None:
    client, headers, _ = authed
    resp = await _create_earmark(client, headers, name="Emergency", amount="25000.00")
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Emergency"
    assert data["amount"] == "25000.00"
    assert data["currency"] == "INR"
    assert data["account_id"] is None
    assert data["account_name"] is None
    assert data["piggy_bank_id"] is None
    assert data["piggy_bank_name"] is None
    assert data["is_active"] is True


async def test_create_earmark_with_account_and_piggy_bank(authed) -> None:
    client, headers, account_id = authed
    pb_id = await _create_piggy(client, headers)
    resp = await _create_earmark(
        client,
        headers,
        name="Laptop Reserve",
        amount="15000.00",
        account_id=account_id,
        piggy_bank_id=pb_id,
        notes="Reserved from Main Bank for Laptop",
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["account_id"] == account_id
    assert data["account_name"] == "Main Bank"
    assert data["piggy_bank_id"] == pb_id
    assert data["piggy_bank_name"] == "Laptop Fund"
    assert data["notes"] == "Reserved from Main Bank for Laptop"


async def test_create_earmark_invalid_amount(authed) -> None:
    client, headers, _ = authed
    resp = await _create_earmark(client, headers, amount="0")
    assert resp.status_code == 422
    resp_neg = await _create_earmark(client, headers, amount="-500")
    assert resp_neg.status_code == 422


async def test_create_earmark_liability_account_rejected(authed) -> None:
    client, headers, _ = authed
    credit_card_id = await _create_account(client, headers, name="Credit Card", acc_type="credit_card")
    resp = await _create_earmark(client, headers, account_id=credit_card_id)
    assert resp.status_code == 422
    assert "liability accounts" in resp.json()["detail"]


async def test_create_earmark_currency_mismatch_account(authed) -> None:
    client, headers, _ = authed
    usd_acc_id = await _create_account(client, headers, name="USD Acc", currency="USD")
    resp = await _create_earmark(client, headers, currency="INR", account_id=usd_acc_id)
    assert resp.status_code == 422
    assert "Currency mismatch" in resp.json()["detail"]


async def test_create_earmark_currency_mismatch_piggy(authed) -> None:
    client, headers, _ = authed
    usd_pb_id = await _create_piggy(client, headers, name="USD Goal", currency="USD")
    resp = await _create_earmark(client, headers, currency="INR", piggy_bank_id=usd_pb_id)
    assert resp.status_code == 422
    assert "Currency mismatch" in resp.json()["detail"]


async def test_create_earmark_global_constraint_violation(authed) -> None:
    client, headers, _ = authed
    # Account has 100,000 cash. Trying to earmark 120,000 should 422.
    resp = await _create_earmark(client, headers, amount="120000.00")
    assert resp.status_code == 422
    assert "exceed available cash" in resp.json()["detail"]


# ── GET, PATCH, DELETE, TOGGLE, RESTORE ───────────────────────────────────────

async def test_list_earmarks(authed) -> None:
    client, headers, _ = authed
    await _create_earmark(client, headers, name="Earmark 1", amount="10000.00")
    await _create_earmark(client, headers, name="Earmark 2", amount="20000.00")

    resp = await client.get("/api/v1/earmarks", headers=headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2


async def test_get_earmark(authed) -> None:
    client, headers, _ = authed
    created = (await _create_earmark(client, headers, name="Specific", amount="5000.00")).json()
    resp = await client.get(f"/api/v1/earmarks/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Specific"


async def test_patch_earmark(authed) -> None:
    client, headers, _ = authed
    created = (await _create_earmark(client, headers, name="Old Name", amount="5000.00")).json()

    resp = await client.patch(
        f"/api/v1/earmarks/{created['id']}",
        json={"name": "New Name", "amount": "12000.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["amount"] == "12000.00"


async def test_patch_earmark_exceeding_cash_fails(authed) -> None:
    client, headers, _ = authed
    created = (await _create_earmark(client, headers, amount="50000.00")).json()
    # User has 100k cash. Patching to 150k should fail
    resp = await client.patch(
        f"/api/v1/earmarks/{created['id']}",
        json={"amount": "150000.00"},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_toggle_earmark(authed) -> None:
    client, headers, _ = authed
    created = (await _create_earmark(client, headers, amount="10000.00")).json()
    assert created["is_active"] is True

    # Toggle to inactive
    resp = await client.patch(f"/api/v1/earmarks/{created['id']}/toggle", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Toggle back to active
    resp2 = await client.patch(f"/api/v1/earmarks/{created['id']}/toggle", headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["is_active"] is True


async def test_delete_and_restore_earmark(authed) -> None:
    client, headers, _ = authed
    created = (await _create_earmark(client, headers)).json()

    # Delete
    del_resp = await client.delete(f"/api/v1/earmarks/{created['id']}", headers=headers)
    assert del_resp.status_code == 204

    # List should be empty
    list_resp = await client.get("/api/v1/earmarks", headers=headers)
    assert len(list_resp.json()) == 0

    # Get should 404
    get_resp = await client.get(f"/api/v1/earmarks/{created['id']}", headers=headers)
    assert get_resp.status_code == 404

    # Restore
    restore_resp = await client.post(f"/api/v1/earmarks/{created['id']}/restore", headers=headers)
    assert restore_resp.status_code == 200
    assert restore_resp.json()["id"] == created["id"]


# ── Piggy Bank Integration ────────────────────────────────────────────────────

async def test_piggy_bank_progress_includes_earmarks(authed) -> None:
    client, headers, account_id = authed
    pb_id = await _create_piggy(client, headers, target_amount="100000.00")

    # 1. Add transaction contribution of 20,000
    txn_resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-05-01T10:00:00Z",
            "amount": "20000.00",
            "currency": "INR",
            "account_id": account_id,
        },
        headers=headers,
    )
    txn_id = txn_resp.json()["id"]
    await client.post(
        f"/api/v1/piggy-banks/{pb_id}/contributions",
        json={
            "transaction_id": txn_id,
            "contribution_type": "expense",
            "amount": "20000.00",
            "date": "2026-05-01",
        },
        headers=headers,
    )

    # 2. Add earmark linked to piggy bank of 30,000
    earmark_resp = await _create_earmark(
        client, headers, amount="30000.00", piggy_bank_id=pb_id
    )
    earmark_id = earmark_resp.json()["id"]

    # 3. Check piggy bank detail
    pb_detail = (await client.get(f"/api/v1/piggy-banks/{pb_id}", headers=headers)).json()
    assert pb_detail["current_amount"] == "50000.00"
    assert pb_detail["amount_from_transactions"] == "20000.00"
    assert pb_detail["amount_from_earmarks"] == "30000.00"
    assert pb_detail["progress_pct"] == 50.0

    # 4. Deactivating the earmark reduces the progress
    await client.patch(f"/api/v1/earmarks/{earmark_id}/toggle", headers=headers)
    pb_detail2 = (await client.get(f"/api/v1/piggy-banks/{pb_id}", headers=headers)).json()
    assert pb_detail2["current_amount"] == "20000.00"
    assert pb_detail2["amount_from_earmarks"] == "0.00"


# ── Dashboard Integration ─────────────────────────────────────────────────────

async def test_dashboard_reflects_earmarks(authed) -> None:
    client, headers, account_id = authed
    # Account has 100,000 cash.
    # Create earmark of 35,000 tagged to account.
    await _create_earmark(
        client, headers, name="Vacation", amount="35000.00", account_id=account_id
    )

    dash = (await client.get("/api/v1/dashboard/home", headers=headers)).json()
    assert dash["total_earmarked"] == "35000.00"
    assert dash["available_cash"] == "65000.00"
    assert dash["is_overcommitted"] is False
    assert len(dash["earmarks_summary"]) == 1
    assert dash["earmarks_summary"][0]["name"] == "Vacation"
    assert dash["earmarks_summary"][0]["account_name"] == "Main Bank"

    # Account balances list should include earmark_names
    acc_bal = next(a for a in dash["account_balances"] if a["id"] == account_id)
    assert "Vacation" in acc_bal["earmark_names"]
