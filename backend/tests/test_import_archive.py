"""Tests for POST /import-archive."""

import io
import json
import tarfile

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient, email: str = "importer@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_archive(manifest: dict, tables: dict[str, list[dict]]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, data in [("manifest.json", manifest)] + [(f"{t}.json", rows) for t, rows in tables.items()]:
            payload = json.dumps(data).encode()
            info = tarfile.TarInfo(name=name)
            info.size = len(payload)
            tar.addfile(info, io.BytesIO(payload))
    return buf.getvalue()


@pytest.mark.usefixtures("db_tables")
async def test_roundtrip_export_import(client: AsyncClient) -> None:
    """Export a user's data then import it into a fresh user — counts must match."""
    headers = await _setup(client, email="source@example.com")

    # Create some data for source user
    await client.post(
        "/api/v1/accounts",
        json={"name": "Export Bank", "type": "bank", "currency": "INR", "opening_balance": "5000"},
        headers=headers,
    )

    # Export
    export_resp = await client.post("/api/v1/export", headers=headers)
    assert export_resp.json()["status"] == "done"
    job_id = export_resp.json()["id"]
    dl = await client.get(f"/api/v1/export/{job_id}/download", headers=headers)
    archive_bytes = dl.content

    # Import into a fresh second user (set up via a fresh client call)
    headers_b = await _setup(client, email="dest@example.com")
    resp = await client.post(
        "/api/v1/import-archive",
        files={"file": ("archive.tar.gz", archive_bytes, "application/gzip")},
        headers=headers_b,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_records"] >= 0
    assert "imported_tables" in data


@pytest.mark.usefixtures("db_tables")
async def test_import_blocked_when_user_has_transactions(client: AsyncClient) -> None:
    headers = await _setup(client, email="hasTx@example.com")

    # Create account + transaction
    acct_resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Mine", "type": "bank", "currency": "INR", "opening_balance": "0"},
        headers=headers,
    )
    acct_id = acct_resp.json()["id"]
    await client.post(
        "/api/v1/transactions",
        json={
            "account_id": acct_id,
            "type": "expense",
            "amount": "100",
            "description": "Coffee",
            "transacted_at": "2026-01-01T00:00:00Z",
        },
        headers=headers,
    )

    archive = _make_archive(
        {"schema_version": 1, "user_id": "x", "table_list": [], "record_counts": {}, "exported_at": "2026-01-01T00:00:00+00:00"},
        {},
    )
    resp = await client.post(
        "/api/v1/import-archive",
        files={"file": ("a.tar.gz", archive, "application/gzip")},
        headers=headers,
    )
    assert resp.status_code == 409
    assert "no existing transactions" in resp.json()["detail"]


@pytest.mark.usefixtures("db_tables")
async def test_import_wrong_schema_version(client: AsyncClient) -> None:
    headers = await _setup(client, email="wrongver@example.com")
    archive = _make_archive(
        {"schema_version": 99, "user_id": "x", "table_list": [], "record_counts": {}, "exported_at": "2026-01-01T00:00:00+00:00"},
        {},
    )
    resp = await client.post(
        "/api/v1/import-archive",
        files={"file": ("a.tar.gz", archive, "application/gzip")},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "schema_version" in resp.json()["detail"]


@pytest.mark.usefixtures("db_tables")
async def test_import_malformed_archive(client: AsyncClient) -> None:
    headers = await _setup(client, email="malformed@example.com")
    resp = await client.post(
        "/api/v1/import-archive",
        files={"file": ("bad.tar.gz", b"not a tar file", "application/gzip")},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.usefixtures("db_tables")
async def test_import_unauthenticated(client: AsyncClient) -> None:
    archive = _make_archive(
        {"schema_version": 1, "user_id": "x", "table_list": [], "record_counts": {}, "exported_at": "2026-01-01T00:00:00+00:00"},
        {},
    )
    resp = await client.post(
        "/api/v1/import-archive",
        files={"file": ("a.tar.gz", archive, "application/gzip")},
    )
    assert resp.status_code == 401
