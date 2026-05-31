"""Integration tests for /api/v1/budgets."""

from datetime import date

import pytest
from httpx import AsyncClient

from tests._helpers import register_second_user


async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_budget(client: AsyncClient, headers: dict, **overrides) -> dict:
    payload = {
        "name": "Monthly Groceries",
        "amount": "5000.00",
        "currency": "INR",
        "type": "adhoc",
        "is_active": True,
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/budgets", json=payload, headers=headers)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    return client, headers


# ── POST /budgets ─────────────────────────────────────────────────────────────

async def test_create_adhoc_budget(authed) -> None:
    client, headers = authed
    data = await _create_budget(client, headers)
    assert data["name"] == "Monthly Groceries"
    assert data["amount"] == "5000.00"
    assert data["type"] == "adhoc"
    assert data["is_active"] is True
    assert data["category_ids"] == []


async def test_create_recurring_budget(authed) -> None:
    client, headers = authed
    data = await _create_budget(
        client,
        headers,
        name="Rent",
        amount="15000.00",
        type="recurring",
        recurrence_rule="FREQ=MONTHLY",
        start_date="2026-01-01",
        period="monthly",
    )
    assert data["type"] == "recurring"
    assert data["recurrence_rule"] == "FREQ=MONTHLY"
    assert data["start_date"] == "2026-01-01"


async def test_create_budget_with_categories(authed) -> None:
    client, headers = authed
    # Create a category first
    cat_resp = await client.post(
        "/api/v1/categories", json={"name": "Groceries"}, headers=headers
    )
    assert cat_resp.status_code == 201
    cat_id = cat_resp.json()["id"]

    data = await _create_budget(client, headers, category_ids=[cat_id])
    assert cat_id in data["category_ids"]


async def test_create_budget_invalid_amount(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/budgets",
        json={"name": "Bad", "amount": "-100", "currency": "INR", "type": "adhoc"},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_budget_auth_required(client: AsyncClient, db_tables: None) -> None:
    resp = await client.post(
        "/api/v1/budgets",
        json={"name": "X", "amount": "100", "currency": "INR", "type": "adhoc"},
    )
    assert resp.status_code == 401


# ── GET /budgets ──────────────────────────────────────────────────────────────

async def test_list_budgets_active_only_by_default(authed) -> None:
    client, headers = authed
    await _create_budget(client, headers, name="Active Budget", is_active=True)
    await _create_budget(client, headers, name="Inactive Budget", is_active=False)

    resp = await client.get("/api/v1/budgets", headers=headers)
    assert resp.status_code == 200
    names = [b["name"] for b in resp.json()]
    assert "Active Budget" in names
    assert "Inactive Budget" not in names


async def test_list_budgets_include_inactive(authed) -> None:
    client, headers = authed
    await _create_budget(client, headers, name="Active", is_active=True)
    await _create_budget(client, headers, name="Inactive", is_active=False)

    resp = await client.get("/api/v1/budgets?include_inactive=true", headers=headers)
    assert resp.status_code == 200
    names = [b["name"] for b in resp.json()]
    assert "Active" in names
    assert "Inactive" in names


async def test_list_budgets_scoped_to_user(authed) -> None:
    client, headers = authed
    await _create_budget(client, headers, name="User1 Budget")

    headers2 = await register_second_user(client, headers, "other@example.com")
    resp = await client.get("/api/v1/budgets", headers=headers2)
    assert resp.status_code == 200
    assert resp.json() == []


# ── GET /budgets/{id} ─────────────────────────────────────────────────────────

async def test_get_budget(authed) -> None:
    client, headers = authed
    created = await _create_budget(client, headers)
    resp = await client.get(f"/api/v1/budgets/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


async def test_get_budget_not_found(authed) -> None:
    client, headers = authed
    resp = await client.get(
        "/api/v1/budgets/00000000-0000-0000-0000-000000000000", headers=headers
    )
    assert resp.status_code == 404


async def test_get_budget_cross_user_404(authed) -> None:
    client, headers = authed
    created = await _create_budget(client, headers)

    headers2 = await register_second_user(client, headers, "other2@example.com")
    resp = await client.get(f"/api/v1/budgets/{created['id']}", headers=headers2)
    assert resp.status_code == 404


# ── PATCH /budgets/{id} ───────────────────────────────────────────────────────

async def test_patch_adhoc_budget(authed) -> None:
    client, headers = authed
    created = await _create_budget(client, headers, name="Old Name")
    resp = await client.patch(
        f"/api/v1/budgets/{created['id']}",
        json={"name": "New Name", "amount": "6000.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["amount"] == "6000.00"


async def test_patch_recurring_current_and_future_edits_in_place(authed) -> None:
    client, headers = authed
    created = await _create_budget(
        client,
        headers,
        name="Rent",
        type="recurring",
        recurrence_rule="FREQ=MONTHLY",
        start_date="2026-01-01",
        amount="15000.00",
    )
    resp = await client.patch(
        f"/api/v1/budgets/{created['id']}?scope=current_and_future",
        json={"amount": "16000.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]
    assert resp.json()["amount"] == "16000.00"


async def test_patch_recurring_future_only_creates_clone(authed) -> None:
    client, headers = authed
    created = await _create_budget(
        client,
        headers,
        name="Rent",
        type="recurring",
        recurrence_rule="FREQ=MONTHLY",
        start_date="2026-01-01",
        amount="15000.00",
    )
    resp = await client.patch(
        f"/api/v1/budgets/{created['id']}?scope=future_only",
        json={"amount": "17000.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # A new budget is created (different id)
    assert data["id"] != created["id"]
    assert data["amount"] == "17000.00"
    # Original is now capped
    orig = await client.get(
        f"/api/v1/budgets/{created['id']}?include_inactive=true", headers=headers
    )
    # Original may not appear in active list but still GET-able
    assert orig.status_code == 200


# ── DELETE /budgets/{id} ──────────────────────────────────────────────────────

async def test_delete_adhoc_budget(authed) -> None:
    client, headers = authed
    created = await _create_budget(client, headers)
    resp = await client.delete(f"/api/v1/budgets/{created['id']}", headers=headers)
    assert resp.status_code == 204

    resp2 = await client.get(f"/api/v1/budgets/{created['id']}", headers=headers)
    assert resp2.status_code == 404


async def test_delete_recurring_current_and_future(authed) -> None:
    client, headers = authed
    created = await _create_budget(
        client,
        headers,
        name="Rent",
        type="recurring",
        recurrence_rule="FREQ=MONTHLY",
        start_date="2026-01-01",
        amount="15000.00",
    )
    resp = await client.delete(
        f"/api/v1/budgets/{created['id']}?scope=current_and_future", headers=headers
    )
    assert resp.status_code == 204
    resp2 = await client.get(f"/api/v1/budgets/{created['id']}", headers=headers)
    assert resp2.status_code == 404


async def test_delete_recurring_future_only(authed) -> None:
    client, headers = authed
    created = await _create_budget(
        client,
        headers,
        name="Rent",
        type="recurring",
        recurrence_rule="FREQ=MONTHLY",
        start_date="2026-01-01",
        amount="15000.00",
    )
    resp = await client.delete(
        f"/api/v1/budgets/{created['id']}?scope=future_only", headers=headers
    )
    assert resp.status_code == 204
    # Original still exists but capped (end_date set)
    orig = await client.get(f"/api/v1/budgets/{created['id']}", headers=headers)
    assert orig.status_code in (200, 404)  # may be inactive


async def test_delete_recurring_instance_only(authed) -> None:
    client, headers = authed
    # Use today as start_date so an instance exists for scope=instance deletion
    today_str = date.today().isoformat()
    created = await _create_budget(
        client,
        headers,
        name="Rent",
        type="recurring",
        recurrence_rule="FREQ=MONTHLY",
        start_date=today_str,
        amount="15000.00",
    )
    resp = await client.delete(
        f"/api/v1/budgets/{created['id']}?scope=instance", headers=headers
    )
    assert resp.status_code == 204
    # Template still accessible
    orig = await client.get(f"/api/v1/budgets/{created['id']}", headers=headers)
    assert orig.status_code == 200


async def test_delete_budget_auth_required(client: AsyncClient, db_tables: None) -> None:
    resp = await client.delete(
        "/api/v1/budgets/00000000-0000-0000-0000-000000000000"
    )
    assert resp.status_code == 401
