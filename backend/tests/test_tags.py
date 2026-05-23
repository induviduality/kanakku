"""Integration tests for /api/v1/tags."""

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

async def test_create_tag(authed) -> None:
    client, headers = authed
    resp = await client.post(
        "/api/v1/tags",
        json={"name": "weekend", "color": "#FF0000"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "weekend"
    assert data["color"] == "#FF0000"
    assert data["deleted_at"] is None


async def test_create_tag_minimal(authed) -> None:
    client, headers = authed
    resp = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["color"] is None


async def test_create_tag_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.post("/api/v1/tags", json={"name": "X"})
    assert resp.status_code == 401


async def test_create_duplicate_tag_returns_409(authed) -> None:
    client, headers = authed
    await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    resp = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    assert resp.status_code == 409


# ── List ─────────────────────────────────────────────────────────────────────

async def test_list_tags(authed) -> None:
    client, headers = authed
    for name in ["alpha", "beta", "gamma"]:
        await client.post("/api/v1/tags", json={"name": name}, headers=headers)
    resp = await client.get("/api/v1/tags", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


async def test_list_excludes_deleted_by_default(authed) -> None:
    client, headers = authed
    create = await client.post("/api/v1/tags", json={"name": "gone"}, headers=headers)
    tag_id = create.json()["id"]
    await client.delete(f"/api/v1/tags/{tag_id}", headers=headers)
    resp = await client.get("/api/v1/tags", headers=headers)
    ids = [t["id"] for t in resp.json()]
    assert tag_id not in ids


# ── Get ─────────────────────────────────────────────────────────────────────

async def test_get_tag(authed) -> None:
    client, headers = authed
    create = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    tag_id = create.json()["id"]
    resp = await client.get(f"/api/v1/tags/{tag_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == tag_id


async def test_get_tag_scoped_to_user(setup_client: AsyncClient, db_tables) -> None:
    resp_a = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "a@example.com", "password": "password123"},
    )
    token_a = resp_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    tag = await setup_client.post(
        "/api/v1/tags", json={"name": "private"}, headers=headers_a
    )
    tag_id = tag.json()["id"]

    inv = await setup_client.post("/api/v1/auth/invites", json={}, headers=headers_a)
    acc = await setup_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": inv.json()["token"], "email": "b@example.com", "password": "p123"},
    )
    headers_b = {"Authorization": f"Bearer {acc.json()['access_token']}"}

    resp = await setup_client.get(f"/api/v1/tags/{tag_id}", headers=headers_b)
    assert resp.status_code == 404


# ── Patch ───────────────────────────────────────────────────────────────────

async def test_patch_tag(authed) -> None:
    client, headers = authed
    create = await client.post(
        "/api/v1/tags", json={"name": "old", "color": "#AAA"}, headers=headers
    )
    tag_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/tags/{tag_id}",
        json={"name": "new", "color": "#BBB"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "new"
    assert resp.json()["color"] == "#BBB"


async def test_patch_to_duplicate_name_returns_409(authed) -> None:
    client, headers = authed
    await client.post("/api/v1/tags", json={"name": "alpha"}, headers=headers)
    create = await client.post("/api/v1/tags", json={"name": "beta"}, headers=headers)
    tag_id = create.json()["id"]
    resp = await client.patch(
        f"/api/v1/tags/{tag_id}", json={"name": "alpha"}, headers=headers
    )
    assert resp.status_code == 409


# ── Soft delete & restore ───────────────────────────────────────────────────

async def test_soft_delete_tag(authed) -> None:
    client, headers = authed
    create = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    tag_id = create.json()["id"]
    del_resp = await client.delete(f"/api/v1/tags/{tag_id}", headers=headers)
    assert del_resp.status_code == 204
    get_resp = await client.get(f"/api/v1/tags/{tag_id}", headers=headers)
    assert get_resp.status_code == 404


async def test_soft_delete_frees_name_for_reuse(authed) -> None:
    """Deleting a tag should allow creating another with the same name."""
    client, headers = authed
    create = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    tag_id = create.json()["id"]
    await client.delete(f"/api/v1/tags/{tag_id}", headers=headers)

    resp = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    assert resp.status_code == 201


async def test_restore_tag(authed) -> None:
    client, headers = authed
    create = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    tag_id = create.json()["id"]
    await client.delete(f"/api/v1/tags/{tag_id}", headers=headers)
    restore = await client.post(f"/api/v1/tags/{tag_id}/restore", headers=headers)
    assert restore.status_code == 200
    assert restore.json()["deleted_at"] is None


async def test_restore_non_deleted_returns_400(authed) -> None:
    client, headers = authed
    create = await client.post("/api/v1/tags", json={"name": "work"}, headers=headers)
    tag_id = create.json()["id"]
    resp = await client.post(f"/api/v1/tags/{tag_id}/restore", headers=headers)
    assert resp.status_code == 400
