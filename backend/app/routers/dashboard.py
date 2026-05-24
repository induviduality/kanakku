from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional

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
from app.models.split import Split, SplitShare, SplitShareStatus
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
    CategoryBreakdownItem,
    DashboardResponse,
    PendingByPayee,
    PendingSplitsSummary,
    PiggyBankSummaryItem,
    RecentTransaction,
)
from app.services.subscription_dates import compute_next_billing_date, subscription_status

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class DashboardPeriod(str, Enum):
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
    start_date: Optional[date],
    end_date: Optional[date],
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
    rows = (
        await session.execute(
            sa.select(Transaction.type, sa.func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.transacted_at >= month_start,
                Transaction.transacted_at < month_end,
                Transaction.type.in_([TransactionType.expense, TransactionType.income]),
            )
            .group_by(Transaction.type)
        )
    ).all()
    totals: dict[str, Decimal] = {r[0]: r[1] for r in rows}
    return (
        totals.get(TransactionType.expense, Decimal("0")),
        totals.get(TransactionType.income, Decimal("0")),
    )


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
    rows = (
        await session.execute(
            sa.select(
                transaction_categories.c.category_id,
                Category.name,
                sa.func.sum(Transaction.amount).label("amount"),
            )
            .join(
                transaction_categories,
                transaction_categories.c.transaction_id == Transaction.id,
            )
            .join(Category, Category.id == transaction_categories.c.category_id)
            .where(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.type == TransactionType.expense,
                Transaction.transacted_at >= month_start,
                Transaction.transacted_at < month_end,
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
            .limit(10)
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


def _savings_rate(inflow: Decimal, outflow: Decimal) -> float | None:
    if inflow <= 0:
        return None
    return round(float((inflow - outflow) / inflow * 100), 1)


@router.get("/home", response_model=DashboardResponse)
async def home_dashboard(
    period: DashboardPeriod = Query(DashboardPeriod.month),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
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
    budgets = await _budgets_summary(session, user.id, period_start, period_end)
    cats = await _category_breakdown(session, user.id, period_start, period_end, total_spent)
    recent = await _recent_transactions(session, user.id, period_start, period_end)
    splits = await _pending_splits_summary(session, user.id)
    pigs = await _piggy_banks_summary(session, user.id)
    accounts = await _account_balances(session, user.id)
    subs = await _active_subscriptions(session, user.id)

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
        budgets_summary=budgets,
        category_breakdown=cats,
        recent_transactions=recent,
        pending_splits_summary=splits,
        piggy_banks_summary=pigs,
        account_balances=accounts,
        active_subscriptions=subs,
    )
