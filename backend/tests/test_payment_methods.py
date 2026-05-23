"""Integration tests for /api/v1/accounts/{account_id}/payment-methods."""

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/setup",
        json={"email": "admin@example.com", "password": "password123"},
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    acc = await client.post(
        "/api/v1/accounts",
        json={"name": "HDFC", "type": "bank", "currency": "INR"},
        headers=headers,
    )
    return headers, acc.json()["id"]


@pytest.fixture
async def setup_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    return client


# ── Create ──────────────────────────────────────────────────────────────────

async def test_create_debit_card(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "debit_card", "label": "HDFC Visa Debit"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "debit_card"
    assert data["label"] == "HDFC Visa Debit"
    assert data["upi_app"] is None
    assert data["account_id"] == acc_id


async def test_create_upi_requires_upi_app(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "upi", "label": "GPay"},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_upi_with_upi_app(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "upi", "label": "GPay", "upi_app": "gpay"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["upi_app"] == "gpay"


async def test_create_non_upi_with_upi_app_rejected(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "debit_card", "label": "Card", "upi_app": "gpay"},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_create_pm_on_nonexistent_account(setup_client: AsyncClient) -> None:
    headers, _ = await _setup(setup_client)
    import uuid
    resp = await setup_client.post(
        f"/api/v1/accounts/{uuid.uuid4()}/payment-methods",
        json={"type": "debit_card", "label": "X"},
        headers=headers,
    )
    assert resp.status_code == 404


# ── List ────────────────────────────────────────────────────────────────────

async def test_list_payment_methods(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "netbanking", "label": "HDFC Net"},
        headers=headers,
    )
    resp = await setup_client.get(
        f"/api/v1/accounts/{acc_id}/payment-methods", headers=headers
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_list_excludes_deleted_by_default(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    pm_resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "debit_card", "label": "Card"},
        headers=headers,
    )
    pm_id = pm_resp.json()["id"]
    await setup_client.delete(
        f"/api/v1/accounts/{acc_id}/payment-methods/{pm_id}", headers=headers
    )
    resp = await setup_client.get(
        f"/api/v1/accounts/{acc_id}/payment-methods", headers=headers
    )
    assert resp.json() == []


# ── Patch ───────────────────────────────────────────────────────────────────

async def test_patch_payment_method(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    pm_resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "debit_card", "label": "Old"},
        headers=headers,
    )
    pm_id = pm_resp.json()["id"]
    resp = await setup_client.patch(
        f"/api/v1/accounts/{acc_id}/payment-methods/{pm_id}",
        json={"label": "New", "is_active": False},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["label"] == "New"
    assert resp.json()["is_active"] is False


# ── Soft delete & restore ───────────────────────────────────────────────────

async def test_soft_delete_and_restore_payment_method(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    pm_resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "debit_card", "label": "Card"},
        headers=headers,
    )
    pm_id = pm_resp.json()["id"]

    del_resp = await setup_client.delete(
        f"/api/v1/accounts/{acc_id}/payment-methods/{pm_id}", headers=headers
    )
    assert del_resp.status_code == 204

    restore = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods/{pm_id}/restore",
        headers=headers,
    )
    assert restore.status_code == 200
    assert restore.json()["deleted_at"] is None


async def test_restore_non_deleted_pm_returns_400(setup_client: AsyncClient) -> None:
    headers, acc_id = await _setup(setup_client)
    pm_resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods",
        json={"type": "debit_card", "label": "Card"},
        headers=headers,
    )
    pm_id = pm_resp.json()["id"]
    resp = await setup_client.post(
        f"/api/v1/accounts/{acc_id}/payment-methods/{pm_id}/restore",
        headers=headers,
    )
    assert resp.status_code == 400


# ── Auth guard ───────────────────────────────────────────────────────────────

async def test_pm_endpoints_require_auth(setup_client: AsyncClient, db_tables) -> None:
    import uuid
    fake_id = str(uuid.uuid4())
    resp = await setup_client.get(f"/api/v1/accounts/{fake_id}/payment-methods")
    assert resp.status_code == 401
