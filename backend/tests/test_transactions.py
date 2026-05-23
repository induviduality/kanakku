"""Integration tests for /api/v1/transactions."""

import pytest
from httpx import AsyncClient


# ── Fixtures ──────────────────────────────────────────────────────────────────

async def _setup_user(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_account(client: AsyncClient, headers: dict, name: str = "Bank") -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": name, "type": "bank", "currency": "INR", "opening_balance": "10000.00"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup_user(client)
    acc_id = await _create_account(client, headers)
    return client, headers, acc_id


# ── Create ────────────────────────────────────────────────────────────────────

async def test_create_expense(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "500.00",
            "account_id": acc_id,
            "description": "Coffee",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "expense"
    assert data["amount"] == "500.00"
    assert data["currency"] == "INR"
    assert data["description"] == "Coffee"
    assert data["deleted_at"] is None


async def test_create_income(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "income",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "5000.00",
            "account_id": acc_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["type"] == "income"


async def test_create_transfer(authed) -> None:
    client, headers, acc_id = authed
    acc2_id = await _create_account(client, headers, "Savings")
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "transfer",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "1000.00",
            "account_id": acc_id,
            "to_account_id": acc2_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["to_account_id"] == acc2_id


async def test_create_transfer_without_to_account_fails(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "transfer",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "1000.00",
            "account_id": acc_id,
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_expense_with_to_account_fails(authed) -> None:
    client, headers, acc_id = authed
    acc2_id = await _create_account(client, headers, "Other")
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "100.00",
            "account_id": acc_id,
            "to_account_id": acc2_id,
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_with_zero_amount_fails(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "0.00",
            "account_id": acc_id,
        },
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_requires_auth(client: AsyncClient, db_tables: None) -> None:
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100", "account_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 401


# ── Balance correctness ────────────────────────────────────────────────────────

async def test_expense_reduces_balance(authed) -> None:
    client, headers, acc_id = authed
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "500.00", "account_id": acc_id},
        headers=headers,
    )
    acc = (await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)).json()
    assert float(acc["current_balance"]) == 9500.00


async def test_income_increases_balance(authed) -> None:
    client, headers, acc_id = authed
    await client.post(
        "/api/v1/transactions",
        json={"type": "income", "transacted_at": "2026-01-15T10:00:00Z", "amount": "1000.00", "account_id": acc_id},
        headers=headers,
    )
    acc = (await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)).json()
    assert float(acc["current_balance"]) == 11000.00


async def test_transfer_updates_both_accounts(authed) -> None:
    client, headers, acc_id = authed
    acc2_id = await _create_account(client, headers, "Savings")
    await client.post(
        "/api/v1/transactions",
        json={"type": "transfer", "transacted_at": "2026-01-15T10:00:00Z",
              "amount": "2000.00", "account_id": acc_id, "to_account_id": acc2_id},
        headers=headers,
    )
    src = (await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)).json()
    dst = (await client.get(f"/api/v1/accounts/{acc2_id}", headers=headers)).json()
    assert float(src["current_balance"]) == 8000.00
    assert float(dst["current_balance"]) == 12000.00


async def test_delete_restores_balance(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "500.00", "account_id": acc_id},
        headers=headers,
    )
    txn_id = resp.json()["id"]
    await client.delete(f"/api/v1/transactions/{txn_id}", headers=headers)
    acc = (await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)).json()
    assert float(acc["current_balance"]) == 10000.00


async def test_restore_reapplies_balance(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "500.00", "account_id": acc_id},
        headers=headers,
    )
    txn_id = resp.json()["id"]
    await client.delete(f"/api/v1/transactions/{txn_id}", headers=headers)
    await client.post(f"/api/v1/transactions/{txn_id}/restore", headers=headers)
    acc = (await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)).json()
    assert float(acc["current_balance"]) == 9500.00


# ── List / Filters ─────────────────────────────────────────────────────────────

async def test_list_returns_own_transactions(authed) -> None:
    client, headers, acc_id = authed
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    resp = await client.get("/api/v1/transactions", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 1


async def test_list_excludes_deleted_by_default(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    txn_id = resp.json()["id"]
    await client.delete(f"/api/v1/transactions/{txn_id}", headers=headers)
    resp = await client.get("/api/v1/transactions", headers=headers)
    assert len(resp.json()["items"]) == 0


async def test_filter_by_type(authed) -> None:
    client, headers, acc_id = authed
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    await client.post(
        "/api/v1/transactions",
        json={"type": "income", "transacted_at": "2026-01-15T10:00:00Z", "amount": "200.00", "account_id": acc_id},
        headers=headers,
    )
    resp = await client.get("/api/v1/transactions", params={"type": "expense"}, headers=headers)
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["type"] == "expense"


async def test_filter_by_account(authed) -> None:
    client, headers, acc_id = authed
    acc2_id = await _create_account(client, headers, "Other")
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "200.00", "account_id": acc2_id},
        headers=headers,
    )
    resp = await client.get("/api/v1/transactions", params={"account_id": acc_id}, headers=headers)
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["account_id"] == acc_id


async def test_filter_by_date_range(authed) -> None:
    client, headers, acc_id = authed
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-10T00:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-20T00:00:00Z", "amount": "200.00", "account_id": acc_id},
        headers=headers,
    )
    resp = await client.get(
        "/api/v1/transactions",
        params={"from": "2026-01-15T00:00:00Z", "to": "2026-01-31T00:00:00Z"},
        headers=headers,
    )
    items = resp.json()["items"]
    assert len(items) == 1


async def test_cursor_pagination(authed) -> None:
    client, headers, acc_id = authed
    for i in range(5):
        await client.post(
            "/api/v1/transactions",
            json={"type": "expense", "transacted_at": f"2026-01-{10+i:02d}T00:00:00Z",
                  "amount": "100.00", "account_id": acc_id},
            headers=headers,
        )
    page1 = (await client.get("/api/v1/transactions", params={"limit": 3}, headers=headers)).json()
    assert len(page1["items"]) == 3
    assert page1["next_cursor"] is not None

    page2 = (await client.get(
        "/api/v1/transactions",
        params={"limit": 3, "cursor": page1["next_cursor"]},
        headers=headers,
    )).json()
    assert len(page2["items"]) == 2
    assert page2["next_cursor"] is None

    all_ids = {i["id"] for i in page1["items"]} | {i["id"] for i in page2["items"]}
    assert len(all_ids) == 5


# ── Get / Patch ───────────────────────────────────────────────────────────────

async def test_get_transaction(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    txn_id = resp.json()["id"]
    get = await client.get(f"/api/v1/transactions/{txn_id}", headers=headers)
    assert get.status_code == 200
    assert get.json()["id"] == txn_id


async def test_patch_transaction(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    txn_id = resp.json()["id"]
    patch = await client.patch(
        f"/api/v1/transactions/{txn_id}",
        json={"amount": "200.00", "description": "Updated"},
        headers=headers,
    )
    assert patch.status_code == 200
    assert patch.json()["amount"] == "200.00"
    assert patch.json()["description"] == "Updated"

    # Balance should reflect the new amount
    acc = (await client.get(f"/api/v1/accounts/{acc_id}", headers=headers)).json()
    assert float(acc["current_balance"]) == 9800.00


async def test_transaction_with_categories_and_tags(authed) -> None:
    client, headers, acc_id = authed
    # Create category and tag first
    cat_resp = await client.post(
        "/api/v1/categories", json={"name": "Food"}, headers=headers
    )
    cat_id = cat_resp.json()["id"]
    tag_resp = await client.post("/api/v1/tags", json={"name": "weekend"}, headers=headers)
    tag_id = tag_resp.json()["id"]

    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "100.00",
            "account_id": acc_id,
            "category_ids": [cat_id],
            "tag_ids": [tag_id],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert cat_id in data["category_ids"]
    assert tag_id in data["tag_ids"]


async def test_soft_delete_hides_from_list(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    txn_id = resp.json()["id"]
    del_resp = await client.delete(f"/api/v1/transactions/{txn_id}", headers=headers)
    assert del_resp.status_code == 204
    resp = await client.get("/api/v1/transactions", headers=headers)
    assert txn_id not in [i["id"] for i in resp.json()["items"]]


async def test_restore_not_deleted_returns_400(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    txn_id = resp.json()["id"]
    restore = await client.post(f"/api/v1/transactions/{txn_id}/restore", headers=headers)
    assert restore.status_code == 400


async def test_currency_defaults_from_account(authed) -> None:
    client, headers, acc_id = authed
    # Account is INR; omitting currency should default to INR
    resp = await client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2026-01-15T10:00:00Z", "amount": "100.00", "account_id": acc_id},
        headers=headers,
    )
    assert resp.json()["currency"] == "INR"
