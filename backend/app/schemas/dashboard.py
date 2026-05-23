from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.account import AccountType
from app.models.transaction import TransactionType


class BudgetSummaryItem(BaseModel):
    id: uuid.UUID
    name: str
    amount: Decimal
    currency: str
    spent: Decimal
    percentage: float
    status: str  # "on_track" | "warning" | "over_budget"


class CategoryBreakdownItem(BaseModel):
    category_id: uuid.UUID
    name: str
    amount: Decimal
    percentage: float


class PendingByPayee(BaseModel):
    payee_id: uuid.UUID | None
    payee_name: str | None
    total: Decimal


class PendingSplitsSummary(BaseModel):
    count: int
    total_owed: Decimal
    by_payee: list[PendingByPayee]


class PiggyBankSummaryItem(BaseModel):
    id: uuid.UUID
    name: str
    target_amount: Decimal
    current_amount: Decimal
    currency: str
    progress_pct: float
    is_completed: bool


class AccountBalanceItem(BaseModel):
    id: uuid.UUID
    name: str
    type: AccountType
    currency: str
    current_balance: Decimal


class ActiveSubscriptionItem(BaseModel):
    id: uuid.UUID
    name: str
    amount: Decimal
    currency: str
    status: str
    next_billing_date: date | None


class RecentTransaction(BaseModel):
    id: uuid.UUID
    type: TransactionType
    transacted_at: datetime
    amount: Decimal
    currency: str
    description: str | None
    account_id: uuid.UUID
    payee_id: uuid.UUID | None
    category_ids: list[uuid.UUID]


class DashboardResponse(BaseModel):
    month: str
    total_spent_net: Decimal
    total_income: Decimal
    budgets_summary: list[BudgetSummaryItem]
    category_breakdown: list[CategoryBreakdownItem]
    recent_transactions: list[RecentTransaction]
    pending_splits_summary: PendingSplitsSummary
    piggy_banks_summary: list[PiggyBankSummaryItem]
    account_balances: list[AccountBalanceItem]
    active_subscriptions: list[ActiveSubscriptionItem]
