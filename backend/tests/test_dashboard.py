"""Integration tests for GET /api/v1/dashboard/home."""
from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from tests._helpers import register_second_user

# ── Helpers ───────────────────────────────────────────────────────────────────

async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _account(client: AsyncClient, headers: dict, name: str = "Savings") -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": name, "type": "bank", "currency": "INR", "opening_balance": "10000.00"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _category(client: AsyncClient, headers: dict, name: str = "Food") -> str:
    resp = await client.post(
        "/api/v1/categories",
        json={"name": name, "applicability": "expense"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _txn(
    client: AsyncClient,
    headers: dict,
    acc_id: str,
    amount: str = "500.00",
    txn_type: str = "expense",
    date_str: str | None = None,
    category_ids: list[str] | None = None,
) -> dict:
    today = date.today()
    date_str = date_str or f"{today.year}-{today.month:02d}-10T10:00:00Z"
    payload = {
        "type": txn_type,
        "transacted_at": date_str,
        "amount": amount,
        "account_id": acc_id,
    }
    if category_ids:
        payload["category_ids"] = category_ids
    resp = await client.post("/api/v1/transactions", json=payload, headers=headers)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def authed(client: AsyncClient, db_tables: None):
    headers = await _setup(client)
    acc_id = await _account(client, headers)
    return client, headers, acc_id


# ── Tests ─────────────────────────────────────────────────────────────────────

async def test_dashboard_structure(authed) -> None:
    client, headers, _ = authed
    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "month" in data
    assert "total_spent_net" in data
    assert "total_income" in data
    assert "budgets_summary" in data
    assert "category_breakdown" in data
    assert "recent_transactions" in data
    assert "pending_splits_summary" in data
    assert "piggy_banks_summary" in data
    assert "account_balances" in data
    assert "active_subscriptions" in data


async def test_dashboard_empty_state(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_spent_net"] == "0"
    assert data["total_income"] == "0"
    # Account creation seeds a real opening_balance Transaction row (see
    # account_balance.py) so "empty" means no user-entered activity, not a
    # literally empty transaction table.
    assert len(data["recent_transactions"]) == 1
    assert data["recent_transactions"][0]["type"] == "opening_balance"
    assert data["budgets_summary"] == []
    assert data["category_breakdown"] == []
    assert data["pending_splits_summary"]["count"] == 0
    assert data["pending_splits_summary"]["total_owed"] == "0"
    assert data["pending_splits_summary"]["by_payee"] == []
    assert data["piggy_banks_summary"] == []
    # account shows up in balances
    assert len(data["account_balances"]) == 1
    assert data["account_balances"][0]["balance"] == "10000.00"


async def test_dashboard_month_format(authed) -> None:
    client, headers, _ = authed
    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    today = date.today()
    assert data["month"] == today.strftime("%Y-%m")


async def test_dashboard_totals_with_transactions(authed) -> None:
    client, headers, acc_id = authed
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    await _txn(client, headers, acc_id, "1000.00", "expense", this_month)
    await _txn(client, headers, acc_id, "500.00", "expense", this_month)
    await _txn(client, headers, acc_id, "85000.00", "income", this_month)

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    assert float(data["total_spent_net"]) == pytest.approx(1500.0)
    assert float(data["total_income"]) == pytest.approx(85000.0)


async def test_dashboard_transfers_excluded_from_totals(authed) -> None:
    client, headers, acc_id = authed
    acc2_id = await _account(client, headers, "Savings2")
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    # Transfer should not affect spent/income
    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "transfer",
            "transacted_at": this_month,
            "amount": "5000.00",
            "account_id": acc_id,
            "to_account_id": acc2_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    assert float(data["total_spent_net"]) == 0
    assert float(data["total_income"]) == 0


async def test_dashboard_category_breakdown(authed) -> None:
    client, headers, acc_id = authed
    cat_id = await _category(client, headers, "Food")
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    await _txn(client, headers, acc_id, "600.00", "expense", this_month, [cat_id])
    await _txn(client, headers, acc_id, "400.00", "expense", this_month, [cat_id])

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    breakdown = data["category_breakdown"]
    assert len(breakdown) == 1
    assert breakdown[0]["name"] == "Food"
    assert float(breakdown[0]["amount"]) == pytest.approx(1000.0)
    assert float(breakdown[0]["percentage"]) == pytest.approx(100.0)


async def test_dashboard_category_breakdown_percentage(authed) -> None:
    client, headers, acc_id = authed
    cat_food = await _category(client, headers, "Food")
    cat_transport = await _category(client, headers, "Transport")
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    await _txn(client, headers, acc_id, "750.00", "expense", this_month, [cat_food])
    await _txn(client, headers, acc_id, "250.00", "expense", this_month, [cat_transport])

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    amounts = {item["name"]: float(item["amount"]) for item in data["category_breakdown"]}
    assert amounts["Food"] == pytest.approx(750.0)
    assert amounts["Transport"] == pytest.approx(250.0)
    pcts = {item["name"]: float(item["percentage"]) for item in data["category_breakdown"]}
    assert pcts["Food"] == pytest.approx(75.0)
    assert pcts["Transport"] == pytest.approx(25.0)


async def test_dashboard_recent_transactions_limit(authed) -> None:
    client, headers, acc_id = authed
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    for _ in range(7):
        await _txn(client, headers, acc_id, "100.00", "expense", this_month)

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    assert len(data["recent_transactions"]) == 5


async def test_dashboard_budget_summary(authed) -> None:
    client, headers, acc_id = authed
    cat_id = await _category(client, headers, "Food")
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    # Create budget linked to food category
    resp = await client.post(
        "/api/v1/budgets",
        json={
            "name": "Food Budget",
            "amount": "5000.00",
            "currency": "INR",
            "type": "adhoc",
            "category_ids": [cat_id],
        },
        headers=headers,
    )
    assert resp.status_code == 201

    # Add category-matched expenses
    await _txn(client, headers, acc_id, "1000.00", "expense", this_month, [cat_id])
    await _txn(client, headers, acc_id, "500.00", "expense", this_month, [cat_id])

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    budgets = data["budgets_summary"]
    assert len(budgets) == 1
    assert budgets[0]["name"] == "Food Budget"
    assert float(budgets[0]["spent"]) == pytest.approx(1500.0)
    assert float(budgets[0]["percentage"]) == pytest.approx(30.0)
    assert budgets[0]["status"] == "on_track"


async def test_dashboard_budget_over_budget(authed) -> None:
    client, headers, acc_id = authed
    cat_id = await _category(client, headers, "Misc")
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    await client.post(
        "/api/v1/budgets",
        json={
            "name": "Tight Budget",
            "amount": "500.00",
            "currency": "INR",
            "type": "adhoc",
            "category_ids": [cat_id],
        },
        headers=headers,
    )
    await _txn(client, headers, acc_id, "600.00", "expense", this_month, [cat_id])

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    assert data["budgets_summary"][0]["status"] == "over_budget"


async def test_dashboard_account_balances(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    balances = data["account_balances"]
    assert len(balances) == 1
    assert balances[0]["id"] == acc_id
    assert balances[0]["name"] == "Savings"


async def test_dashboard_same_currency_transfer_credits_destination_balance(authed) -> None:
    """A same-currency transfer (the normal case — frontend never sends
    to_amount) must still credit the destination account in both
    account_balances and the cashflow_by_account running balance. Regression
    for a bug where `SUM(to_amount)` silently dropped every transfer-in
    because to_amount is NULL unless the transfer is cross-currency."""
    client, headers, acc1_id = authed
    acc2_id = await _account(client, headers, "Savings2")
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    resp = await client.post(
        "/api/v1/transactions",
        json={
            "type": "transfer",
            "transacted_at": this_month,
            "amount": "5000.00",
            "account_id": acc1_id,
            "to_account_id": acc2_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()

    balances = {b["id"]: b["balance"] for b in data["account_balances"]}
    assert balances[acc1_id] == "5000.00"   # 10000 - 5000
    assert balances[acc2_id] == "15000.00"  # 10000 + 5000 (not just 10000)

    acc2_buckets = [b for b in data["cashflow_by_account"] if b["account_id"] == acc2_id]
    assert acc2_buckets, "destination account should appear in cashflow_by_account"
    assert acc2_buckets[-1]["balance"] == "15000.00"


async def test_dashboard_account_balances_as_of_period_end(authed) -> None:
    """account_balances reflects the balance at the END of the selected period,
    not the account's live current_balance — a later transaction shouldn't
    leak into an earlier period's snapshot.

    Anchored on "today" (not a fixed past month) since account creation now
    seeds the ledger with an opening_balance transaction dated at creation
    time (see account_balance.py) — a period entirely before that timestamp
    wouldn't see the opening balance at all, which is correct but not what
    this test is checking.
    """
    client, headers, acc_id = authed
    today = date.today()
    tomorrow = today + timedelta(days=1)

    # Opening balance (10000, dated "now") + 5000 income dated today →
    # 15000.00 as of end of today. -300 expense dated tomorrow must not
    # leak into a period ending today.
    await _txn(client, headers, acc_id, "5000.00", "income", f"{today.isoformat()}T12:00:00Z")
    await _txn(client, headers, acc_id, "300.00", "expense", f"{tomorrow.isoformat()}T00:00:00Z")

    resp = await client.get(
        "/api/v1/dashboard/home",
        params={
            "period": "custom",
            # start_date/end_date are absolute UTC instants, not bare dates
            # (the endpoint no longer guesses a timezone from a date-only
            # value — see docs/decisions/log.md 2026-07-11 (11)). end_date is
            # exclusive, so "today only" is [today 00:00, tomorrow 00:00).
            "start_date": f"{today.isoformat()}T00:00:00Z",
            "end_date": f"{tomorrow.isoformat()}T00:00:00Z",
        },
        headers=headers,
    )
    data = resp.json()
    balances = {b["id"]: b["balance"] for b in data["account_balances"]}
    assert balances[acc_id] == "15000.00"

    # Current month (default): nothing dated beyond today, so this reduces
    # to the live current_balance.
    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    balances = {b["id"]: b["balance"] for b in data["account_balances"]}
    assert balances[acc_id] == "14700.00"


async def test_dashboard_piggy_banks_summary(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/piggy-banks",
        json={"name": "Vacation", "target_amount": "50000.00", "currency": "INR"},
        headers=headers,
    )
    assert resp.status_code == 201

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    pigs = data["piggy_banks_summary"]
    assert len(pigs) == 1
    assert pigs[0]["name"] == "Vacation"
    assert float(pigs[0]["progress_pct"]) == pytest.approx(0.0)
    assert pigs[0]["is_completed"] is False


async def test_dashboard_active_subscriptions(authed) -> None:
    client, headers, acc_id = authed
    resp = await client.post(
        "/api/v1/subscriptions",
        json={
            "name": "Netflix",
            "amount": "649.00",
            "currency": "INR",
            "billing_cycle": "monthly",
            "billing_day": 15,
            "account_id": acc_id,
        },
        headers=headers,
    )
    assert resp.status_code == 201

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    subs = data["active_subscriptions"]
    assert len(subs) == 1
    assert subs[0]["name"] == "Netflix"
    assert subs[0]["status"] in ("upcoming", "due_soon", "overdue")
    assert subs[0]["next_billing_date"] is not None


async def test_dashboard_cross_user_isolation(client: AsyncClient, db_tables: None) -> None:
    h1 = await _setup(client, "user1@example.com")
    h2 = await register_second_user(client, h1, "user2@example.com")
    acc1 = await _account(client, h1, "User1 Account")
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"
    await _txn(client, h1, acc1, "999.00", "expense", this_month)

    resp = await client.get("/api/v1/dashboard/home", headers=h2)
    data = resp.json()
    assert float(data["total_spent_net"]) == 0
    assert data["recent_transactions"] == []
    assert data["account_balances"] == []


async def test_dashboard_prev_month_excluded_from_totals(authed) -> None:
    client, headers, acc_id = authed
    today = date.today()
    # Last month
    if today.month == 1:
        last_month = f"{today.year - 1}-12-15T10:00:00Z"
    else:
        last_month = f"{today.year}-{today.month - 1:02d}-15T10:00:00Z"

    await _txn(client, headers, acc_id, "9999.00", "expense", last_month)

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    assert float(data["total_spent_net"]) == 0


async def test_dashboard_pending_splits_summary(authed) -> None:
    client, headers, acc_id = authed
    today = date.today()
    this_month = f"{today.year}-{today.month:02d}-10T10:00:00Z"

    # Create a payee
    resp = await client.post(
        "/api/v1/payees", json={"name": "Alice", "type": "person"}, headers=headers
    )
    payee_id = resp.json()["id"]

    # Create expense
    txn = await _txn(client, headers, acc_id, "1000.00", "expense", this_month)

    # Create split with pending share for Alice
    resp = await client.post(
        "/api/v1/splits",
        json={
            "expense_transaction_ids": [txn["id"]],
            "shares": [
                {"payee_id": None, "amount": "500.00"},
                {"payee_id": payee_id, "amount": "500.00"},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201

    resp = await client.get("/api/v1/dashboard/home", headers=headers)
    data = resp.json()
    splits = data["pending_splits_summary"]
    assert splits["count"] == 1
    assert float(splits["total_owed"]) == pytest.approx(500.0)
    assert len(splits["by_payee"]) == 1
    assert splits["by_payee"][0]["payee_name"] == "Alice"
