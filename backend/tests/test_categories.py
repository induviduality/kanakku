"""Integration tests for /api/v1/categories."""

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

async def test_create_category(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/categories",
        json={"name": "Food", "icon": "🍔", "color": "#FF0000", "applicability": "expense"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Food"
    assert data["icon"] == "🍔"
    assert data["color"] == "#FF0000"
    assert data["applicability"] == "expense"
    assert data["deleted_at"] is None


async def test_create_category_minimal(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/categories",
        json={"name": "Misc"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["icon"] is None
    assert data["color"] is None
    assert data["applicability"] is None


async def test_create_category_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.post("/api/v1/categories", json={"name": "X"})
    assert resp.status_code == 401


# ── List / filter ────────────────────────────────────────────────────────────

async def test_list_categories(authed) -> None:
    client, headers = authed
    for name, app in [("Food", "expense"), ("Salary", "income"), ("Transfer", "both")]:
        await client.post(
            "/api/v1/categories",
            json={"name": name, "applicability": app},
            headers=headers,
        )
    resp = await client.get("/api/v1/categories", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


async def test_list_categories_applicability_filter(authed) -> None:
    client, headers = authed
    for name, app in [("Food", "expense"), ("Salary", "income"), ("Transfer", "both")]:
        await client.post(
            "/api/v1/categories",
            json={"name": name, "applicability": app},
            headers=headers,
        )
    resp = await client.get(
        "/api/v1/categories", params={"applicability": "expense"}, headers=headers
    )
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert names == ["Food"]


async def test_list_excludes_deleted_by_default(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/categories", json={"name": "ToDelete"}, headers=headers
    )
    cat_id = create.json()["id"]
    await client.delete(f"/api/v1/categories/{cat_id}", headers=headers)
    resp = await client.get("/api/v1/categories", headers=headers)
    ids = [c["id"] for c in resp.json()]
    assert cat_id not in ids


# ── Get ─────────────────────────────────────────────────────────────────────

async def test_get_category(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/categories", json={"name": "Food"}, headers=headers
    )
    cat_id = create.json()["id"]
    resp = await client.get(f"/api/v1/categories/{cat_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == cat_id


async def test_get_category_scoped_to_user(setup_client: AsyncClient, db_tables) -> None:
    resp_a = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "a@example.com", "password": "password123"},
    )
    token_a = resp_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    cat = await setup_client.post(
        "/api/v1/categories", json={"name": "Private"}, headers=headers_a
    )
    cat_id = cat.json()["id"]

    inv = await setup_client.post("/api/v1/auth/invites", json={}, headers=headers_a)
    acc = await setup_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": inv.json()["token"], "email": "b@example.com", "password": "p123"},
    )
    headers_b = {"Authorization": f"Bearer {acc.json()['access_token']}"}

    resp = await setup_client.get(f"/api/v1/categories/{cat_id}", headers=headers_b)
    assert resp.status_code == 404


# ── Patch ───────────────────────────────────────────────────────────────────

async def test_patch_category(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/categories", json={"name": "Old", "color": "#AAA"}, headers=headers
    )
    cat_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/categories/{cat_id}",
        json={"name": "New", "color": "#BBB"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New"
    assert resp.json()["color"] == "#BBB"


# ── Soft delete & restore ───────────────────────────────────────────────────

async def test_soft_delete_category(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/categories", json={"name": "Food"}, headers=headers
    )
    cat_id = create.json()["id"]
    del_resp = await client.delete(f"/api/v1/categories/{cat_id}", headers=headers)
    assert del_resp.status_code == 204
    get_resp = await client.get(f"/api/v1/categories/{cat_id}", headers=headers)
    assert get_resp.status_code == 404


async def test_restore_category(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/categories", json={"name": "Food"}, headers=headers
    )
    cat_id = create.json()["id"]
    await client.delete(f"/api/v1/categories/{cat_id}", headers=headers)
    restore = await client.post(
        f"/api/v1/categories/{cat_id}/restore", headers=headers
    )
    assert restore.status_code == 200
    assert restore.json()["deleted_at"] is None


async def test_restore_non_deleted_returns_400(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/categories", json={"name": "Food"}, headers=headers
    )
    cat_id = create.json()["id"]
    resp = await client.post(f"/api/v1/categories/{cat_id}/restore", headers=headers)
    assert resp.status_code == 400


# ── Seed defaults ───────────────────────────────────────────────────────────

async def test_seed_defaults_creates_categories(authed) -> None:
    client, headers = authed
    resp = await client.post("/api/v1/categories/seed-defaults", headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert len(data) > 0
    names = [c["name"] for c in data]
    assert "Food & Dining" in names
    assert "Salary" in names


async def test_seed_defaults_409_when_categories_exist(authed) -> None:
    client, headers = authed
    await client.post("/api/v1/categories", json={"name": "Existing"}, headers=headers)
    resp = await client.post("/api/v1/categories/seed-defaults", headers=headers)
    assert resp.status_code == 409
