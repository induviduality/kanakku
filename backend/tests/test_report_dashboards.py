"""Tests for /api/v1/reports/dashboards CRUD."""

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": "admin@example.com", "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _dashboard(client: AsyncClient, headers: dict, name: str = "My Dashboard") -> dict:
    resp = await client.post(
        "/api/v1/reports/dashboards",
        json={"name": name, "description": "A test dashboard"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


@pytest.mark.usefixtures("db_tables")
async def test_create_dashboard(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.post(
        "/api/v1/reports/dashboards",
        json={"name": "Spending Overview", "description": "Monthly spending"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Spending Overview"
    assert data["description"] == "Monthly spending"
    assert data["deleted_at"] is None


@pytest.mark.usefixtures("db_tables")
async def test_list_dashboards(client: AsyncClient) -> None:
    headers = await _setup(client)
    await _dashboard(client, headers, "D1")
    await _dashboard(client, headers, "D2")
    resp = await client.get("/api/v1/reports/dashboards", headers=headers)
    assert resp.status_code == 200
    names = [d["name"] for d in resp.json()]
    assert "D1" in names
    assert "D2" in names


@pytest.mark.usefixtures("db_tables")
async def test_get_dashboard(client: AsyncClient) -> None:
    headers = await _setup(client)
    created = await _dashboard(client, headers)
    resp = await client.get(f"/api/v1/reports/dashboards/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


@pytest.mark.usefixtures("db_tables")
async def test_update_dashboard(client: AsyncClient) -> None:
    headers = await _setup(client)
    created = await _dashboard(client, headers)
    resp = await client.patch(
        f"/api/v1/reports/dashboards/{created['id']}",
        json={"name": "Updated Name"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


@pytest.mark.usefixtures("db_tables")
async def test_delete_dashboard(client: AsyncClient) -> None:
    headers = await _setup(client)
    created = await _dashboard(client, headers)
    resp = await client.delete(f"/api/v1/reports/dashboards/{created['id']}", headers=headers)
    assert resp.status_code == 204
    # Soft-deleted — should not appear in list
    resp2 = await client.get("/api/v1/reports/dashboards", headers=headers)
    assert all(d["id"] != created["id"] for d in resp2.json())


@pytest.mark.usefixtures("db_tables")
async def test_dashboard_access_control(client: AsyncClient) -> None:
    headers1 = await _setup(client)
    # Verify 404 for a nonexistent dashboard
    resp = await client.get(
        "/api/v1/reports/dashboards/00000000-0000-0000-0000-000000000099",
        headers=headers1,
    )
    assert resp.status_code == 404


# ── Widget CRUD ───────────────────────────────────────────────────────────────

_WIDGET_PAYLOAD = {
    "title": "Spending by Category",
    "query": "SELECT name, amount FROM categories WHERE user_id = :user_id",
    "viz_type": "bar",
    "viz_config": {"x_key": "name", "y_key": "amount"},
    "position": {"x": 0, "y": 0, "w": 6, "h": 4},
}


@pytest.mark.usefixtures("db_tables")
async def test_create_widget(client: AsyncClient) -> None:
    headers = await _setup(client)
    dash = await _dashboard(client, headers)
    resp = await client.post(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        json=_WIDGET_PAYLOAD,
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Spending by Category"
    assert data["viz_type"] == "bar"
    assert data["position"] == {"x": 0, "y": 0, "w": 6, "h": 4}


@pytest.mark.usefixtures("db_tables")
async def test_list_widgets(client: AsyncClient) -> None:
    headers = await _setup(client)
    dash = await _dashboard(client, headers)
    await client.post(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        json={**_WIDGET_PAYLOAD, "title": "W1"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        json={**_WIDGET_PAYLOAD, "title": "W2"},
        headers=headers,
    )
    resp = await client.get(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        headers=headers,
    )
    assert resp.status_code == 200
    titles = [w["title"] for w in resp.json()]
    assert "W1" in titles
    assert "W2" in titles


@pytest.mark.usefixtures("db_tables")
async def test_update_widget(client: AsyncClient) -> None:
    headers = await _setup(client)
    dash = await _dashboard(client, headers)
    wid_resp = await client.post(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        json=_WIDGET_PAYLOAD,
        headers=headers,
    )
    widget_id = wid_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets/{widget_id}",
        json={"title": "Renamed Widget"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed Widget"


@pytest.mark.usefixtures("db_tables")
async def test_delete_widget(client: AsyncClient) -> None:
    headers = await _setup(client)
    dash = await _dashboard(client, headers)
    wid_resp = await client.post(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        json=_WIDGET_PAYLOAD,
        headers=headers,
    )
    widget_id = wid_resp.json()["id"]
    resp = await client.delete(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets/{widget_id}",
        headers=headers,
    )
    assert resp.status_code == 204
    # Should not appear in list
    list_resp = await client.get(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        headers=headers,
    )
    assert all(w["id"] != widget_id for w in list_resp.json())


@pytest.mark.usefixtures("db_tables")
async def test_widget_cascade_delete_with_dashboard(client: AsyncClient) -> None:
    headers = await _setup(client)
    dash = await _dashboard(client, headers)
    await client.post(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        json=_WIDGET_PAYLOAD,
        headers=headers,
    )
    # Delete dashboard
    await client.delete(f"/api/v1/reports/dashboards/{dash['id']}", headers=headers)
    # Widgets endpoint should 404 since dashboard is soft-deleted
    resp = await client.get(
        f"/api/v1/reports/dashboards/{dash['id']}/widgets",
        headers=headers,
    )
    assert resp.status_code == 404
