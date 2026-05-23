"""Integration tests for /api/v1/payees."""

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

async def test_create_payee(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/payees",
        json={"name": "Swiggy", "type": "merchant"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Swiggy"
    assert data["type"] == "merchant"
    assert data["notes"] is None
    assert data["is_active"] is True
    assert data["deleted_at"] is None


async def test_create_payee_with_notes(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/payees",
        json={"name": "John", "type": "person", "notes": "College friend"},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["notes"] == "College friend"


async def test_create_payee_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/payees", json={"name": "X", "type": "merchant"}
    )
    assert resp.status_code == 401


# ── List / search / filter ───────────────────────────────────────────────────

async def test_list_payees(authed) -> None:
    client, headers = authed
    for name, ptype in [("Swiggy", "merchant"), ("John", "person"), ("Zomato", "merchant")]:
        await client.post(
            "/api/v1/payees", json={"name": name, "type": ptype}, headers=headers
        )
    resp = await client.get("/api/v1/payees", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


async def test_list_payees_search(authed) -> None:
    client, headers = authed
    for name, ptype in [("Swiggy", "merchant"), ("John", "person")]:
        await client.post(
            "/api/v1/payees", json={"name": name, "type": ptype}, headers=headers
        )
    resp = await client.get("/api/v1/payees", params={"search": "swig"}, headers=headers)
    names = [p["name"] for p in resp.json()]
    assert names == ["Swiggy"]


async def test_list_payees_type_filter(authed) -> None:
    client, headers = authed
    for name, ptype in [("Swiggy", "merchant"), ("John", "person"), ("Zomato", "merchant")]:
        await client.post(
            "/api/v1/payees", json={"name": name, "type": ptype}, headers=headers
        )
    resp = await client.get(
        "/api/v1/payees", params={"type": "merchant"}, headers=headers
    )
    types = {p["type"] for p in resp.json()}
    assert types == {"merchant"}
    assert len(resp.json()) == 2


async def test_list_excludes_deleted_by_default(authed) -> None:
    client, headers = authed
    resp1 = await client.post(
        "/api/v1/payees", json={"name": "X", "type": "other"}, headers=headers
    )
    payee_id = resp1.json()["id"]
    await client.delete(f"/api/v1/payees/{payee_id}", headers=headers)

    resp = await client.get("/api/v1/payees", headers=headers)
    ids = [p["id"] for p in resp.json()]
    assert payee_id not in ids


# ── Get ─────────────────────────────────────────────────────────────────────

async def test_get_payee(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/payees", json={"name": "A", "type": "business"}, headers=headers
    )
    payee_id = create.json()["id"]
    resp = await client.get(f"/api/v1/payees/{payee_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == payee_id


async def test_get_payee_scoped_to_user(setup_client: AsyncClient, db_tables) -> None:
    resp_a = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "a@example.com", "password": "password123"},
    )
    token_a = resp_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    payee = await setup_client.post(
        "/api/v1/payees", json={"name": "Private", "type": "merchant"}, headers=headers_a
    )
    payee_id = payee.json()["id"]

    inv = await setup_client.post("/api/v1/auth/invites", json={}, headers=headers_a)
    acc = await setup_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": inv.json()["token"], "email": "b@example.com", "password": "p123"},
    )
    headers_b = {"Authorization": f"Bearer {acc.json()['access_token']}"}

    resp = await setup_client.get(f"/api/v1/payees/{payee_id}", headers=headers_b)
    assert resp.status_code == 404


# ── Patch ───────────────────────────────────────────────────────────────────

async def test_patch_payee(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/payees", json={"name": "Old", "type": "merchant"}, headers=headers
    )
    payee_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/payees/{payee_id}",
        json={"name": "New", "notes": "Updated"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"
    assert resp.json()["notes"] == "Updated"


# ── Soft delete & restore ───────────────────────────────────────────────────

async def test_soft_delete_payee(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/payees", json={"name": "X", "type": "other"}, headers=headers
    )
    payee_id = create.json()["id"]

    del_resp = await client.delete(f"/api/v1/payees/{payee_id}", headers=headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/payees/{payee_id}", headers=headers)
    assert get_resp.status_code == 404


async def test_restore_payee(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/payees", json={"name": "X", "type": "other"}, headers=headers
    )
    payee_id = create.json()["id"]
    await client.delete(f"/api/v1/payees/{payee_id}", headers=headers)

    restore = await client.post(f"/api/v1/payees/{payee_id}/restore", headers=headers)
    assert restore.status_code == 200
    assert restore.json()["deleted_at"] is None


async def test_restore_non_deleted_payee_returns_400(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/payees", json={"name": "X", "type": "other"}, headers=headers
    )
    payee_id = create.json()["id"]
    resp = await client.post(f"/api/v1/payees/{payee_id}/restore", headers=headers)
    assert resp.status_code == 400
