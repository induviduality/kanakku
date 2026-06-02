"""Integration tests for settle/forgive/unsettle/unlink endpoints."""

import pytest
from httpx import AsyncClient

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _create_account(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Bank", "type": "bank", "currency": "INR", "opening_balance": "10000.00"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_txn(client: AsyncClient, headers: dict, acc_id: str, txn_type: str, amount: str) -> str:
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": txn_type,
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": amount,
            "account_id": acc_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_payee(client: AsyncClient, headers: dict, name: str = "Alice") -> str:
    resp = await client.post(
        "/api/v1/payees",
        json={"name": name, "type": "person"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_split_with_two_shares(client, headers, acc_id, share_amounts=("800.00", "200.00")):
    """Creates expense sum(amounts), split with given shares. Returns (split_id, share_ids).
    First share is the user's own (null payee), second has a named payee.
    share_ids are returned in the same order as share_amounts.
    """
    total = f"{sum(float(a) for a in share_amounts):.2f}"
    exp_id = await _create_txn(client, headers, acc_id, "expense", total)
    payee_id = await _create_payee(client, headers)
    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_ids": [exp_id],
            "shares": [
                {"amount": share_amounts[0]},  # user's own (null payee)
                {"payee_id": payee_id, "amount": share_amounts[1]},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    # Sort shares to match share_amounts order: null payee first, then named payee
    sorted_shares = sorted(data["shares"], key=lambda s: (s["payee_id"] is not None, s["amount"]))
    return data["id"], [s["id"] for s in sorted_shares]


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    acc_id = await _create_account(client, headers)
    return client, headers, acc_id


# ── Settle: single full payment ───────────────────────────────────────────────

async def test_settle_share_full_payment(authed) -> None:
    """Link one income transaction that covers the full share → status settled."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    inc_id = await _create_txn(client, headers, acc_id, "income", "800.00")
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "settled"
    assert data["paid_amount"] == "800.00"
    assert len(data["settlements"]) == 1
    assert data["settlements"][0]["transaction_id"] == inc_id
    assert data["settlements"][0]["amount"] == "800.00"


async def test_settle_share_multiple_payments(authed) -> None:
    """Two income transactions that together cover the share → status settled after second."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    inc1_id = await _create_txn(client, headers, acc_id, "income", "500.00")
    inc2_id = await _create_txn(client, headers, acc_id, "income", "300.00")

    # First payment: partial
    resp1 = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc1_id},
        headers=headers,
    )
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "pending"
    assert resp1.json()["paid_amount"] == "500.00"

    # Second payment: covers the rest
    resp2 = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc2_id},
        headers=headers,
    )
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["status"] == "settled"
    assert data["paid_amount"] == "800.00"
    assert len(data["settlements"]) == 2


async def test_settle_with_partial_credit_amount(authed) -> None:
    """Income transaction of 1000 but only 800 credited to the share."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]
    inc_id = await _create_txn(client, headers, acc_id, "income", "1000.00")

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id, "amount": "800.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "settled"
    assert data["paid_amount"] == "800.00"
    assert data["settlements"][0]["amount"] == "800.00"


async def test_settle_credit_exceeds_remaining_fails(authed) -> None:
    """Crediting more than the remaining balance → 422."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]
    inc_id = await _create_txn(client, headers, acc_id, "income", "900.00")

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id, "amount": "900.00"},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "exceeds" in resp.json()["detail"].lower()


async def test_settle_fully_resolved_share_fails(authed) -> None:
    """Trying to add another payment to a fully settled share → 422."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    inc1_id = await _create_txn(client, headers, acc_id, "income", "800.00")
    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc1_id},
        headers=headers,
    )

    inc2_id = await _create_txn(client, headers, acc_id, "income", "100.00")
    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc2_id},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "resolved" in resp.json()["detail"].lower()


async def test_settle_duplicate_transaction_fails(authed) -> None:
    """Linking the same income transaction twice to the same share → 409."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]
    inc_id = await _create_txn(client, headers, acc_id, "income", "400.00")

    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id, "amount": "400.00"},
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id, "amount": "400.00"},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_settle_transaction_already_used_for_other_share_fails(authed) -> None:
    """Same income transaction can't be linked to two different shares."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    inc_id = await _create_txn(client, headers, acc_id, "income", "800.00")

    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_ids[0]}/settle",
        json={"transaction_id": inc_id},
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_ids[1]}/settle",
        json={"transaction_id": inc_id},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_settle_with_expense_txn_fails(authed) -> None:
    """Settlement transaction must be income type."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    exp2_id = await _create_txn(client, headers, acc_id, "expense", "100.00")

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_ids[0]}/settle",
        json={"transaction_id": exp2_id},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "income" in resp.json()["detail"].lower()


# ── Unlink settlement ─────────────────────────────────────────────────────────

async def test_unlink_settlement(authed) -> None:
    """Removing a settlement row takes the share back to pending."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]
    inc_id = await _create_txn(client, headers, acc_id, "income", "800.00")

    settle_resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id},
        headers=headers,
    )
    settlement_id = settle_resp.json()["settlements"][0]["id"]

    resp = await client.delete(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settlements/{settlement_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert data["paid_amount"] == "0.00"
    assert len(data["settlements"]) == 0


async def test_unlink_partial_settlement_stays_pending(authed) -> None:
    """Unlink one of two partial payments → share remains pending with reduced paid_amount."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    inc1_id = await _create_txn(client, headers, acc_id, "income", "400.00")
    inc2_id = await _create_txn(client, headers, acc_id, "income", "400.00")

    s1_resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc1_id},
        headers=headers,
    )
    s1_id = s1_resp.json()["settlements"][0]["id"]

    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc2_id},
        headers=headers,
    )

    # Unlink first payment
    resp = await client.delete(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settlements/{s1_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert data["paid_amount"] == "400.00"
    assert len(data["settlements"]) == 1


# ── Forgive ───────────────────────────────────────────────────────────────────

async def test_forgive_full(authed) -> None:
    """Forgive the entire share amount → status forgiven."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        json={"amount": "800.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "forgiven"
    assert data["forgiven_amount"] == "800.00"
    assert data["paid_amount"] == "0.00"


async def test_forgive_partial(authed) -> None:
    """Forgive part of a share → still pending (not fully resolved)."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        json={"amount": "300.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert data["forgiven_amount"] == "300.00"


async def test_forgive_half_paid_half_forgiven(authed) -> None:
    """Payee paid half, forgive the rest → share becomes settled."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    # Link 400 payment
    inc_id = await _create_txn(client, headers, acc_id, "income", "400.00")
    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id, "amount": "400.00"},
        headers=headers,
    )

    # Forgive remaining 400
    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        json={"amount": "400.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # paid > 0, so status is settled (not forgiven)
    assert data["status"] == "settled"
    assert data["paid_amount"] == "400.00"
    assert data["forgiven_amount"] == "400.00"


async def test_forgive_amount_exceeds_remaining_fails(authed) -> None:
    """paid + forgiven > share.amount → 422."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    inc_id = await _create_txn(client, headers, acc_id, "income", "500.00")
    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id, "amount": "500.00"},
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        json={"amount": "400.00"},  # 500 paid + 400 forgiven > 800
        headers=headers,
    )
    assert resp.status_code == 422


async def test_forgive_update_reduces_amount(authed) -> None:
    """Calling forgive again with a lower amount reduces forgiven_amount."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        json={"amount": "800.00"},
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        json={"amount": "400.00"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["forgiven_amount"] == "400.00"
    assert data["status"] == "pending"


# ── Unsettle ──────────────────────────────────────────────────────────────────

async def test_unsettle_clears_all(authed) -> None:
    """Unsettle resets both settlements and forgiveness to zero."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    inc_id = await _create_txn(client, headers, acc_id, "income", "400.00")
    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/settle",
        json={"transaction_id": inc_id, "amount": "400.00"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/forgive",
        json={"amount": "400.00"},
        headers=headers,
    )

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/unsettle",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "pending"
    assert data["paid_amount"] == "0.00"
    assert data["forgiven_amount"] == "0.00"
    assert len(data["settlements"]) == 0


async def test_unsettle_already_pending_fails(authed) -> None:
    """Unsettling a clean pending share → 422."""
    client, headers, acc_id = authed
    split_id, share_ids = await _create_split_with_two_shares(client, headers, acc_id)
    share_id = share_ids[0]

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{share_id}/unsettle",
        headers=headers,
    )
    assert resp.status_code == 422


# ── Auth + not found guards ───────────────────────────────────────────────────

async def test_settle_requires_auth(client: AsyncClient, db_tables: None) -> None:
    import uuid
    sid, shid = str(uuid.uuid4()), str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/splits/{sid}/shares/{shid}/settle",
        json={"transaction_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


async def test_share_not_found(authed) -> None:
    import uuid
    client, headers, acc_id = authed
    split_id, _ = await _create_split_with_two_shares(client, headers, acc_id)

    resp = await client.post(
        f"/api/v1/splits/{split_id}/shares/{uuid.uuid4()}/forgive",
        json={"amount": "100.00"},
        headers=headers,
    )
    assert resp.status_code == 404
