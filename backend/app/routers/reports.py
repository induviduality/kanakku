from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import sqlalchemy as sa
import sqlglot
import sqlglot.expressions as exp
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_readonly_engine, get_session
from app.dependencies import get_current_user
from app.models.report_dashboard import ReportDashboard, ReportWidget, VizType
from app.models.user import User
from app.schemas.reports import (
    ColumnInfo,
    DashboardCreate,
    DashboardResponse,
    DashboardUpdate,
    QueryRequest,
    QueryResponse,
    SchemaResponse,
    TableInfo,
    WidgetCreate,
    WidgetResponse,
    WidgetUpdate,
)

router = APIRouter(prefix="/reports", tags=["reports"])


# ── SQL validation ─────────────────────────────────────────────────────────────

def _validate_sql(sql: str) -> None:
    cleaned = sql.strip().rstrip(";")
    if ";" in cleaned:
        raise ValueError("Multiple statements are not allowed")

    try:
        stmt = sqlglot.parse_one(sql, dialect="postgres")
    except Exception as exc:
        raise ValueError(f"Invalid SQL: {exc}") from exc

    if not isinstance(stmt, exp.Select):
        raise ValueError("Only SELECT statements are allowed")

    has_user_id = any(
        isinstance(node, exp.Column) and node.name.lower() == "user_id"
        for node in stmt.walk()
    )
    if not has_user_id:
        raise ValueError(
            "Query must include a user_id filter (e.g. WHERE user_id = :user_id)"
        )


def _serialize_value(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return v


# ── Query endpoint ─────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def run_query(
    req: QueryRequest,
    user: User = Depends(get_current_user),
) -> QueryResponse:
    try:
        _validate_sql(req.sql)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    bind_params: dict[str, Any] = {**(req.params or {}), "user_id": user.id}

    try:
        async with get_readonly_engine().begin() as conn:
            await conn.execute(text("SET TRANSACTION READ ONLY"))
            await conn.execute(
                text(f"SET LOCAL statement_timeout = '{settings.query_timeout_ms}'")
            )
            result = await conn.execute(text(req.sql).bindparams(**bind_params))
            columns = list(result.keys())
            fetch_limit = settings.query_row_limit + 1
            raw_rows = result.fetchmany(fetch_limit)
            truncated = len(raw_rows) > settings.query_row_limit
            rows: list[dict[str, Any]] = [
                {col: _serialize_value(val) for col, val in zip(columns, row)}
                for row in raw_rows[: settings.query_row_limit]
            ]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return QueryResponse(
        columns=columns,
        rows=rows,
        row_count=len(rows),
        truncated=truncated,
    )


# ── Schema reference ───────────────────────────────────────────────────────────

_SCHEMA: list[TableInfo] = [
    TableInfo(
        name="accounts",
        description="Bank, cash, credit card, and digital wallet accounts",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="name", type="text", description="Account display name"),
            ColumnInfo(name="type", type="text", description="Account type: bank, cash, credit_card, loan"),
            ColumnInfo(name="currency", type="text", description="ISO currency code (e.g. INR, USD)"),
            ColumnInfo(name="opening_balance", type="numeric", description="Initial balance when account was created"),
            ColumnInfo(name="current_balance", type="numeric", description="Running balance (updated on each transaction)"),
            ColumnInfo(name="is_active", type="boolean", description="Whether the account is active"),
            ColumnInfo(name="created_at", type="timestamptz", description="Creation timestamp"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp (NULL = not deleted)"),
        ],
    ),
    TableInfo(
        name="transactions",
        description="All financial transactions (expense, income, transfer, opening_balance)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="type", type="text", description="Transaction type: expense, income, transfer, opening_balance"),
            ColumnInfo(name="transacted_at", type="timestamptz", description="When the transaction occurred"),
            ColumnInfo(name="amount", type="numeric", description="Transaction amount (positive)"),
            ColumnInfo(name="currency", type="text", description="Transaction currency (may differ from account)"),
            ColumnInfo(name="description", type="text", description="Free-text description"),
            ColumnInfo(name="notes", type="text", description="Additional notes"),
            ColumnInfo(name="external_ref", type="text", description="External reference (UTR, UPI ref, etc.)"),
            ColumnInfo(name="account_id", type="uuid", description="Source account", foreign_key="accounts.id"),
            ColumnInfo(name="payee_id", type="uuid", description="Payee (merchant or person)", foreign_key="payees.id"),
            ColumnInfo(name="payment_method_id", type="uuid", description="Payment method used", foreign_key="payment_methods.id"),
            ColumnInfo(name="to_account_id", type="uuid", description="Destination account for transfers", foreign_key="accounts.id"),
            ColumnInfo(name="to_amount", type="numeric", description="Amount in destination currency (transfers)"),
            ColumnInfo(name="to_currency", type="text", description="Destination currency (transfers)"),
            ColumnInfo(name="subscription_id", type="uuid", description="Linked subscription", foreign_key="subscriptions.id"),
            ColumnInfo(name="import_record_id", type="uuid", description="Source import record", foreign_key="raw_import_records.id"),
            ColumnInfo(name="created_at", type="timestamptz", description="Creation timestamp"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="categories",
        description="Transaction categories (food, transport, etc.)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="name", type="text", description="Category name"),
            ColumnInfo(name="icon", type="text", description="Emoji or icon identifier"),
            ColumnInfo(name="color", type="text", description="Hex color code"),
            ColumnInfo(name="applicability", type="text", description="Applicable to: expense, income, both"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="tags",
        description="Free-form tags for transactions",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="name", type="text", description="Tag name"),
            ColumnInfo(name="color", type="text", description="Hex color code"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="payees",
        description="Merchants, people, or organizations that are payees",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="name", type="text", description="Payee display name"),
            ColumnInfo(name="type", type="text", description="Payee type: merchant, person, business, other"),
            ColumnInfo(name="notes", type="text", description="Optional notes"),
            ColumnInfo(name="is_active", type="boolean", description="Whether the payee is active"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="payment_methods",
        description="Payment methods linked to accounts (cards, UPI apps)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="account_id", type="uuid", description="Parent account", foreign_key="accounts.id"),
            ColumnInfo(name="name", type="text", description="Payment method name"),
            ColumnInfo(name="type", type="text", description="Type: debit_card, credit_card, upi, net_banking, cash, other"),
            ColumnInfo(name="upi_app", type="text", description="UPI app name (for UPI type)"),
            ColumnInfo(name="is_active", type="boolean", description="Whether the method is active"),
        ],
    ),
    TableInfo(
        name="transaction_categories",
        description="Many-to-many join: transactions ↔ categories",
        columns=[
            ColumnInfo(name="transaction_id", type="uuid", description="Transaction", foreign_key="transactions.id"),
            ColumnInfo(name="category_id", type="uuid", description="Category", foreign_key="categories.id"),
        ],
    ),
    TableInfo(
        name="transaction_tags",
        description="Many-to-many join: transactions ↔ tags",
        columns=[
            ColumnInfo(name="transaction_id", type="uuid", description="Transaction", foreign_key="transactions.id"),
            ColumnInfo(name="tag_id", type="uuid", description="Tag", foreign_key="tags.id"),
        ],
    ),
    TableInfo(
        name="transaction_budgets",
        description="Many-to-many join: transactions ↔ budgets (explicit links)",
        columns=[
            ColumnInfo(name="transaction_id", type="uuid", description="Transaction", foreign_key="transactions.id"),
            ColumnInfo(name="budget_id", type="uuid", description="Budget", foreign_key="budgets.id"),
        ],
    ),
    TableInfo(
        name="splits",
        description="Split expense tracking — one split can span multiple expense transactions",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="notes", type="text", description="Notes about the split"),
            ColumnInfo(name="created_at", type="timestamptz", description="Creation timestamp"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="split_expenses",
        description="Join table linking expense transactions to a split (one split can have multiple expenses)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="split_id", type="uuid", description="Parent split", foreign_key="splits.id"),
            ColumnInfo(name="transaction_id", type="uuid", description="Expense transaction (unique — one expense belongs to at most one split)", foreign_key="transactions.id"),
        ],
    ),
    TableInfo(
        name="split_shares",
        description="Individual shares in a split (one row per person including the user)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="split_id", type="uuid", description="Parent split", foreign_key="splits.id"),
            ColumnInfo(name="payee_id", type="uuid", description="Person (NULL = user's own share)", foreign_key="payees.id"),
            ColumnInfo(name="amount", type="numeric", description="Share amount"),
            ColumnInfo(name="status", type="text", description="Status: pending, settled, forgiven"),
            ColumnInfo(name="forgiven_amount", type="numeric", description="Amount partially forgiven (0 if none)"),
            ColumnInfo(name="notes", type="text", description="Notes on this share"),
            ColumnInfo(name="created_at", type="timestamptz", description="Creation timestamp"),
        ],
    ),
    TableInfo(
        name="split_share_settlements",
        description="Records of income transactions that settle a split share (supports partial and multi-payment settlement)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="share_id", type="uuid", description="Share being settled", foreign_key="split_shares.id"),
            ColumnInfo(name="transaction_id", type="uuid", description="Income transaction representing repayment", foreign_key="transactions.id"),
            ColumnInfo(name="amount", type="numeric", description="Amount settled by this transaction"),
            ColumnInfo(name="created_at", type="timestamptz", description="Creation timestamp"),
        ],
    ),
    TableInfo(
        name="budgets",
        description="Budget definitions — recurring (with optional RRULE) or adhoc (fixed date range)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="name", type="text", description="Budget name"),
            ColumnInfo(name="amount", type="numeric", description="Budget cap"),
            ColumnInfo(name="currency", type="text", description="Budget currency"),
            ColumnInfo(name="period", type="text", description="Period: daily, weekly, monthly, quarterly, yearly (NULL for adhoc)"),
            ColumnInfo(name="start_date", type="date", description="Budget start date"),
            ColumnInfo(name="end_date", type="date", description="Budget end date (NULL = open-ended)"),
            ColumnInfo(name="type", type="text", description="Budget type: recurring, adhoc"),
            ColumnInfo(name="recurrence_rule", type="text", description="RRULE string for recurring budgets"),
            ColumnInfo(name="parent_budget_id", type="uuid", description="Parent budget for modified recurring instances", foreign_key="budgets.id"),
            ColumnInfo(name="is_modified_instance", type="boolean", description="True if this is a user-edited instance of a recurring budget"),
            ColumnInfo(name="is_active", type="boolean", description="Whether the budget is active"),
            ColumnInfo(name="activated_at", type="timestamptz", description="When the budget was last activated"),
            ColumnInfo(name="notes", type="text", description="Optional notes"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="budget_categories",
        description="Categories associated with a budget",
        columns=[
            ColumnInfo(name="budget_id", type="uuid", description="Budget", foreign_key="budgets.id"),
            ColumnInfo(name="category_id", type="uuid", description="Category", foreign_key="categories.id"),
        ],
    ),
    TableInfo(
        name="subscriptions",
        description="Recurring subscription tracking",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="name", type="text", description="Subscription name"),
            ColumnInfo(name="amount", type="numeric", description="Billing amount"),
            ColumnInfo(name="currency", type="text", description="Billing currency"),
            ColumnInfo(name="billing_cycle", type="text", description="Cycle: monthly, yearly, weekly, quarterly"),
            ColumnInfo(name="billing_day", type="integer", description="Day of cycle (e.g. 15 for the 15th)"),
            ColumnInfo(name="last_billed_at", type="timestamptz", description="Last billing date"),
            ColumnInfo(name="account_id", type="uuid", description="Charged account", foreign_key="accounts.id"),
            ColumnInfo(name="is_active", type="boolean", description="Whether the subscription is active"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="piggy_banks",
        description="Savings goals (piggy banks)",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="name", type="text", description="Goal name"),
            ColumnInfo(name="target_amount", type="numeric", description="Savings target"),
            ColumnInfo(name="current_amount", type="numeric", description="Amount saved so far"),
            ColumnInfo(name="currency", type="text", description="Currency"),
            ColumnInfo(name="target_date", type="date", description="Target completion date"),
            ColumnInfo(name="is_completed", type="boolean", description="Whether goal is reached"),
            ColumnInfo(name="deleted_at", type="timestamptz", description="Soft-delete timestamp"),
        ],
    ),
    TableInfo(
        name="piggy_bank_contributions",
        description="Individual contributions to piggy banks",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="piggy_bank_id", type="uuid", description="Piggy bank", foreign_key="piggy_banks.id"),
            ColumnInfo(name="transaction_id", type="uuid", description="Linked transaction", foreign_key="transactions.id"),
            ColumnInfo(name="contribution_type", type="text", description="Type: transfer, expense"),
            ColumnInfo(name="amount", type="numeric", description="Contribution amount"),
            ColumnInfo(name="date", type="date", description="Contribution date"),
        ],
    ),
    TableInfo(
        name="import_batches",
        description="PDF import sessions",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="user_id", type="uuid", description="Owner user", foreign_key="users.id"),
            ColumnInfo(name="source", type="text", description="Import source: pdf, manual"),
            ColumnInfo(name="filename", type="text", description="Original filename"),
            ColumnInfo(name="account_id", type="uuid", description="Target account", foreign_key="accounts.id"),
            ColumnInfo(name="status", type="text", description="Status: pending, processing, completed, failed"),
            ColumnInfo(name="verification_status", type="text", description="Balance check: verified, discrepancy, indeterminate"),
            ColumnInfo(name="total_parsed", type="integer", description="Total records parsed"),
            ColumnInfo(name="total_confirmed", type="integer", description="Total records confirmed"),
            ColumnInfo(name="total_rejected", type="integer", description="Total records rejected"),
            ColumnInfo(name="imported_at", type="timestamptz", description="Import start timestamp"),
            ColumnInfo(name="completed_at", type="timestamptz", description="Import completion timestamp"),
        ],
    ),
    TableInfo(
        name="raw_import_records",
        description="Raw parsed records from an import batch",
        columns=[
            ColumnInfo(name="id", type="uuid", description="Primary key"),
            ColumnInfo(name="batch_id", type="uuid", description="Parent batch", foreign_key="import_batches.id"),
            ColumnInfo(name="raw_text", type="text", description="Original raw text from PDF"),
            ColumnInfo(name="parsed_json", type="jsonb", description="Parsed fields (date, description, amount, type)"),
            ColumnInfo(name="status", type="text", description="Status: pending, confirmed, rejected"),
            ColumnInfo(name="transaction_id", type="uuid", description="Created transaction (after confirm)", foreign_key="transactions.id"),
            ColumnInfo(name="confidence", type="text", description="Parse confidence: high, medium, low"),
            ColumnInfo(name="match_type", type="text", description="Match type: new, duplicate"),
        ],
    ),
]


@router.get("/schema", response_model=SchemaResponse)
async def get_schema(
    _user: User = Depends(get_current_user),
) -> SchemaResponse:
    return SchemaResponse(tables=_SCHEMA)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_dashboard(d: ReportDashboard) -> DashboardResponse:
    return DashboardResponse(
        id=d.id,
        user_id=d.user_id,
        name=d.name,
        description=d.description,
        created_at=d.created_at.isoformat(),
        updated_at=d.updated_at.isoformat(),
        deleted_at=d.deleted_at.isoformat() if d.deleted_at else None,
    )


def _fmt_widget(w: ReportWidget) -> WidgetResponse:
    return WidgetResponse(
        id=w.id,
        dashboard_id=w.dashboard_id,
        title=w.title,
        query=w.query,
        viz_type=w.viz_type,
        viz_config=w.viz_config,
        position=w.position,
        created_at=w.created_at.isoformat(),
        updated_at=w.updated_at.isoformat(),
    )


async def _get_dashboard_or_404(
    dashboard_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession,
) -> ReportDashboard:
    row = (
        await session.execute(
            sa.select(ReportDashboard).where(
                ReportDashboard.id == dashboard_id,
                ReportDashboard.user_id == user_id,
                ReportDashboard.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return row


# ── Dashboard CRUD ─────────────────────────────────────────────────────────────

@router.get("/dashboards", response_model=list[DashboardResponse])
async def list_dashboards(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[DashboardResponse]:
    rows = (
        await session.execute(
            sa.select(ReportDashboard).where(
                ReportDashboard.user_id == user.id,
                ReportDashboard.deleted_at.is_(None),
            ).order_by(ReportDashboard.created_at)
        )
    ).scalars().all()
    return [_fmt_dashboard(r) for r in rows]


@router.post("/dashboards", response_model=DashboardResponse, status_code=201)
async def create_dashboard(
    body: DashboardCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DashboardResponse:
    dashboard = ReportDashboard(
        id=uuid.uuid4(),
        user_id=user.id,
        name=body.name,
        description=body.description,
    )
    session.add(dashboard)
    await session.commit()
    await session.refresh(dashboard)
    return _fmt_dashboard(dashboard)


@router.get("/dashboards/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(
    dashboard_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DashboardResponse:
    dashboard = await _get_dashboard_or_404(dashboard_id, user.id, session)
    return _fmt_dashboard(dashboard)


@router.patch("/dashboards/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(
    dashboard_id: uuid.UUID,
    body: DashboardUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DashboardResponse:
    dashboard = await _get_dashboard_or_404(dashboard_id, user.id, session)
    if body.name is not None:
        dashboard.name = body.name
    if body.description is not None:
        dashboard.description = body.description
    await session.commit()
    await session.refresh(dashboard)
    return _fmt_dashboard(dashboard)


@router.delete("/dashboards/{dashboard_id}", status_code=204)
async def delete_dashboard(
    dashboard_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    dashboard = await _get_dashboard_or_404(dashboard_id, user.id, session)
    from datetime import UTC
    dashboard.deleted_at = datetime.now(tz=UTC)
    await session.commit()


# ── Widget CRUD ───────────────────────────────────────────────────────────────

@router.get("/dashboards/{dashboard_id}/widgets", response_model=list[WidgetResponse])
async def list_widgets(
    dashboard_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[WidgetResponse]:
    await _get_dashboard_or_404(dashboard_id, user.id, session)
    rows = (
        await session.execute(
            sa.select(ReportWidget).where(
                ReportWidget.dashboard_id == dashboard_id,
            ).order_by(ReportWidget.created_at)
        )
    ).scalars().all()
    return [_fmt_widget(w) for w in rows]


@router.post("/dashboards/{dashboard_id}/widgets", response_model=WidgetResponse, status_code=201)
async def create_widget(
    dashboard_id: uuid.UUID,
    body: WidgetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WidgetResponse:
    await _get_dashboard_or_404(dashboard_id, user.id, session)
    widget = ReportWidget(
        id=uuid.uuid4(),
        dashboard_id=dashboard_id,
        title=body.title,
        query=body.query,
        viz_type=body.viz_type,
        viz_config=body.viz_config,
        position=body.position,
    )
    session.add(widget)
    await session.commit()
    await session.refresh(widget)
    return _fmt_widget(widget)


@router.patch("/dashboards/{dashboard_id}/widgets/{widget_id}", response_model=WidgetResponse)
async def update_widget(
    dashboard_id: uuid.UUID,
    widget_id: uuid.UUID,
    body: WidgetUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WidgetResponse:
    await _get_dashboard_or_404(dashboard_id, user.id, session)
    widget = (
        await session.execute(
            sa.select(ReportWidget).where(
                ReportWidget.id == widget_id,
                ReportWidget.dashboard_id == dashboard_id,
            )
        )
    ).scalar_one_or_none()
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    if body.title is not None:
        widget.title = body.title
    if body.query is not None:
        widget.query = body.query
    if body.viz_type is not None:
        widget.viz_type = VizType(body.viz_type)
    if body.viz_config is not None:
        widget.viz_config = body.viz_config
    if body.position is not None:
        widget.position = body.position
    await session.commit()
    await session.refresh(widget)
    return _fmt_widget(widget)


@router.delete("/dashboards/{dashboard_id}/widgets/{widget_id}", status_code=204)
async def delete_widget(
    dashboard_id: uuid.UUID,
    widget_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    await _get_dashboard_or_404(dashboard_id, user.id, session)
    widget = (
        await session.execute(
            sa.select(ReportWidget).where(
                ReportWidget.id == widget_id,
                ReportWidget.dashboard_id == dashboard_id,
            )
        )
    ).scalar_one_or_none()
    if widget is None:
        raise HTTPException(status_code=404, detail="Widget not found")
    await session.delete(widget)
    await session.commit()
