"""
Dev-mode seed data. Runs once at startup when DEV_MODE=true.

Idempotent: uses fixed UUIDs and skips rows that already exist.
Re-running never duplicates data; it only fills gaps.

To extend: add new rows with new fixed UUIDs. Never change an existing UUID —
doing so would create a duplicate on a fresh DB while leaving the old row on
an existing DB. Add a comment above any new block describing what scenario it
covers, following the pattern below.
"""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.models.account import Account, AccountType
from app.models.budget import Budget, BudgetPeriod, BudgetType, budget_categories
from app.models.category import Category, CategoryApplicability, payee_default_categories
from app.models.payee import Payee, PayeeType
from app.models.payment_method import PaymentMethod, PaymentMethodType
from app.models.piggy_bank import ContributionType, PiggyBank, PiggyBankContribution
from app.models.subscription import BillingCycle, Subscription
from app.models.tag import Tag
from app.models.transaction import (
    Transaction,
    TransactionType,
    transaction_categories,
    transaction_tags,
)

# ── Fixed UUIDs ────────────────────────────────────────────────────────────────
# Keep all IDs here so the file is self-documenting and nothing is scattered.

USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

# Accounts
ACC_HDFC    = uuid.UUID("a1000001-0000-0000-0000-000000000001")
ACC_ICICI   = uuid.UUID("a1000001-0000-0000-0000-000000000002")
ACC_CASH    = uuid.UUID("a1000001-0000-0000-0000-000000000003")
ACC_CREDIT  = uuid.UUID("a1000001-0000-0000-0000-000000000004")

# Payment methods
PM_HDFC_UPI   = uuid.UUID("b2000001-0000-0000-0000-000000000001")
PM_HDFC_DEBIT = uuid.UUID("b2000001-0000-0000-0000-000000000002")
PM_CREDIT_CC  = uuid.UUID("b2000001-0000-0000-0000-000000000003")

# Categories
CAT_FOOD      = uuid.UUID("c3000001-0000-0000-0000-000000000001")
CAT_TRANSPORT = uuid.UUID("c3000001-0000-0000-0000-000000000002")
CAT_UTILITIES = uuid.UUID("c3000001-0000-0000-0000-000000000003")
CAT_ENTERTAIN = uuid.UUID("c3000001-0000-0000-0000-000000000004")
CAT_SALARY    = uuid.UUID("c3000001-0000-0000-0000-000000000005")
CAT_HEALTH    = uuid.UUID("c3000001-0000-0000-0000-000000000006")
CAT_SHOPPING  = uuid.UUID("c3000001-0000-0000-0000-000000000007")
CAT_STREAMING = uuid.UUID("c3000001-0000-0000-0000-000000000008")

# Tags
TAG_WEEKEND  = uuid.UUID("d4000001-0000-0000-0000-000000000001")
TAG_WORK     = uuid.UUID("d4000001-0000-0000-0000-000000000002")
TAG_REIMBURS = uuid.UUID("d4000001-0000-0000-0000-000000000003")

# Payees
PAYEE_SWIGGY    = uuid.UUID("e5000001-0000-0000-0000-000000000001")
PAYEE_UBER      = uuid.UUID("e5000001-0000-0000-0000-000000000002")
PAYEE_EMPLOYER  = uuid.UUID("e5000001-0000-0000-0000-000000000003")
PAYEE_NETFLIX   = uuid.UUID("e5000001-0000-0000-0000-000000000004")
PAYEE_PHARMACY  = uuid.UUID("e5000001-0000-0000-0000-000000000005")
PAYEE_AMAZON    = uuid.UUID("e5000001-0000-0000-0000-000000000006")
PAYEE_SPOTIFY   = uuid.UUID("e5000001-0000-0000-0000-000000000007")

# Transactions — 3 months of history
# Scenario A: normal month with diverse expenses + income
TXN_SALARY_APR  = uuid.UUID("f6000001-0000-0000-0000-000000000001")
TXN_SALARY_MAY  = uuid.UUID("f6000001-0000-0000-0000-000000000002")
TXN_FOOD_1      = uuid.UUID("f6000001-0000-0000-0000-000000000003")
TXN_FOOD_2      = uuid.UUID("f6000001-0000-0000-0000-000000000004")
TXN_FOOD_3      = uuid.UUID("f6000001-0000-0000-0000-000000000005")
TXN_UBER_1      = uuid.UUID("f6000001-0000-0000-0000-000000000006")
TXN_UBER_2      = uuid.UUID("f6000001-0000-0000-0000-000000000007")
TXN_NETFLIX     = uuid.UUID("f6000001-0000-0000-0000-000000000008")
TXN_PHARMACY    = uuid.UUID("f6000001-0000-0000-0000-000000000009")
TXN_AMAZON      = uuid.UUID("f6000001-0000-0000-0000-000000000010")
TXN_SPOTIFY     = uuid.UUID("f6000001-0000-0000-0000-000000000011")
# Scenario B: transfer between accounts
TXN_TRANSFER    = uuid.UUID("f6000001-0000-0000-0000-000000000012")
# Scenario C: reimbursable work expense (tagged)
TXN_WORK_MEAL   = uuid.UUID("f6000001-0000-0000-0000-000000000013")
# Scenario D: credit card payment (income into credit card account to pay off)
TXN_CC_PAYMENT  = uuid.UUID("f6000001-0000-0000-0000-000000000014")

# Budgets
# Scenario: food budget with spending (transactions match via category)
BUD_FOOD_CURR   = uuid.UUID("g7000001-0000-0000-0000-000000000001")
# Scenario: transport budget, month just started — no spending yet (empty state)
BUD_TRANSPORT   = uuid.UUID("g7000001-0000-0000-0000-000000000002")
# Scenario: recurring entertainment budget (has parent/child structure)
BUD_ENTERTAIN   = uuid.UUID("g7000001-0000-0000-0000-000000000003")

# Subscriptions
# Scenario: upcoming (far away)
SUB_NETFLIX     = uuid.UUID("h8000001-0000-0000-0000-000000000001")
# Scenario: due_soon (within 3 days of today — billing_day set relative to seed date)
SUB_SPOTIFY     = uuid.UUID("h8000001-0000-0000-0000-000000000002")
# Scenario: overdue (last_billed_at one cycle ago, no new billing)
SUB_CLOUD       = uuid.UUID("h8000001-0000-0000-0000-000000000003")
# Scenario: subscription with transaction history linked
SUB_GYM         = uuid.UUID("h8000001-0000-0000-0000-000000000004")

# Transactions for linked subscription history
TXN_GYM_APR    = uuid.UUID("f6000001-0000-0000-0000-000000000020")
TXN_GYM_MAY    = uuid.UUID("f6000001-0000-0000-0000-000000000021")

# Piggy banks
# Scenario: just started (5%)
PIG_LAPTOP      = uuid.UUID("i9000001-0000-0000-0000-000000000001")
# Scenario: in progress (60%)
PIG_TRIP        = uuid.UUID("i9000001-0000-0000-0000-000000000002")
# Scenario: completed (100%)
PIG_PHONE       = uuid.UUID("i9000001-0000-0000-0000-000000000003")

# Contributions for the piggy banks above
CONTRIB_LAPTOP_1  = uuid.UUID("j0000001-0000-0000-0000-000000000001")
CONTRIB_TRIP_1    = uuid.UUID("j0000001-0000-0000-0000-000000000002")
CONTRIB_TRIP_2    = uuid.UUID("j0000001-0000-0000-0000-000000000003")
CONTRIB_PHONE_1   = uuid.UUID("j0000001-0000-0000-0000-000000000004")

# Transactions backing piggy bank contributions
TXN_PIG_LAPTOP_1  = uuid.UUID("f6000001-0000-0000-0000-000000000030")
TXN_PIG_TRIP_1    = uuid.UUID("f6000001-0000-0000-0000-000000000031")
TXN_PIG_TRIP_2    = uuid.UUID("f6000001-0000-0000-0000-000000000032")
TXN_PIG_PHONE_1   = uuid.UUID("f6000001-0000-0000-0000-000000000033")


def _now() -> datetime:
    return datetime.now(UTC)


def _dt(year: int, month: int, day: int, hour: int = 10) -> datetime:
    return datetime(year, month, day, hour, 0, 0, tzinfo=UTC)


async def seed_dev_data(user_id: uuid.UUID = USER_ID) -> None:
    """Seed all dev fixture data. Idempotent — safe to call on every startup."""
    async with async_session_factory() as session:
        await _seed_accounts(session, user_id)
        await _seed_payment_methods(session)
        await _seed_categories(session, user_id)
        await _seed_tags(session, user_id)
        await _seed_payees(session, user_id)
        await session.flush()  # resolve FKs before transactions

        await _seed_transactions(session, user_id)
        await session.flush()

        await _seed_budgets(session, user_id)
        await _seed_subscriptions(session, user_id)
        await _seed_piggy_banks(session, user_id)
        await session.commit()
        print("✓ Dev seed data loaded")


async def _seed_accounts(session: AsyncSession, uid: uuid.UUID) -> None:
    existing = set(
        r[0]
        for r in (
            await session.execute(
                sa.select(Account.id).where(
                    Account.id.in_([ACC_HDFC, ACC_ICICI, ACC_CASH, ACC_CREDIT])
                )
            )
        ).all()
    )

    rows = [
        Account(id=ACC_HDFC, user_id=uid, name="HDFC Savings", type=AccountType.bank,
                currency="INR", opening_balance=Decimal("50000"), current_balance=Decimal("87430")),
        Account(id=ACC_ICICI, user_id=uid, name="ICICI Savings", type=AccountType.bank,
                currency="INR", opening_balance=Decimal("20000"), current_balance=Decimal("23500")),
        Account(id=ACC_CASH, user_id=uid, name="Wallet (Cash)", type=AccountType.cash,
                currency="INR", opening_balance=Decimal("2000"), current_balance=Decimal("850")),
        Account(id=ACC_CREDIT, user_id=uid, name="HDFC Credit Card", type=AccountType.credit_card,
                currency="INR", opening_balance=Decimal("0"), current_balance=Decimal("-12400")),
    ]
    for row in rows:
        if row.id not in existing:
            session.add(row)


async def _seed_payment_methods(session: AsyncSession) -> None:
    existing = set(
        r[0]
        for r in (
            await session.execute(
                sa.select(PaymentMethod.id).where(
                    PaymentMethod.id.in_([PM_HDFC_UPI, PM_HDFC_DEBIT, PM_CREDIT_CC])
                )
            )
        ).all()
    )

    rows = [
        PaymentMethod(id=PM_HDFC_UPI, account_id=ACC_HDFC, type=PaymentMethodType.upi,
                      label="GPay", upi_app="gpay"),
        PaymentMethod(id=PM_HDFC_DEBIT, account_id=ACC_HDFC, type=PaymentMethodType.debit_card,
                      label="HDFC Debit ••4242"),
        PaymentMethod(id=PM_CREDIT_CC, account_id=ACC_CREDIT, type=PaymentMethodType.credit_card,
                      label="HDFC Credit ••9876"),
    ]
    for row in rows:
        if row.id not in existing:
            session.add(row)


async def _seed_categories(session: AsyncSession, uid: uuid.UUID) -> None:
    cat_ids = [CAT_FOOD, CAT_TRANSPORT, CAT_UTILITIES, CAT_ENTERTAIN,
               CAT_SALARY, CAT_HEALTH, CAT_SHOPPING, CAT_STREAMING]
    existing = set(
        r[0]
        for r in (
            await session.execute(sa.select(Category.id).where(Category.id.in_(cat_ids)))
        ).all()
    )

    rows = [
        Category(id=CAT_FOOD, user_id=uid, name="Food & Dining",
                 icon="🍽", color="#f97316", applicability=CategoryApplicability.expense),
        Category(id=CAT_TRANSPORT, user_id=uid, name="Transport",
                 icon="🚗", color="#3b82f6", applicability=CategoryApplicability.expense),
        Category(id=CAT_UTILITIES, user_id=uid, name="Utilities",
                 icon="💡", color="#6b7280", applicability=CategoryApplicability.expense),
        Category(id=CAT_ENTERTAIN, user_id=uid, name="Entertainment",
                 icon="🎬", color="#8b5cf6", applicability=CategoryApplicability.expense),
        Category(id=CAT_SALARY, user_id=uid, name="Salary",
                 icon="💰", color="#22c55e", applicability=CategoryApplicability.income),
        Category(id=CAT_HEALTH, user_id=uid, name="Health",
                 icon="💊", color="#ef4444", applicability=CategoryApplicability.expense),
        Category(id=CAT_SHOPPING, user_id=uid, name="Shopping",
                 icon="🛒", color="#ec4899", applicability=CategoryApplicability.expense),
        Category(id=CAT_STREAMING, user_id=uid, name="Streaming",
                 icon="📺", color="#06b6d4", applicability=CategoryApplicability.expense),
    ]
    for row in rows:
        if row.id not in existing:
            session.add(row)


async def _seed_tags(session: AsyncSession, uid: uuid.UUID) -> None:
    tag_ids = [TAG_WEEKEND, TAG_WORK, TAG_REIMBURS]
    existing = set(
        r[0]
        for r in (
            await session.execute(sa.select(Tag.id).where(Tag.id.in_(tag_ids)))
        ).all()
    )

    rows = [
        Tag(id=TAG_WEEKEND, user_id=uid, name="weekend", color="#f59e0b"),
        Tag(id=TAG_WORK, user_id=uid, name="work", color="#6366f1"),
        Tag(id=TAG_REIMBURS, user_id=uid, name="reimbursable", color="#10b981"),
    ]
    for row in rows:
        if row.id not in existing:
            session.add(row)


async def _seed_payees(session: AsyncSession, uid: uuid.UUID) -> None:
    payee_ids = [PAYEE_SWIGGY, PAYEE_UBER, PAYEE_EMPLOYER, PAYEE_NETFLIX,
                 PAYEE_PHARMACY, PAYEE_AMAZON, PAYEE_SPOTIFY]
    existing = set(
        r[0]
        for r in (
            await session.execute(sa.select(Payee.id).where(Payee.id.in_(payee_ids)))
        ).all()
    )

    rows = [
        Payee(id=PAYEE_SWIGGY, user_id=uid, name="Swiggy", type=PayeeType.merchant),
        Payee(id=PAYEE_UBER, user_id=uid, name="Uber", type=PayeeType.merchant),
        Payee(id=PAYEE_EMPLOYER, user_id=uid, name="Acme Corp", type=PayeeType.business),
        Payee(id=PAYEE_NETFLIX, user_id=uid, name="Netflix", type=PayeeType.merchant),
        Payee(id=PAYEE_PHARMACY, user_id=uid, name="Apollo Pharmacy", type=PayeeType.merchant),
        Payee(id=PAYEE_AMAZON, user_id=uid, name="Amazon", type=PayeeType.merchant),
        Payee(id=PAYEE_SPOTIFY, user_id=uid, name="Spotify", type=PayeeType.merchant),
    ]
    for row in rows:
        if row.id not in existing:
            session.add(row)

    # Payee default categories (set after flush so payees exist)
    # Use INSERT … ON CONFLICT DO NOTHING to stay idempotent
    await session.flush()
    payee_cats = [
        (PAYEE_SWIGGY, CAT_FOOD),
        (PAYEE_UBER, CAT_TRANSPORT),
        (PAYEE_NETFLIX, CAT_STREAMING),
        (PAYEE_SPOTIFY, CAT_STREAMING),
        (PAYEE_PHARMACY, CAT_HEALTH),
        (PAYEE_AMAZON, CAT_SHOPPING),
    ]
    existing_pdc = set(
        (r[0], r[1])
        for r in (
            await session.execute(
                sa.select(
                    payee_default_categories.c.payee_id,
                    payee_default_categories.c.category_id,
                ).where(
                    payee_default_categories.c.payee_id.in_(
                        [p for p, _ in payee_cats]
                    )
                )
            )
        ).all()
    )
    for payee_id, cat_id in payee_cats:
        if (payee_id, cat_id) not in existing_pdc:
            await session.execute(
                payee_default_categories.insert().values(
                    payee_id=payee_id, category_id=cat_id
                )
            )


async def _seed_transactions(session: AsyncSession, uid: uuid.UUID) -> None:
    all_txn_ids = [
        TXN_SALARY_APR, TXN_SALARY_MAY, TXN_FOOD_1, TXN_FOOD_2, TXN_FOOD_3,
        TXN_UBER_1, TXN_UBER_2, TXN_NETFLIX, TXN_PHARMACY, TXN_AMAZON,
        TXN_SPOTIFY, TXN_TRANSFER, TXN_WORK_MEAL, TXN_CC_PAYMENT,
        TXN_GYM_APR, TXN_GYM_MAY,
        TXN_PIG_LAPTOP_1, TXN_PIG_TRIP_1, TXN_PIG_TRIP_2, TXN_PIG_PHONE_1,
    ]
    existing = set(
        r[0]
        for r in (
            await session.execute(sa.select(Transaction.id).where(Transaction.id.in_(all_txn_ids)))
        ).all()
    )

    txns = [
        # ── Income ──────────────────────────────────────────────────────────
        Transaction(id=TXN_SALARY_APR, user_id=uid, type=TransactionType.income,
                    transacted_at=_dt(2026, 4, 1), amount=Decimal("85000"),
                    currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_EMPLOYER,
                    description="April salary"),
        Transaction(id=TXN_SALARY_MAY, user_id=uid, type=TransactionType.income,
                    transacted_at=_dt(2026, 5, 1), amount=Decimal("85000"),
                    currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_EMPLOYER,
                    description="May salary"),

        # ── Food expenses (match Food & Dining budget) ───────────────────
        Transaction(id=TXN_FOOD_1, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 5), amount=Decimal("420"),
                    currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_SWIGGY,
                    payment_method_id=PM_HDFC_UPI, description="Dinner order"),
        Transaction(id=TXN_FOOD_2, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 12), amount=Decimal("680"),
                    currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_SWIGGY,
                    payment_method_id=PM_HDFC_UPI, description="Weekend lunch"),
        Transaction(id=TXN_FOOD_3, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 18), amount=Decimal("310"),
                    currency="INR", account_id=ACC_CASH, description="Street food"),

        # ── Transport expenses ───────────────────────────────────────────
        Transaction(id=TXN_UBER_1, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 8), amount=Decimal("250"),
                    currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                    payment_method_id=PM_HDFC_UPI, description="Ride to airport"),
        Transaction(id=TXN_UBER_2, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 20), amount=Decimal("180"),
                    currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                    payment_method_id=PM_HDFC_UPI, description="Ride to office"),

        # ── Streaming subscriptions ──────────────────────────────────────
        Transaction(id=TXN_NETFLIX, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 4, 15), amount=Decimal("649"),
                    currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_NETFLIX,
                    payment_method_id=PM_CREDIT_CC, description="Netflix Apr"),
        Transaction(id=TXN_SPOTIFY, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 4, 20), amount=Decimal("119"),
                    currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SPOTIFY,
                    payment_method_id=PM_CREDIT_CC, description="Spotify Apr"),

        # ── Health ──────────────────────────────────────────────────────
        Transaction(id=TXN_PHARMACY, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 10), amount=Decimal("540"),
                    currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_PHARMACY,
                    payment_method_id=PM_HDFC_DEBIT, description="Monthly meds"),

        # ── Shopping ────────────────────────────────────────────────────
        Transaction(id=TXN_AMAZON, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 3), amount=Decimal("1899"),
                    currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_AMAZON,
                    payment_method_id=PM_CREDIT_CC, description="USB hub"),

        # ── Transfer between accounts (empty-state scenario for new account) ─
        Transaction(id=TXN_TRANSFER, user_id=uid, type=TransactionType.transfer,
                    transacted_at=_dt(2026, 5, 2), amount=Decimal("10000"),
                    currency="INR", account_id=ACC_HDFC,
                    to_account_id=ACC_ICICI, to_amount=Decimal("10000"),
                    to_currency="INR", description="Top-up ICICI savings"),

        # ── Work expense (tagged reimbursable) ──────────────────────────
        Transaction(id=TXN_WORK_MEAL, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 15), amount=Decimal("2400"),
                    currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SWIGGY,
                    payment_method_id=PM_CREDIT_CC,
                    description="Team lunch — reimbursable"),

        # ── Credit card payment ─────────────────────────────────────────
        Transaction(id=TXN_CC_PAYMENT, user_id=uid, type=TransactionType.transfer,
                    transacted_at=_dt(2026, 5, 22), amount=Decimal("15000"),
                    currency="INR", account_id=ACC_HDFC,
                    to_account_id=ACC_CREDIT, to_amount=Decimal("15000"),
                    to_currency="INR", description="Credit card bill payment"),

        # ── Gym subscription history transactions ───────────────────────
        Transaction(id=TXN_GYM_APR, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 4, 5), amount=Decimal("2500"),
                    currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                    description="Gym membership Apr"),
        Transaction(id=TXN_GYM_MAY, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 5), amount=Decimal("2500"),
                    currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                    description="Gym membership May"),

        # ── Piggy bank contribution transactions ─────────────────────────
        Transaction(id=TXN_PIG_LAPTOP_1, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 1), amount=Decimal("2500"),
                    currency="INR", account_id=ACC_HDFC,
                    description="Laptop fund — monthly save"),
        Transaction(id=TXN_PIG_TRIP_1, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 4, 1), amount=Decimal("10000"),
                    currency="INR", account_id=ACC_HDFC,
                    description="Goa trip fund — Apr"),
        Transaction(id=TXN_PIG_TRIP_2, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 5, 1), amount=Decimal("8000"),
                    currency="INR", account_id=ACC_HDFC,
                    description="Goa trip fund — May"),
        Transaction(id=TXN_PIG_PHONE_1, user_id=uid, type=TransactionType.expense,
                    transacted_at=_dt(2026, 3, 15), amount=Decimal("45000"),
                    currency="INR", account_id=ACC_HDFC,
                    description="New phone purchase"),
    ]

    for txn in txns:
        if txn.id not in existing:
            session.add(txn)

    await session.flush()

    # ── Transaction categories ────────────────────────────────────────────────
    txn_cats = [
        (TXN_SALARY_APR, CAT_SALARY),
        (TXN_SALARY_MAY, CAT_SALARY),
        (TXN_FOOD_1, CAT_FOOD),
        (TXN_FOOD_2, CAT_FOOD),
        (TXN_FOOD_3, CAT_FOOD),
        (TXN_UBER_1, CAT_TRANSPORT),
        (TXN_UBER_2, CAT_TRANSPORT),
        (TXN_NETFLIX, CAT_STREAMING),
        (TXN_SPOTIFY, CAT_STREAMING),
        (TXN_PHARMACY, CAT_HEALTH),
        (TXN_AMAZON, CAT_SHOPPING),
        (TXN_WORK_MEAL, CAT_FOOD),
    ]
    existing_cats = set(
        (r[0], r[1])
        for r in (
            await session.execute(
                sa.select(
                    transaction_categories.c.transaction_id,
                    transaction_categories.c.category_id,
                ).where(
                    transaction_categories.c.transaction_id.in_(
                        [t for t, _ in txn_cats]
                    )
                )
            )
        ).all()
    )
    for txn_id, cat_id in txn_cats:
        if (txn_id, cat_id) not in existing_cats:
            await session.execute(
                transaction_categories.insert().values(
                    transaction_id=txn_id, category_id=cat_id
                )
            )

    # ── Transaction tags ──────────────────────────────────────────────────────
    txn_tags = [
        (TXN_FOOD_2, TAG_WEEKEND),
        (TXN_WORK_MEAL, TAG_WORK),
        (TXN_WORK_MEAL, TAG_REIMBURS),
        (TXN_UBER_1, TAG_WORK),
    ]
    existing_tags = set(
        (r[0], r[1])
        for r in (
            await session.execute(
                sa.select(
                    transaction_tags.c.transaction_id,
                    transaction_tags.c.tag_id,
                ).where(
                    transaction_tags.c.transaction_id.in_(
                        [t for t, _ in txn_tags]
                    )
                )
            )
        ).all()
    )
    for txn_id, tag_id in txn_tags:
        if (txn_id, tag_id) not in existing_tags:
            await session.execute(
                transaction_tags.insert().values(
                    transaction_id=txn_id, tag_id=tag_id
                )
            )


async def _seed_budgets(session: AsyncSession, uid: uuid.UUID) -> None:
    bud_ids = [BUD_FOOD_CURR, BUD_TRANSPORT, BUD_ENTERTAIN]
    existing = set(
        r[0]
        for r in (
            await session.execute(sa.select(Budget.id).where(Budget.id.in_(bud_ids)))
        ).all()
    )

    today = date.today()
    month_start = today.replace(day=1)
    month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

    rows = [
        # Food budget — has spending (TXN_FOOD_1/2/3 match via category)
        Budget(id=BUD_FOOD_CURR, user_id=uid, name="May Food Budget",
               type=BudgetType.adhoc, amount=Decimal("5000"), currency="INR",
               start_date=month_start, end_date=month_end,
               notes="Includes dining out"),

        # Transport budget — no spending this month (empty-state scenario)
        Budget(id=BUD_TRANSPORT, user_id=uid, name="Transport (Monthly)",
               type=BudgetType.recurring, amount=Decimal("3000"), currency="INR",
               period=BudgetPeriod.monthly,
               recurrence_rule="FREQ=MONTHLY;BYMONTHDAY=1"),

        # Entertainment budget — recurring with some history
        Budget(id=BUD_ENTERTAIN, user_id=uid, name="Entertainment",
               type=BudgetType.recurring, amount=Decimal("2000"), currency="INR",
               period=BudgetPeriod.monthly,
               recurrence_rule="FREQ=MONTHLY;BYMONTHDAY=1"),
    ]
    for row in rows:
        if row.id not in existing:
            session.add(row)

    await session.flush()

    # Budget categories
    bud_cats = [
        (BUD_FOOD_CURR, CAT_FOOD),
        (BUD_TRANSPORT, CAT_TRANSPORT),
        (BUD_ENTERTAIN, CAT_ENTERTAIN),
        (BUD_ENTERTAIN, CAT_STREAMING),
    ]
    existing_bc = set(
        (r[0], r[1])
        for r in (
            await session.execute(
                sa.select(budget_categories.c.budget_id, budget_categories.c.category_id)
                .where(budget_categories.c.budget_id.in_(bud_ids))
            )
        ).all()
    )
    for bud_id, cat_id in bud_cats:
        if (bud_id, cat_id) not in existing_bc:
            await session.execute(
                budget_categories.insert().values(budget_id=bud_id, category_id=cat_id)
            )


async def _seed_subscriptions(session: AsyncSession, uid: uuid.UUID) -> None:
    sub_ids = [SUB_NETFLIX, SUB_SPOTIFY, SUB_CLOUD, SUB_GYM]
    existing = set(
        r[0]
        for r in (
            await session.execute(sa.select(Subscription.id).where(Subscription.id.in_(sub_ids)))
        ).all()
    )

    today = date.today()

    # due_soon: billing_day = (today + 2).day so next occurrence is 2 days away
    due_soon_day = (today + timedelta(days=2)).day

    # overdue: last billed one full cycle ago (already past), no new billing
    one_month_ago = _dt(today.year, today.month, today.day) - timedelta(days=32)

    rows = [
        # Upcoming — next billing 15th, always well ahead if seeded mid-month
        Subscription(id=SUB_NETFLIX, user_id=uid, name="Netflix",
                     amount=Decimal("649"), currency="INR",
                     billing_cycle=BillingCycle.monthly, billing_day=15,
                     account_id=ACC_CREDIT, payment_method_id=PM_CREDIT_CC,
                     category_id=CAT_STREAMING, url="https://netflix.com"),

        # due_soon — billing day is 2 days from today
        Subscription(id=SUB_SPOTIFY, user_id=uid, name="Spotify",
                     amount=Decimal("119"), currency="INR",
                     billing_cycle=BillingCycle.monthly, billing_day=due_soon_day,
                     account_id=ACC_CREDIT, payment_method_id=PM_CREDIT_CC,
                     category_id=CAT_STREAMING),

        # overdue — last billed >1 month ago, next date is already in the past
        Subscription(id=SUB_CLOUD, user_id=uid, name="AWS S3 (Personal)",
                     amount=Decimal("350"), currency="INR",
                     billing_cycle=BillingCycle.monthly, billing_day=1,
                     last_billed_at=one_month_ago,
                     account_id=ACC_HDFC,
                     notes="Object storage for backups"),

        # With history — 2 transactions linked
        Subscription(id=SUB_GYM, user_id=uid, name="Gym Membership",
                     amount=Decimal("2500"), currency="INR",
                     billing_cycle=BillingCycle.monthly, billing_day=5,
                     account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI),
    ]
    for row in rows:
        if row.id not in existing:
            session.add(row)

    await session.flush()

    # Link gym transactions to the gym subscription
    for txn_id in [TXN_GYM_APR, TXN_GYM_MAY]:
        await session.execute(
            sa.update(Transaction)
            .where(Transaction.id == txn_id, Transaction.subscription_id.is_(None))
            .values(subscription_id=SUB_GYM)
        )


async def _seed_piggy_banks(session: AsyncSession, uid: uuid.UUID) -> None:
    pig_ids = [PIG_LAPTOP, PIG_TRIP, PIG_PHONE]
    existing_pigs = set(
        r[0]
        for r in (
            await session.execute(sa.select(PiggyBank.id).where(PiggyBank.id.in_(pig_ids)))
        ).all()
    )

    today = date.today()

    rows = [
        # Just started (5% progress — 2500 of 50000)
        PiggyBank(id=PIG_LAPTOP, user_id=uid, name="New Laptop",
                  target_amount=Decimal("50000"), currency="INR",
                  current_amount=Decimal("2500"),
                  target_date=today + timedelta(days=300),
                  notes="Saving for a MacBook"),

        # In progress (60% — 18000 of 30000)
        PiggyBank(id=PIG_TRIP, user_id=uid, name="Goa Trip",
                  target_amount=Decimal("30000"), currency="INR",
                  current_amount=Decimal("18000"),
                  target_date=today + timedelta(days=90)),

        # Completed (100%)
        PiggyBank(id=PIG_PHONE, user_id=uid, name="New Phone",
                  target_amount=Decimal("45000"), currency="INR",
                  current_amount=Decimal("45000"),
                  is_completed=True),
    ]
    for row in rows:
        if row.id not in existing_pigs:
            session.add(row)

    await session.flush()

    # Contributions
    contrib_ids = [CONTRIB_LAPTOP_1, CONTRIB_TRIP_1, CONTRIB_TRIP_2, CONTRIB_PHONE_1]
    existing_contribs = set(
        r[0]
        for r in (
            await session.execute(
                sa.select(PiggyBankContribution.id)
                .where(PiggyBankContribution.id.in_(contrib_ids))
            )
        ).all()
    )

    today = date.today()
    contribs = [
        PiggyBankContribution(id=CONTRIB_LAPTOP_1, piggy_bank_id=PIG_LAPTOP,
                              transaction_id=TXN_PIG_LAPTOP_1,
                              contribution_type=ContributionType.expense,
                              amount=Decimal("2500"), date=date(2026, 5, 1)),
        PiggyBankContribution(id=CONTRIB_TRIP_1, piggy_bank_id=PIG_TRIP,
                              transaction_id=TXN_PIG_TRIP_1,
                              contribution_type=ContributionType.expense,
                              amount=Decimal("10000"), date=date(2026, 4, 1)),
        PiggyBankContribution(id=CONTRIB_TRIP_2, piggy_bank_id=PIG_TRIP,
                              transaction_id=TXN_PIG_TRIP_2,
                              contribution_type=ContributionType.expense,
                              amount=Decimal("8000"), date=date(2026, 5, 1)),
        PiggyBankContribution(id=CONTRIB_PHONE_1, piggy_bank_id=PIG_PHONE,
                              transaction_id=TXN_PIG_PHONE_1,
                              contribution_type=ContributionType.expense,
                              amount=Decimal("45000"), date=date(2026, 3, 15)),
    ]
    for contrib in contribs:
        if contrib.id not in existing_contribs:
            session.add(contrib)
