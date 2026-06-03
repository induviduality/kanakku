from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from enum import StrEnum

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.account import Account
from app.models.budget import Budget, budget_categories
from app.models.category import Category
from app.models.payee import Payee
from app.models.piggy_bank import PiggyBank
from app.models.split import Split, SplitExpense, SplitShare, SplitShareSettlement, SplitShareStatus
from app.models.subscription import Subscription
from app.models.transaction import (
    Transaction,
    TransactionType,
    transaction_budgets,
    transaction_categories,
)
from app.models.user import User
from app.schemas.dashboard import (
    AccountBalanceItem,
    ActiveSubscriptionItem,
    BudgetSummaryItem,
    CashFlowAccountBucket,
    CashFlowBucket,
    CategoryBreakdownItem,
    DashboardResponse,
    PendingByPayee,
    PendingSplitsSummary,
    PiggyBankSummaryItem,
    RecentTransaction,
)
from app.services.subscription_dates import compute_next_billing_date, subscription_status

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Lightweight reference to the transaction_with_net_amount SQL view.
# net_amount = own_share + fully-forgiven + partial-forgiven (FR-7.9).
_net_view = sa.table(
    "transaction_with_net_amount",
    sa.column("id", sa.UUID()),
    sa.column("user_id", sa.UUID()),
    sa.column("type"),
    sa.column("transacted_at"),
    sa.column("net_amount", sa.Numeric(15, 2)),
    sa.column("deleted_at"),
)


class DashboardPeriod(StrEnum):
    month = "month"
    quarter = "quarter"
    year = "year"
    custom = "custom"


def _month_window(today: date) -> tuple[datetime, datetime]:
    start = datetime(today.year, today.month, 1, tzinfo=UTC)
    if today.month == 12:
        end = datetime(today.year + 1, 1, 1, tzinfo=UTC)
    else:
        end = datetime(today.year, today.month + 1, 1, tzinfo=UTC)
    return start, end


def _period_window(
    period: DashboardPeriod,
    today: date,
    start_date: date | None,
    end_date: date | None,
) -> tuple[datetime, datetime]:
    """Return (period_start, period_end) as UTC datetimes (end is exclusive)."""
    if period == DashboardPeriod.month:
        return _month_window(today)
    if period == DashboardPeriod.quarter:
        q_start_month = ((today.month - 1) // 3) * 3 + 1
        start = datetime(today.year, q_start_month, 1, tzinfo=UTC)
        end_month = q_start_month + 3
        if end_month > 12:
            end = datetime(today.year + 1, end_month - 12, 1, tzinfo=UTC)
        else:
            end = datetime(today.year, end_month, 1, tzinfo=UTC)
        return start, end
    if period == DashboardPeriod.year:
        return (
            datetime(today.year, 1, 1, tzinfo=UTC),
            datetime(today.year + 1, 1, 1, tzinfo=UTC),
        )
    # custom
    if not start_date or not end_date:
        raise HTTPException(status_code=422, detail="start_date and end_date required for custom period")
    return (
        datetime(start_date.year, start_date.month, start_date.day, tzinfo=UTC),
        datetime(end_date.year, end_date.month, end_date.day, tzinfo=UTC) + timedelta(days=1),
    )


def _prev_window(
    period: DashboardPeriod,
    curr_start: datetime,
    curr_end: datetime,
) -> tuple[datetime, datetime]:
    """Return the previous period window of the same duration."""
    if period == DashboardPeriod.month:
        # previous calendar month
        m = curr_start.month - 1
        y = curr_start.year
        if m == 0:
            m, y = 12, y - 1
        prev_start = datetime(y, m, 1, tzinfo=UTC)
        prev_end = curr_start  # curr_start IS the first of current month
        return prev_start, prev_end
    if period == DashboardPeriod.quarter:
        # shift back by 3 months
        m = curr_start.month - 3
        y = curr_start.year
        if m <= 0:
            m += 12
            y -= 1
        prev_start = datetime(y, m, 1, tzinfo=UTC)
        return prev_start, curr_start
    if period == DashboardPeriod.year:
        prev_start = datetime(curr_start.year - 1, 1, 1, tzinfo=UTC)
        return prev_start, curr_start
    # custom — slide back by same duration
    duration = curr_end - curr_start
    return curr_start - duration, curr_start


def _budget_status(spent: Decimal, amount: Decimal) -> str:
    if amount <= 0:
        return "on_track"
    pct = float(spent / amount * 100)
    if pct >= 100:
        return "over_budget"
    if pct >= 80:
        return "warning"
    return "on_track"


async def _monthly_totals(
    session: AsyncSession,
    user_id: uuid.UUID,
    month_start: datetime,
    month_end: datetime,
) -> tuple[Decimal, Decimal]:
    # Expense: use net_amount from the view (own share + forgiven only, per FR-7.9).
    exp_row = (
        await session.execute(
            sa.select(sa.func.coalesce(sa.func.sum(_net_view.c.net_amount), Decimal("0")))
            .where(
                _net_view.c.user_id == user_id,
                _net_view.c.deleted_at.is_(None),
                _net_view.c.type == TransactionType.expense,
                _net_view.c.transacted_at >= month_start,
                _net_view.c.transacted_at < month_end,
            )
        )
    ).scalar()
    total_expense = exp_row or Decimal("0")

    # Income: exclude split settlement transactions (friend repayments are cost
    # recovery, not real income — FR-7.10).
    settlement_txn_ids = sa.select(SplitShareSettlement.transaction_id)
    inc_row = (
        await session.execute(
            sa.select(sa.func.coalesce(sa.func.sum(Transaction.amount), Decimal("0")))
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.type == TransactionType.income,
                Transaction.transacted_at >= month_start,
                Transaction.transacted_at < month_end,
                Transaction.id.not_in(settlement_txn_ids),
            )
        )
    ).scalar()
    total_income = inc_row or Decimal("0")

    return total_expense, total_income


async def _budgets_summary(
    session: AsyncSession,
    user_id: uuid.UUID,
    month_start: datetime,
    month_end: datetime,
) -> list[BudgetSummaryItem]:
    budgets = (
        await session.execute(
            sa.select(Budget).where(
                Budget.user_id == user_id,
                Budget.deleted_at.is_(None),
                Budget.is_active.is_(True),
                Budget.is_modified_instance.is_(False),
            )
        )
    ).scalars().all()

    result: list[BudgetSummaryItem] = []
    for b in budgets:
        # Explicit links
        explicit_ids_rows = (
            await session.execute(
                sa.select(transaction_budgets.c.transaction_id).where(
                    transaction_budgets.c.budget_id == b.id
                )
            )
        ).all()
        explicit_ids = {r[0] for r in explicit_ids_rows}

        # Category-match
        cat_ids_rows = (
            await session.execute(
                sa.select(budget_categories.c.category_id).where(
                    budget_categories.c.budget_id == b.id
                )
            )
        ).all()
        cat_ids = [r[0] for r in cat_ids_rows]

        # Sum explicit
        spent = Decimal("0")
        if explicit_ids:
            row = (
                await session.execute(
                    sa.select(sa.func.sum(Transaction.amount)).where(
                        Transaction.id.in_(explicit_ids),
                        Transaction.deleted_at.is_(None),
                        Transaction.transacted_at >= month_start,
                        Transaction.transacted_at < month_end,
                    )
                )
            ).scalar()
            spent += row or Decimal("0")

        # Sum category matches (exclude explicit)
        if cat_ids:
            exclude = explicit_ids if explicit_ids else set()
            cat_q = (
                sa.select(sa.func.sum(Transaction.amount))
                .join(
                    transaction_categories,
                    transaction_categories.c.transaction_id == Transaction.id,
                )
                .where(
                    transaction_categories.c.category_id.in_(cat_ids),
                    Transaction.user_id == user_id,
                    Transaction.deleted_at.is_(None),
                    Transaction.transacted_at >= month_start,
                    Transaction.transacted_at < month_end,
                )
            )
            if exclude:
                cat_q = cat_q.where(Transaction.id.not_in(exclude))
            row = (await session.execute(cat_q)).scalar()
            spent += row or Decimal("0")

        pct = float(spent / b.amount * 100) if b.amount > 0 else 0.0
        result.append(
            BudgetSummaryItem(
                id=b.id,
                name=b.name,
                amount=b.amount,
                currency=b.currency,
                spent=spent,
                percentage=round(pct, 1),
                status=_budget_status(spent, b.amount),
            )
        )
    return result


async def _category_breakdown(
    session: AsyncSession,
    user_id: uuid.UUID,
    month_start: datetime,
    month_end: datetime,
    total_spent: Decimal,
) -> list[CategoryBreakdownItem]:
    # Use net_amount from the view so a ₹4k split dinner where user's share is
    # ₹1k is attributed as ₹1k to the category, not ₹4k (FR-7.9).
    rows = (
        await session.execute(
            sa.select(
                transaction_categories.c.category_id,
                Category.name,
                sa.func.sum(_net_view.c.net_amount).label("amount"),
            )
            .join(
                transaction_categories,
                transaction_categories.c.transaction_id == _net_view.c.id,
            )
            .join(Category, Category.id == transaction_categories.c.category_id)
            .where(
                _net_view.c.user_id == user_id,
                _net_view.c.deleted_at.is_(None),
                _net_view.c.type == TransactionType.expense,
                _net_view.c.transacted_at >= month_start,
                _net_view.c.transacted_at < month_end,
            )
            .group_by(transaction_categories.c.category_id, Category.name)
            .order_by(sa.desc("amount"))
        )
    ).all()

    result: list[CategoryBreakdownItem] = []
    for r in rows:
        pct = float(r.amount / total_spent * 100) if total_spent > 0 else 0.0
        result.append(
            CategoryBreakdownItem(
                category_id=r.category_id,
                name=r.name,
                amount=r.amount,
                percentage=round(pct, 1),
            )
        )
    return result


async def _recent_transactions(
    session: AsyncSession,
    user_id: uuid.UUID,
    period_start: datetime,
    period_end: datetime,
) -> list[RecentTransaction]:
    txns = (
        await session.execute(
            sa.select(Transaction)
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.transacted_at < period_end,
            )
            .order_by(Transaction.transacted_at.desc(), Transaction.id.desc())
            .limit(5)
        )
    ).scalars().all()

    result: list[RecentTransaction] = []
    for txn in txns:
        cat_ids = [
            r[0]
            for r in (
                await session.execute(
                    sa.select(transaction_categories.c.category_id).where(
                        transaction_categories.c.transaction_id == txn.id
                    )
                )
            ).all()
        ]
        result.append(
            RecentTransaction(
                id=txn.id,
                type=txn.type,
                transacted_at=txn.transacted_at,
                amount=txn.amount,
                currency=txn.currency,
                description=txn.description,
                account_id=txn.account_id,
                payee_id=txn.payee_id,
                category_ids=cat_ids,
            )
        )
    return result


async def _pending_splits_from_others_total(
    session: AsyncSession,
    user_id: uuid.UUID,
    period_start: datetime,
    period_end: datetime,
) -> Decimal:
    """Sum of outstanding amounts others owe the user for splits in the period.

    outstanding per share = share.amount - share.forgiven_amount - already settled
    Only 'pending' payee shares are included; the period filter is based on the
    split's expense transaction date.
    """
    row = (
        await session.execute(
            sa.text("""
                SELECT COALESCE(SUM(
                    ss.amount
                    - ss.forgiven_amount
                    - COALESCE((
                        SELECT SUM(sss.amount)
                        FROM split_share_settlements sss
                        WHERE sss.share_id = ss.id
                      ), 0)
                ), 0)
                FROM split_shares ss
                JOIN splits sp ON sp.id = ss.split_id
                JOIN split_expenses se ON se.split_id = sp.id
                JOIN transactions t ON t.id = se.transaction_id
                WHERE ss.payee_id IS NOT NULL
                  AND ss.status = 'pending'
                  AND sp.user_id = :user_id
                  AND sp.deleted_at IS NULL
                  AND t.deleted_at IS NULL
                  AND t.transacted_at >= :start
                  AND t.transacted_at < :end
            """),
            {"user_id": user_id, "start": period_start, "end": period_end},
        )
    ).scalar()
    return row or Decimal("0")


async def _pending_splits_summary(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> PendingSplitsSummary:
    # Pending shares for splits belonging to this user
    rows = (
        await session.execute(
            sa.select(
                SplitShare.payee_id,
                Payee.name.label("payee_name"),
                sa.func.count(SplitShare.id).label("cnt"),
                sa.func.sum(SplitShare.amount).label("total"),
            )
            .join(Split, Split.id == SplitShare.split_id)
            .outerjoin(Payee, Payee.id == SplitShare.payee_id)
            .where(
                Split.user_id == user_id,
                Split.deleted_at.is_(None),
                SplitShare.status == SplitShareStatus.pending,
                SplitShare.payee_id.is_not(None),  # exclude user's own share
            )
            .group_by(SplitShare.payee_id, Payee.name)
        )
    ).all()

    count = sum(r.cnt for r in rows)
    total_owed = sum((r.total for r in rows), Decimal("0"))
    by_payee = [
        PendingByPayee(
            payee_id=r.payee_id,
            payee_name=r.payee_name,
            total=r.total,
        )
        for r in rows
    ]
    return PendingSplitsSummary(count=count, total_owed=total_owed, by_payee=by_payee)


async def _piggy_banks_summary(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[PiggyBankSummaryItem]:
    pigs = (
        await session.execute(
            sa.select(PiggyBank).where(
                PiggyBank.user_id == user_id,
                PiggyBank.deleted_at.is_(None),
            ).order_by(PiggyBank.created_at)
        )
    ).scalars().all()

    result: list[PiggyBankSummaryItem] = []
    for p in pigs:
        pct = (
            float(p.current_amount / p.target_amount * 100)
            if p.target_amount > 0
            else 0.0
        )
        result.append(
            PiggyBankSummaryItem(
                id=p.id,
                name=p.name,
                target_amount=p.target_amount,
                current_amount=p.current_amount,
                currency=p.currency,
                progress_pct=min(round(pct, 1), 100.0),
                is_completed=p.is_completed,
            )
        )
    return result


async def _account_balances(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[AccountBalanceItem]:
    accounts = (
        await session.execute(
            sa.select(Account).where(
                Account.user_id == user_id,
                Account.deleted_at.is_(None),
                Account.is_active.is_(True),
            ).order_by(Account.name)
        )
    ).scalars().all()

    return [
        AccountBalanceItem(
            id=a.id,
            name=a.name,
            type=a.type,
            currency=a.currency,
            current_balance=a.current_balance,
        )
        for a in accounts
    ]


async def _active_subscriptions(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[ActiveSubscriptionItem]:
    subs = (
        await session.execute(
            sa.select(Subscription).where(
                Subscription.user_id == user_id,
                Subscription.deleted_at.is_(None),
                Subscription.is_active.is_(True),
            ).order_by(Subscription.name)
        )
    ).scalars().all()

    result: list[ActiveSubscriptionItem] = []
    for s in subs:
        next_date = compute_next_billing_date(s)
        status = subscription_status(s)
        result.append(
            ActiveSubscriptionItem(
                id=s.id,
                name=s.name,
                amount=s.amount,
                currency=s.currency,
                status=status,
                next_billing_date=next_date,
            )
        )
    return result


async def _cashflow_buckets(
    session: AsyncSession,
    user_id: uuid.UUID,
    period_start: datetime,
    period_end: datetime,
    period: DashboardPeriod,
) -> list[CashFlowBucket]:
    duration_days = (period_end - period_start).days
    if period == DashboardPeriod.year or duration_days > 91:
        trunc_unit = "month"
    elif period == DashboardPeriod.quarter or duration_days > 31:
        trunc_unit = "week"
    else:
        trunc_unit = "day"

    bucket_col = sa.func.date_trunc(trunc_unit, Transaction.transacted_at).label("bucket")
    rows = (
        await session.execute(
            sa.select(Transaction.type, bucket_col, sa.func.sum(Transaction.amount).label("amount"))
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.transacted_at < period_end,
                Transaction.type.in_([TransactionType.expense, TransactionType.income]),
            )
            .group_by(Transaction.type, "bucket")
            .order_by("bucket")
        )
    ).all()

    buckets: dict[str, dict[str, Decimal]] = {}
    for row in rows:
        key = row.bucket.strftime("%Y-%m-%d")
        if key not in buckets:
            buckets[key] = {"income": Decimal("0"), "expense": Decimal("0")}
        buckets[key][row.type.value] = row.amount

    return [
        CashFlowBucket(date=k, income=v["income"], expense=v["expense"])
        for k, v in sorted(buckets.items())
    ]


async def _cashflow_by_account(
    session: AsyncSession,
    user_id: uuid.UUID,
    period_start: datetime,
    period_end: datetime,
    period: DashboardPeriod,
) -> list[CashFlowAccountBucket]:
    duration_days = (period_end - period_start).days
    if period == DashboardPeriod.year or duration_days > 91:
        trunc_unit = "month"
    elif period == DashboardPeriod.quarter or duration_days > 31:
        trunc_unit = "week"
    else:
        trunc_unit = "day"

    # Active accounts for this user
    accounts = (
        await session.execute(
            sa.select(Account).where(
                Account.user_id == user_id,
                Account.deleted_at.is_(None),
                Account.is_active.is_(True),
            )
        )
    ).scalars().all()
    if not accounts:
        return []

    acc_ids = [a.id for a in accounts]
    acc_map = {a.id: a for a in accounts}

    # ── Step 1: opening balance at period_start ──────────────────────────────
    # opening = current_balance − net_change(period_start → ∞)
    # net_change per account for income/expense
    ie_open = (
        await session.execute(
            sa.select(
                Transaction.account_id,
                sa.func.sum(sa.case(
                    (Transaction.type == TransactionType.income,  Transaction.amount),
                    else_=-Transaction.amount,
                )).label("net"),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.type.in_([TransactionType.income, TransactionType.expense]),
                Transaction.account_id.in_(acc_ids),
            )
            .group_by(Transaction.account_id)
        )
    ).all()

    # transfers out (source account loses money)
    xfer_out_open = (
        await session.execute(
            sa.select(
                Transaction.account_id,
                sa.func.sum(Transaction.amount).label("out"),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.type == TransactionType.transfer,
                Transaction.account_id.in_(acc_ids),
            )
            .group_by(Transaction.account_id)
        )
    ).all()

    # transfers in (destination account gains money)
    xfer_in_open = (
        await session.execute(
            sa.select(
                Transaction.to_account_id,
                sa.func.sum(Transaction.to_amount).label("into"),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.type == TransactionType.transfer,
                Transaction.to_account_id.in_(acc_ids),
            )
            .group_by(Transaction.to_account_id)
        )
    ).all()

    ie_open_map   = {r.account_id: r.net or Decimal("0")  for r in ie_open}
    xfer_out_map  = {r.account_id: r.out or Decimal("0")  for r in xfer_out_open}
    xfer_in_map   = {r.to_account_id: r.into or Decimal("0") for r in xfer_in_open}

    opening: dict[uuid.UUID, Decimal] = {}
    for acc_id in acc_ids:
        net_after = (
            ie_open_map.get(acc_id, Decimal("0"))
            - xfer_out_map.get(acc_id, Decimal("0"))
            + xfer_in_map.get(acc_id, Decimal("0"))
        )
        opening[acc_id] = acc_map[acc_id].current_balance - net_after

    # ── Step 2: net change per (account, bucket) within the period ───────────
    bucket_col = sa.func.date_trunc(trunc_unit, Transaction.transacted_at).label("bucket")

    ie_rows = (
        await session.execute(
            sa.select(
                Transaction.account_id,
                bucket_col,
                sa.func.sum(sa.case(
                    (Transaction.type == TransactionType.income,  Transaction.amount),
                    else_=-Transaction.amount,
                )).label("net"),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.transacted_at < period_end,
                Transaction.type.in_([TransactionType.income, TransactionType.expense]),
                Transaction.account_id.in_(acc_ids),
            )
            .group_by(Transaction.account_id, "bucket")
            .order_by("bucket")
        )
    ).all()

    xfer_out_rows = (
        await session.execute(
            sa.select(
                Transaction.account_id,
                bucket_col,
                sa.func.sum(Transaction.amount).label("out"),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.transacted_at < period_end,
                Transaction.type == TransactionType.transfer,
                Transaction.account_id.in_(acc_ids),
            )
            .group_by(Transaction.account_id, "bucket")
        )
    ).all()

    xfer_in_rows = (
        await session.execute(
            sa.select(
                Transaction.to_account_id,
                bucket_col,
                sa.func.sum(Transaction.to_amount).label("into"),
            )
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= period_start,
                Transaction.transacted_at < period_end,
                Transaction.type == TransactionType.transfer,
                Transaction.to_account_id.in_(acc_ids),
            )
            .group_by(Transaction.to_account_id, "bucket")
        )
    ).all()

    # Merge into net_by_bucket: (acc_id, date_str) → net
    net_by_bucket: dict[tuple[uuid.UUID, str], Decimal] = {}
    for r in ie_rows:
        key = (r.account_id, r.bucket.strftime("%Y-%m-%d"))
        net_by_bucket[key] = net_by_bucket.get(key, Decimal("0")) + (r.net or Decimal("0"))
    for r in xfer_out_rows:
        key = (r.account_id, r.bucket.strftime("%Y-%m-%d"))
        net_by_bucket[key] = net_by_bucket.get(key, Decimal("0")) - (r.out or Decimal("0"))
    for r in xfer_in_rows:
        key = (r.to_account_id, r.bucket.strftime("%Y-%m-%d"))
        net_by_bucket[key] = net_by_bucket.get(key, Decimal("0")) + (r.into or Decimal("0"))

    # ── Step 3: running balance per account across all bucket dates ──────────
    all_dates = sorted({date for (_, date) in net_by_bucket})
    if not all_dates:
        return []

    result: list[CashFlowAccountBucket] = []
    for acc_id in acc_ids:
        # Only include accounts that had activity in this period
        if not any(aid == acc_id for (aid, _) in net_by_bucket):
            continue
        running = opening[acc_id]
        for date_str in all_dates:
            net = net_by_bucket.get((acc_id, date_str), Decimal("0"))
            running += net
            result.append(CashFlowAccountBucket(
                date=date_str,
                account_id=acc_id,
                account_name=acc_map[acc_id].name,
                balance=running,
                net=net,
            ))

    return sorted(result, key=lambda x: (x.date, str(x.account_id)))


def _savings_rate(inflow: Decimal, outflow: Decimal) -> float | None:
    if inflow <= 0:
        return None
    return round(float((inflow - outflow) / inflow * 100), 1)


@router.get("/home", response_model=DashboardResponse)
async def home_dashboard(
    period: DashboardPeriod = Query(DashboardPeriod.month),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DashboardResponse:
    today = date.today()
    period_start, period_end = _period_window(period, today, start_date, end_date)
    prev_start, prev_end = _prev_window(period, period_start, period_end)

    # Sub-queries run sequentially (shared session; asyncio.gather offers no
    # real parallelism here since the connection is not re-entrant).
    total_spent, total_income = await _monthly_totals(session, user.id, period_start, period_end)
    prev_spent, prev_income = await _monthly_totals(session, user.id, prev_start, prev_end)
    pending_from_others = await _pending_splits_from_others_total(session, user.id, period_start, period_end)
    budgets = await _budgets_summary(session, user.id, period_start, period_end)
    cats = await _category_breakdown(session, user.id, period_start, period_end, total_spent)
    recent = await _recent_transactions(session, user.id, period_start, period_end)
    splits = await _pending_splits_summary(session, user.id)
    pigs = await _piggy_banks_summary(session, user.id)
    accounts = await _account_balances(session, user.id)
    subs = await _active_subscriptions(session, user.id)
    cashflow = await _cashflow_buckets(session, user.id, period_start, period_end, period)
    cashflow_by_account = await _cashflow_by_account(session, user.id, period_start, period_end, period)

    total_balance = sum((Decimal(a.current_balance) for a in accounts), Decimal("0"))

    return DashboardResponse(
        month=today.strftime("%Y-%m"),
        total_spent_net=total_spent,
        total_income=total_income,
        period=period.value,
        period_start=period_start.date(),
        period_end=(period_end - timedelta(days=1)).date(),
        total_balance=total_balance,
        inflow=total_income,
        outflow=total_spent,
        savings_rate=_savings_rate(total_income, total_spent),
        prev_inflow=prev_income,
        prev_outflow=prev_spent,
        prev_savings_rate=_savings_rate(prev_income, prev_spent),
        pending_splits_from_others=pending_from_others,
        budgets_summary=budgets,
        category_breakdown=cats,
        recent_transactions=recent,
        pending_splits_summary=splits,
        piggy_banks_summary=pigs,
        account_balances=accounts,
        active_subscriptions=subs,
        cashflow_buckets=cashflow,
        cashflow_by_account=cashflow_by_account,
    )
