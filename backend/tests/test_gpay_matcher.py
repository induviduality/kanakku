"""Tests for GPay matcher service (parse + match) and endpoints."""

import json
import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient

from app.services.gpay_matcher import (
    GPayRecord,
    MatchResult,
    _find_candidates,
    _parse_record,
    parse_takeout,
)
from app.models.gpay_match import GPayMatchStatus


# ── parse_takeout ─────────────────────────────────────────────────────────────

def test_parse_takeout_list_of_records():
    data = json.dumps([
        {"Date": "2024-01-15", "Amount": "420.00", "Description": "Zomato", "Currency": "INR"},
        {"Date": "2024-01-16", "Amount": "1200.00", "Description": "Amazon", "Currency": "INR"},
    ])
    records = parse_takeout(data)
    assert len(records) == 2
    assert records[0].merchant == "Zomato"
    assert records[0].amount == Decimal("420.00")
    assert records[0].date == date(2024, 1, 15)


def test_parse_takeout_wrapped_dict():
    data = {"transactions": [
        {"Date": "2024-02-01", "Amount": "500", "Description": "Swiggy"},
    ]}
    records = parse_takeout(data)
    assert len(records) == 1
    assert records[0].merchant == "Swiggy"


def test_parse_takeout_strips_rupee_symbol():
    data = [{"Date": "2024-01-01", "Amount": "₹1,000.00", "Description": "MakeMyTrip"}]
    records = parse_takeout(data)
    assert records[0].amount == Decimal("1000.00")


def test_parse_takeout_skips_invalid_records():
    data = [
        {"Date": "bad-date", "Amount": "100", "Description": "X"},
        {"Date": "2024-01-01", "Amount": "-50", "Description": "Y"},  # negative skipped
        {"Date": "2024-01-02", "Amount": "200", "Description": "Ola"},
    ]
    records = parse_takeout(data)
    assert len(records) == 1
    assert records[0].merchant == "Ola"


def test_parse_record_multiple_date_formats():
    r = _parse_record({"Date": "15/01/2024", "Amount": "300", "Description": "X"})
    assert r is not None
    assert r.date == date(2024, 1, 15)


def test_parse_takeout_empty_list():
    records = parse_takeout([])
    assert records == []


# ── match paths ───────────────────────────────────────────────────────────────

async def _make_user_with_transaction(client: AsyncClient, amount: str = "420.00"):
    """Create user + account + transaction; return (token, txn_id)."""
    r = await client.post(
        "/api/v1/auth/setup",
        json={"email": f"gpay_{uuid.uuid4().hex[:6]}@test.com", "password": "pass1234"},
    )
    assert r.status_code == 201
    token = r.json()["access_token"]

    acc = await client.post(
        "/api/v1/accounts",
        json={"name": "HDFC", "type": "bank", "opening_balance": "0"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert acc.status_code == 201
    acc_id = acc.json()["id"]

    txn = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2024-01-15T10:00:00+05:30",
            "amount": amount,
            "currency": "INR",
            "account_id": acc_id,
            "description": "UPI debit",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert txn.status_code == 201
    return token, txn.json()["id"]


@pytest.fixture
async def setup_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    return client


async def test_gpay_takeout_exact_match_auto_links(setup_client: AsyncClient) -> None:
    token, txn_id = await _make_user_with_transaction(setup_client, "420.00")

    payload = [{"Date": "2024-01-15", "Amount": "420.00", "Description": "Zomato"}]
    resp = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", json.dumps(payload), "application/json")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["parsed"] == 1
    assert data["auto_linked"] == 1
    assert data["pending"] == 0
    assert data["orphans"] == 0
    assert data["matches"][0]["status"] == "auto_linked"
    assert data["matches"][0]["chosen_transaction_id"] == txn_id


async def test_gpay_takeout_orphan_no_candidates(setup_client: AsyncClient) -> None:
    token, _ = await _make_user_with_transaction(setup_client, "420.00")

    payload = [{"Date": "2024-06-01", "Amount": "9999.00", "Description": "Mystery"}]
    resp = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", json.dumps(payload), "application/json")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["orphans"] == 1
    assert data["matches"][0]["status"] == "orphan"


async def test_gpay_takeout_ambiguous_two_candidates(setup_client: AsyncClient) -> None:
    token, _ = await _make_user_with_transaction(setup_client, "200.00")
    # Create second transaction with same amount/date
    acc_resp = await setup_client.get(
        "/api/v1/accounts", headers={"Authorization": f"Bearer {token}"}
    )
    acc_id = acc_resp.json()[0]["id"]
    await setup_client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2024-01-15T12:00:00+05:30",
            "amount": "200.00",
            "currency": "INR",
            "account_id": acc_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    payload = [{"Date": "2024-01-15", "Amount": "200.00", "Description": "Ambiguous"}]
    resp = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", json.dumps(payload), "application/json")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pending"] == 1
    match = data["matches"][0]
    assert match["status"] == "pending"
    assert len(match["candidate_transaction_ids"]) == 2


async def test_gpay_takeout_invalid_json_returns_422(setup_client: AsyncClient) -> None:
    token, _ = await _make_user_with_transaction(setup_client)
    resp = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", b"not-json", "application/json")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_gpay_takeout_empty_records_422(setup_client: AsyncClient) -> None:
    token, _ = await _make_user_with_transaction(setup_client)
    resp = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", json.dumps([]).encode(), "application/json")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


async def test_gpay_matches_list(setup_client: AsyncClient) -> None:
    token, _ = await _make_user_with_transaction(setup_client)
    payload = [{"Date": "2024-06-01", "Amount": "9999.00", "Description": "Orphan"}]
    await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", json.dumps(payload), "application/json")},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await setup_client.get(
        "/api/v1/imports/gpay-matches",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_resolve_pending_match(setup_client: AsyncClient) -> None:
    token, txn_id = await _make_user_with_transaction(setup_client, "200.00")
    acc_resp = await setup_client.get(
        "/api/v1/accounts", headers={"Authorization": f"Bearer {token}"}
    )
    acc_id = acc_resp.json()[0]["id"]
    await setup_client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "transacted_at": "2024-01-15T15:00:00+05:30",
            "amount": "200.00",
            "currency": "INR",
            "account_id": acc_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    payload = [{"Date": "2024-01-15", "Amount": "200.00", "Description": "Swiggy"}]
    upload = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", json.dumps(payload), "application/json")},
        headers={"Authorization": f"Bearer {token}"},
    )
    match_id = upload.json()["matches"][0]["id"]

    resp = await setup_client.post(
        f"/api/v1/imports/gpay-matches/{match_id}/resolve",
        json={"chosen_transaction_id": txn_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"
    assert resp.json()["chosen_transaction_id"] == txn_id


async def test_resolve_cross_user_404(setup_client: AsyncClient) -> None:
    """User B cannot resolve User A's match."""
    token_a, _ = await _make_user_with_transaction(setup_client, "200.00")
    token_b, txn_b = await _make_user_with_transaction(setup_client, "200.00")

    acc_resp = await setup_client.get(
        "/api/v1/accounts", headers={"Authorization": f"Bearer {token_a}"}
    )
    acc_id = acc_resp.json()[0]["id"]
    await setup_client.post(
        "/api/v1/transactions",
        json={"type": "expense", "transacted_at": "2024-01-15T15:00:00+05:30",
              "amount": "200.00", "currency": "INR", "account_id": acc_id},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    payload = [{"Date": "2024-01-15", "Amount": "200.00", "Description": "X"}]
    upload = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("takeout.json", json.dumps(payload), "application/json")},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    match_id = upload.json()["matches"][0]["id"]

    resp = await setup_client.post(
        f"/api/v1/imports/gpay-matches/{match_id}/resolve",
        json={"chosen_transaction_id": txn_b},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404


async def test_gpay_takeout_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/imports/gpay-takeout",
        files={"file": ("t.json", b"[]", "application/json")},
    )
    assert resp.status_code == 401
