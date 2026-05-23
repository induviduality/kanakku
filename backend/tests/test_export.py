"""Tests for POST /export, GET /export/{job_id}, GET /export/{job_id}/download."""

import io
import json
import tarfile
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient, email: str = "exporter@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.mark.usefixtures("db_tables")
async def test_trigger_export_returns_job(client: AsyncClient) -> None:
    headers = await _setup(client)
    with patch("app.routers.export.arq") as mock_arq:
        mock_pool = AsyncMock()
        mock_arq.create_pool = AsyncMock(return_value=mock_pool)
        mock_arq.connections = AsyncMock()
        mock_arq.connections.RedisSettings.from_dsn = lambda _: None

        resp = await client.post("/api/v1/export", headers=headers)

    assert resp.status_code == 202
    data = resp.json()
    assert "id" in data
    assert data["status"] in ("pending", "running", "done")


@pytest.mark.usefixtures("db_tables")
async def test_trigger_export_falls_back_inline(client: AsyncClient) -> None:
    """When Redis is unavailable the job runs inline and status becomes done."""
    headers = await _setup(client)
    resp = await client.post("/api/v1/export", headers=headers)
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "done"


@pytest.mark.usefixtures("db_tables")
async def test_get_export_status(client: AsyncClient) -> None:
    headers = await _setup(client)
    create_resp = await client.post("/api/v1/export", headers=headers)
    job_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/export/{job_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == job_id


@pytest.mark.usefixtures("db_tables")
async def test_get_export_status_not_found(client: AsyncClient) -> None:
    headers = await _setup(client)
    fake_id = "00000000-0000-0000-0000-000000000099"
    resp = await client.get(f"/api/v1/export/{fake_id}", headers=headers)
    assert resp.status_code == 404


@pytest.mark.usefixtures("db_tables")
async def test_download_export_archive(client: AsyncClient) -> None:
    """A completed export can be downloaded as a valid tar.gz with manifest.json."""
    headers = await _setup(client)
    create_resp = await client.post("/api/v1/export", headers=headers)
    assert create_resp.json()["status"] == "done"
    job_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/export/{job_id}/download", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/gzip"

    with tarfile.open(fileobj=io.BytesIO(resp.content), mode="r:gz") as tar:
        names = tar.getnames()
        assert "manifest.json" in names
        manifest = json.loads(tar.extractfile("manifest.json").read())  # type: ignore[union-attr]

    assert manifest["schema_version"] == 1
    assert "table_list" in manifest
    assert "record_counts" in manifest


@pytest.mark.usefixtures("db_tables")
async def test_download_not_found(client: AsyncClient) -> None:
    headers = await _setup(client)
    fake_id = "00000000-0000-0000-0000-000000000098"
    resp = await client.get(f"/api/v1/export/{fake_id}/download", headers=headers)
    assert resp.status_code == 404


@pytest.mark.usefixtures("db_tables")
async def test_export_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/export")
    assert resp.status_code == 401


@pytest.mark.usefixtures("db_tables")
async def test_export_contains_only_own_data(client: AsyncClient) -> None:
    """Export for user A does not contain data belonging to user B."""
    headers_a = await _setup(client, email="user_a@example.com")
    headers_b = await _setup(client, email="user_b@example.com")

    # Create an account for user B
    await client.post(
        "/api/v1/accounts",
        json={"name": "B-Bank", "type": "bank", "currency": "INR", "opening_balance": "0"},
        headers=headers_b,
    )

    # Export as user A
    create_resp = await client.post("/api/v1/export", headers=headers_a)
    job_id = create_resp.json()["id"]
    dl = await client.get(f"/api/v1/export/{job_id}/download", headers=headers_a)

    with tarfile.open(fileobj=io.BytesIO(dl.content), mode="r:gz") as tar:
        accounts = json.loads(tar.extractfile("accounts.json").read())  # type: ignore[union-attr]

    names = [a["name"] for a in accounts]
    assert "B-Bank" not in names
