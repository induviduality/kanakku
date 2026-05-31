"""Integration tests for transaction-budget linking and GET /budgets/{id}/transactions."""

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
        json={"name": "Bank", "type": "bank", "currency": "INR", "opening_balance": "50000"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_category(client: AsyncClient, headers: dict, name: str = "Groceries") -> str:
    resp = await client.post(
        "/api/v1/categories", json={"name": name}, headers=headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_budget(
    client: AsyncClient, headers: dict, cat_ids: list[str] | None = None
) -> str:
    resp = await client.post(
        "/api/v1/budgets",
        json={
            "name": "Monthly Groceries",
            "amount": "5000.00",
            "currency": "INR",
            "type": "adhoc",
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "category_ids": cat_ids or [],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_transaction(
    client: AsyncClient,
    headers: dict,
    acc_id: str,
    budget_ids: list[str] | None = None,
    category_ids: list[str] | None = None,
    amount: str = "1000.00",
    txn_date: str = "2026-01-15T10:00:00Z",
) -> dict:
    payload: dict = {
        "type": "expense",
        "transacted_at": txn_date,
        "amount": amount,
        "account_id": acc_id,
        "budget_ids": budget_ids or [],
        "category_ids": category_ids or [],
    }
    resp = await client.post("/api/v1/transactions", json=payload, headers=headers)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    acc_id = await _create_account(client, headers)
    return client, headers, acc_id


# ── Transaction budget_ids wiring ─────────────────────────────────────────────

async def test_create_transaction_with_budget_ids(authed) -> None:
    client, headers, acc_id = authed
    budget_id = await _create_budget(client, headers)
    txn = await _create_transaction(client, headers, acc_id, budget_ids=[budget_id])
    # Linking is reflected in GET /budgets/{id}/transactions
    assert txn["id"] is not None


async def test_patch_transaction_updates_budget_ids(authed) -> None:
    client, headers, acc_id = authed
    budget_id = await _create_budget(client, headers)
    txn = await _create_transaction(client, headers, acc_id)

    # Now link it via PATCH
    resp = await client.patch(
        f"/api/v1/transactions/{txn['id']}",
        json={"budget_ids": [budget_id]},
        headers=headers,
    )
    assert resp.status_code == 200

    # Verify via budget transactions
    resp2 = await client.get(f"/api/v1/budgets/{budget_id}/transactions", headers=headers)
    assert resp2.status_code == 200
    data = resp2.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == txn["id"]
    assert data["items"][0]["link_type"] == "explicit"


# ── GET /budgets/{id}/transactions ────────────────────────────────────────────

async def test_explicit_link_appears_in_budget_transactions(authed) -> None:
    client, headers, acc_id = authed
    budget_id = await _create_budget(client, headers)
    txn = await _create_transaction(client, headers, acc_id, budget_ids=[budget_id])

    resp = await client.get(f"/api/v1/budgets/{budget_id}/transactions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["id"] == txn["id"]
    assert item["link_type"] == "explicit"


async def test_category_match_appears_in_budget_transactions(authed) -> None:
    client, headers, acc_id = authed
    cat_id = await _create_category(client, headers)
    budget_id = await _create_budget(client, headers, cat_ids=[cat_id])

    # Transaction with matching category but no explicit budget link
    txn = await _create_transaction(
        client, headers, acc_id, category_ids=[cat_id]
    )

    resp = await client.get(f"/api/v1/budgets/{budget_id}/transactions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == txn["id"]
    assert data["items"][0]["link_type"] == "category_match"


async def test_explicit_link_not_duplicated_as_category_match(authed) -> None:
    client, headers, acc_id = authed
    cat_id = await _create_category(client, headers)
    budget_id = await _create_budget(client, headers, cat_ids=[cat_id])

    # Transaction both explicitly linked AND has matching category
    txn = await _create_transaction(
        client, headers, acc_id, budget_ids=[budget_id], category_ids=[cat_id]
    )

    resp = await client.get(f"/api/v1/budgets/{budget_id}/transactions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    # Should appear exactly once with explicit link type
    assert len(data["items"]) == 1
    assert data["items"][0]["id"] == txn["id"]
    assert data["items"][0]["link_type"] == "explicit"


async def test_total_spent_sums_expense_amounts(authed) -> None:
    client, headers, acc_id = authed
    budget_id = await _create_budget(client, headers)

    await _create_transaction(client, headers, acc_id, budget_ids=[budget_id], amount="1000.00")
    await _create_transaction(client, headers, acc_id, budget_ids=[budget_id], amount="2000.00")

    resp = await client.get(f"/api/v1/budgets/{budget_id}/transactions", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    assert float(data["total_spent"]) == 3000.0


async def test_date_filter_narrows_results(authed) -> None:
    client, headers, acc_id = authed
    budget_id = await _create_budget(client, headers)

    await _create_transaction(
        client, headers, acc_id, budget_ids=[budget_id], txn_date="2026-01-05T10:00:00Z"
    )
    await _create_transaction(
        client, headers, acc_id, budget_ids=[budget_id], txn_date="2026-01-25T10:00:00Z"
    )

    resp = await client.get(
        f"/api/v1/budgets/{budget_id}/transactions?from=2026-01-10&to=2026-01-31",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # Only the Jan 25 transaction falls in range
    assert len(data["items"]) == 1


async def test_get_budget_transactions_auth_required(client: AsyncClient, db_tables: None) -> None:
    resp = await client.get(
        "/api/v1/budgets/00000000-0000-0000-0000-000000000000/transactions"
    )
    assert resp.status_code == 401


async def test_get_budget_transactions_cross_user_404(authed) -> None:
    client, headers, acc_id = authed
    budget_id = await _create_budget(client, headers)

    headers2 = await register_second_user(client, headers, "other@example.com")
    resp = await client.get(
        f"/api/v1/budgets/{budget_id}/transactions", headers=headers2
    )
    assert resp.status_code == 404


async def test_unlink_removes_from_budget_transactions(authed) -> None:
    client, headers, acc_id = authed
    budget_id = await _create_budget(client, headers)
    txn = await _create_transaction(client, headers, acc_id, budget_ids=[budget_id])

    # Unlink by patching with empty budget_ids
    resp = await client.patch(
        f"/api/v1/transactions/{txn['id']}",
        json={"budget_ids": []},
        headers=headers,
    )
    assert resp.status_code == 200

    resp2 = await client.get(f"/api/v1/budgets/{budget_id}/transactions", headers=headers)
    assert resp2.status_code == 200
    assert len(resp2.json()["items"]) == 0
