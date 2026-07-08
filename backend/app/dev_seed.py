"""
Dev-mode fixture data. Runs on every startup when DEV_MODE=true.

Wipes all data for the dev user and re-inserts clean — any POST/PUT
changes you made are gone on the next restart. The DB schema uses
ON DELETE CASCADE everywhere, so deleting the user row is sufficient.
"""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import sqlalchemy as sa

from app.db.session import async_session_factory
from app.models.account import Account, AccountType
from app.models.budget import Budget, BudgetPeriod, BudgetType, budget_categories
from app.models.category import Category, CategoryApplicability, payee_default_categories
from app.models.payee import Payee, PayeeType
from app.models.payment_method import PaymentMethod, PaymentMethodType
from app.models.piggy_bank import ContributionType, PiggyBank, PiggyBankContribution
from app.models.split import Split, SplitExpense, SplitShare, SplitShareSettlement, SplitShareStatus
from app.models.subscription import BillingCycle, Subscription
from app.models.tag import Tag
from app.models.transaction import (
    Transaction,
    TransactionType,
    transaction_budgets,
    transaction_categories,
    transaction_tags,
)
from app.models.user import User
from app.models.user_settings import UserSettings
from app.security.passwords import hash_password

# ── Fixed IDs ─────────────────────────────────────────────────────────────────

USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEV_USER_EMAIL = "dev@kanakku.com"
DEV_USER_PASSWORD = "dev-password"

# Accounts
ACC_HDFC    = uuid.UUID("a1000001-0000-0000-0000-000000000001")
ACC_ICICI   = uuid.UUID("a1000001-0000-0000-0000-000000000002")
ACC_CASH    = uuid.UUID("a1000001-0000-0000-0000-000000000003")
ACC_CREDIT  = uuid.UUID("a1000001-0000-0000-0000-000000000004")

# Payment methods
PM_HDFC_UPI   = uuid.UUID("b2000001-0000-0000-0000-000000000001")
PM_HDFC_DEBIT = uuid.UUID("b2000001-0000-0000-0000-000000000002")

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
# Friends (used in split scenarios)
PAYEE_RAHUL     = uuid.UUID("e5000001-0000-0000-0000-000000000010")
PAYEE_PRIYA     = uuid.UUID("e5000001-0000-0000-0000-000000000011")
PAYEE_NEEL      = uuid.UUID("e5000001-0000-0000-0000-000000000012")

# Transactions
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
TXN_TRANSFER    = uuid.UUID("f6000001-0000-0000-0000-000000000012")
TXN_WORK_MEAL   = uuid.UUID("f6000001-0000-0000-0000-000000000013")
TXN_CC_PAYMENT  = uuid.UUID("f6000001-0000-0000-0000-000000000014")
TXN_GYM_APR     = uuid.UUID("f6000001-0000-0000-0000-000000000020")
TXN_GYM_MAY     = uuid.UUID("f6000001-0000-0000-0000-000000000021")
TXN_PIG_LAPTOP_1 = uuid.UUID("f6000001-0000-0000-0000-000000000030")
TXN_PIG_TRIP_1   = uuid.UUID("f6000001-0000-0000-0000-000000000031")
TXN_PIG_TRIP_2   = uuid.UUID("f6000001-0000-0000-0000-000000000032")
TXN_PIG_PHONE_1  = uuid.UUID("f6000001-0000-0000-0000-000000000033")
TXN_OB_HDFC      = uuid.UUID("f6000001-0000-0000-0000-000000000040")
TXN_OB_ICICI     = uuid.UUID("f6000001-0000-0000-0000-000000000041")
TXN_OB_CASH      = uuid.UUID("f6000001-0000-0000-0000-000000000042")

# Jan–Mar spread (so cashflow chart has data across all months)
TXN_SALARY_JAN   = uuid.UUID("f6000001-0000-0000-0000-000000000050")
TXN_SALARY_FEB   = uuid.UUID("f6000001-0000-0000-0000-000000000051")
TXN_SALARY_MAR   = uuid.UUID("f6000001-0000-0000-0000-000000000052")
TXN_GYM_JAN      = uuid.UUID("f6000001-0000-0000-0000-000000000053")
TXN_GYM_FEB      = uuid.UUID("f6000001-0000-0000-0000-000000000054")
TXN_GYM_MAR      = uuid.UUID("f6000001-0000-0000-0000-000000000055")
TXN_FOOD_JAN     = uuid.UUID("f6000001-0000-0000-0000-000000000056")
TXN_FOOD_FEB     = uuid.UUID("f6000001-0000-0000-0000-000000000057")
TXN_FOOD_MAR     = uuid.UUID("f6000001-0000-0000-0000-000000000058")
TXN_NETFLIX_JAN  = uuid.UUID("f6000001-0000-0000-0000-000000000059")
TXN_NETFLIX_FEB  = uuid.UUID("f6000001-0000-0000-0000-000000000060")
TXN_NETFLIX_MAR  = uuid.UUID("f6000001-0000-0000-0000-000000000061")
TXN_ICICI_JAN    = uuid.UUID("f6000001-0000-0000-0000-000000000062")
TXN_ICICI_FEB    = uuid.UUID("f6000001-0000-0000-0000-000000000063")
TXN_ICICI_MAR    = uuid.UUID("f6000001-0000-0000-0000-000000000064")
TXN_CASH_JAN     = uuid.UUID("f6000001-0000-0000-0000-000000000065")
TXN_CASH_FEB     = uuid.UUID("f6000001-0000-0000-0000-000000000066")

# Budget-linked transport transactions Jan–Apr (May uses TXN_UBER_1/2 already)
TXN_UBER_JAN     = uuid.UUID("f6000001-0000-0000-0000-000000000070")
TXN_UBER_FEB     = uuid.UUID("f6000001-0000-0000-0000-000000000071")
TXN_UBER_MAR     = uuid.UUID("f6000001-0000-0000-0000-000000000072")
TXN_UBER_APR     = uuid.UUID("f6000001-0000-0000-0000-000000000073")

# Budget-linked entertainment transactions Jan–May (Apr uses TXN_NETFLIX/SPOTIFY already)
TXN_SPOTIFY_JAN  = uuid.UUID("f6000001-0000-0000-0000-000000000074")
TXN_SPOTIFY_FEB  = uuid.UUID("f6000001-0000-0000-0000-000000000075")
TXN_SPOTIFY_MAR  = uuid.UUID("f6000001-0000-0000-0000-000000000076")
TXN_SPOTIFY_MAY  = uuid.UUID("f6000001-0000-0000-0000-000000000077")
TXN_NETFLIX_MAY  = uuid.UUID("f6000001-0000-0000-0000-000000000078")

# May single transactions (no split)
TXN_GROCERY_MAY  = uuid.UUID("f6000001-0000-0000-0000-000000000080")
TXN_PETROL_MAY   = uuid.UUID("f6000001-0000-0000-0000-000000000081")
TXN_COFFEE_MAY   = uuid.UUID("f6000001-0000-0000-0000-000000000082")

# May split expense transactions (the parent expense that gets split)
TXN_SPLIT_DINNER = uuid.UUID("f6000001-0000-0000-0000-000000000090")  # 4-way, 25% settled
TXN_SPLIT_FUEL   = uuid.UUID("f6000001-0000-0000-0000-000000000091")  # 3-way, 100% settled
TXN_SPLIT_MOVIE  = uuid.UUID("f6000001-0000-0000-0000-000000000092")  # 2-way, 50% settled

# Split share settlement income transactions
TXN_SETTLE_FUEL_RAHUL = uuid.UUID("f6000001-0000-0000-0000-000000000093")
TXN_SETTLE_FUEL_PRIYA = uuid.UUID("f6000001-0000-0000-0000-000000000094")
TXN_SETTLE_MOVIE_NEEL = uuid.UUID("f6000001-0000-0000-0000-000000000095")

# Splits
SPLIT_DINNER     = uuid.UUID("91000001-0000-0000-0000-000000000001")
SPLIT_FUEL       = uuid.UUID("91000001-0000-0000-0000-000000000002")
SPLIT_MOVIE      = uuid.UUID("91000001-0000-0000-0000-000000000003")

# Split expense rows (split_expenses join table)
SPLIT_EXP_DINNER = uuid.UUID("91000001-0000-0000-0000-000000000011")
SPLIT_EXP_FUEL   = uuid.UUID("91000001-0000-0000-0000-000000000012")
SPLIT_EXP_MOVIE  = uuid.UUID("91000001-0000-0000-0000-000000000013")

# Split shares
SHARE_DINNER_OWN    = uuid.UUID("92000001-0000-0000-0000-000000000010")  # user's own ₹900
SHARE_DINNER_RAHUL  = uuid.UUID("92000001-0000-0000-0000-000000000001")
SHARE_DINNER_PRIYA  = uuid.UUID("92000001-0000-0000-0000-000000000002")
SHARE_DINNER_NEEL   = uuid.UUID("92000001-0000-0000-0000-000000000003")
SHARE_FUEL_OWN      = uuid.UUID("92000001-0000-0000-0000-000000000040")  # user's own ₹800
SHARE_FUEL_RAHUL    = uuid.UUID("92000001-0000-0000-0000-000000000004")
SHARE_FUEL_PRIYA    = uuid.UUID("92000001-0000-0000-0000-000000000005")
SHARE_MOVIE_OWN     = uuid.UUID("92000001-0000-0000-0000-000000000050")  # user's own ₹900
SHARE_MOVIE_NEEL    = uuid.UUID("92000001-0000-0000-0000-000000000006")

# Split share settlements (join table rows)
SETTLEMENT_FUEL_RAHUL = uuid.UUID("93000001-0000-0000-0000-000000000001")
SETTLEMENT_FUEL_PRIYA = uuid.UUID("93000001-0000-0000-0000-000000000002")
SETTLEMENT_MOVIE_NEEL = uuid.UUID("93000001-0000-0000-0000-000000000003")

# Budgets
BUD_FOOD_CURR   = uuid.UUID("b7000001-0000-0000-0000-000000000001")
BUD_TRANSPORT   = uuid.UUID("b7000001-0000-0000-0000-000000000002")
BUD_ENTERTAIN   = uuid.UUID("b7000001-0000-0000-0000-000000000003")

# Subscriptions
SUB_NETFLIX     = uuid.UUID("e8000001-0000-0000-0000-000000000001")
SUB_SPOTIFY     = uuid.UUID("e8000001-0000-0000-0000-000000000002")
SUB_CLOUD       = uuid.UUID("e8000001-0000-0000-0000-000000000003")
SUB_GYM         = uuid.UUID("e8000001-0000-0000-0000-000000000004")

# Piggy banks
PIG_LAPTOP      = uuid.UUID("f9000001-0000-0000-0000-000000000001")
PIG_TRIP        = uuid.UUID("f9000001-0000-0000-0000-000000000002")
PIG_PHONE       = uuid.UUID("f9000001-0000-0000-0000-000000000003")

# Piggy bank contributions
CONTRIB_LAPTOP_1  = uuid.UUID("c0000001-0000-0000-0000-000000000001")
CONTRIB_TRIP_1    = uuid.UUID("c0000001-0000-0000-0000-000000000002")
CONTRIB_TRIP_2    = uuid.UUID("c0000001-0000-0000-0000-000000000003")
CONTRIB_PHONE_1   = uuid.UUID("c0000001-0000-0000-0000-000000000004")


def _dt(year: int, month: int, day: int, hour: int = 10) -> datetime:
    return datetime(year, month, day, hour, 0, 0, tzinfo=UTC)


async def seed_dev_data() -> None:
    """Wipe dev user + all cascade-deleted data, then insert fresh fixtures."""
    async with async_session_factory() as session:
        await session.execute(sa.delete(User).where(User.id == USER_ID))
        await session.commit()

    async with async_session_factory() as session:
        # ── User ──────────────────────────────────────────────────────────────
        session.add(User(
            id=USER_ID,
            email=DEV_USER_EMAIL,
            password_hash=hash_password(DEV_USER_PASSWORD),
        ))
        await session.flush()
        session.add(UserSettings(user_id=USER_ID))

        # ── Accounts ──────────────────────────────────────────────────────────
        session.add(Account(id=ACC_HDFC, user_id=USER_ID, name="HDFC Savings",
                            type=AccountType.bank, currency="INR",
                            opening_balance=Decimal("50000"), current_balance=Decimal("87430")))
        session.add(Account(id=ACC_ICICI, user_id=USER_ID, name="ICICI Savings",
                            type=AccountType.bank, currency="INR",
                            opening_balance=Decimal("20000"), current_balance=Decimal("23500")))
        session.add(Account(id=ACC_CASH, user_id=USER_ID, name="Wallet (Cash)",
                            type=AccountType.cash, currency="INR",
                            opening_balance=Decimal("2000"), current_balance=Decimal("850")))
        session.add(Account(id=ACC_CREDIT, user_id=USER_ID, name="HDFC Credit Card",
                            type=AccountType.credit_card, currency="INR",
                            opening_balance=Decimal("0"), current_balance=Decimal("-12400")))
        await session.flush()

        # ── Payment methods ───────────────────────────────────────────────────
        session.add(PaymentMethod(id=PM_HDFC_UPI, account_id=ACC_HDFC,
                                  type=PaymentMethodType.upi, name="GPay", upi_app="gpay"))
        session.add(PaymentMethod(id=PM_HDFC_DEBIT, account_id=ACC_HDFC,
                                  type=PaymentMethodType.debit_card, name="HDFC Debit ••4242"))

        # ── Categories ────────────────────────────────────────────────────────
        session.add(Category(id=CAT_FOOD, user_id=USER_ID, name="Food & Dining",
                             icon="🍽", color="#f97316", applicability=CategoryApplicability.expense))
        session.add(Category(id=CAT_TRANSPORT, user_id=USER_ID, name="Transport",
                             icon="🚗", color="#3b82f6", applicability=CategoryApplicability.expense))
        session.add(Category(id=CAT_UTILITIES, user_id=USER_ID, name="Utilities",
                             icon="💡", color="#6b7280", applicability=CategoryApplicability.expense))
        session.add(Category(id=CAT_ENTERTAIN, user_id=USER_ID, name="Entertainment",
                             icon="🎬", color="#8b5cf6", applicability=CategoryApplicability.expense))
        session.add(Category(id=CAT_SALARY, user_id=USER_ID, name="Salary",
                             icon="💰", color="#22c55e", applicability=CategoryApplicability.income))
        session.add(Category(id=CAT_HEALTH, user_id=USER_ID, name="Health",
                             icon="💊", color="#ef4444", applicability=CategoryApplicability.expense))
        session.add(Category(id=CAT_SHOPPING, user_id=USER_ID, name="Shopping",
                             icon="🛒", color="#ec4899", applicability=CategoryApplicability.expense))
        session.add(Category(id=CAT_STREAMING, user_id=USER_ID, name="Streaming",
                             icon="📺", color="#06b6d4", applicability=CategoryApplicability.expense))

        # ── Tags ──────────────────────────────────────────────────────────────
        session.add(Tag(id=TAG_WEEKEND, user_id=USER_ID, name="weekend", color="#f59e0b"))
        session.add(Tag(id=TAG_WORK, user_id=USER_ID, name="work", color="#6366f1"))
        session.add(Tag(id=TAG_REIMBURS, user_id=USER_ID, name="reimbursable", color="#10b981"))

        # ── Payees ────────────────────────────────────────────────────────────
        session.add(Payee(id=PAYEE_SWIGGY, user_id=USER_ID, name="Swiggy", type=PayeeType.merchant))
        session.add(Payee(id=PAYEE_UBER, user_id=USER_ID, name="Uber", type=PayeeType.merchant))
        session.add(Payee(id=PAYEE_EMPLOYER, user_id=USER_ID, name="Acme Corp", type=PayeeType.business))
        session.add(Payee(id=PAYEE_NETFLIX, user_id=USER_ID, name="Netflix", type=PayeeType.merchant))
        session.add(Payee(id=PAYEE_PHARMACY, user_id=USER_ID, name="Apollo Pharmacy", type=PayeeType.merchant))
        session.add(Payee(id=PAYEE_AMAZON, user_id=USER_ID, name="Amazon", type=PayeeType.merchant))
        session.add(Payee(id=PAYEE_SPOTIFY, user_id=USER_ID, name="Spotify", type=PayeeType.merchant))
        session.add(Payee(id=PAYEE_RAHUL, user_id=USER_ID, name="Rahul", type=PayeeType.person))
        session.add(Payee(id=PAYEE_PRIYA, user_id=USER_ID, name="Priya", type=PayeeType.person))
        session.add(Payee(id=PAYEE_NEEL, user_id=USER_ID, name="Neel", type=PayeeType.person))
        await session.flush()

        # Payee default categories
        for payee_id, cat_id in [
            (PAYEE_SWIGGY, CAT_FOOD), (PAYEE_UBER, CAT_TRANSPORT),
            (PAYEE_NETFLIX, CAT_STREAMING), (PAYEE_SPOTIFY, CAT_STREAMING),
            (PAYEE_PHARMACY, CAT_HEALTH), (PAYEE_AMAZON, CAT_SHOPPING),
        ]:
            await session.execute(
                payee_default_categories.insert().values(payee_id=payee_id, category_id=cat_id)
            )

        # ── Transactions ──────────────────────────────────────────────────────
        txns = [
            # Scenario: opening balances (dated Jan 1 to appear before all other transactions)
            Transaction(id=TXN_OB_HDFC, user_id=USER_ID, type=TransactionType.opening_balance,
                        transacted_at=_dt(2026, 1, 1), amount=Decimal("50000"),
                        currency="INR", account_id=ACC_HDFC,
                        description="Opening balance"),
            Transaction(id=TXN_OB_ICICI, user_id=USER_ID, type=TransactionType.opening_balance,
                        transacted_at=_dt(2026, 1, 1), amount=Decimal("25000"),
                        currency="INR", account_id=ACC_ICICI,
                        description="Opening balance"),
            Transaction(id=TXN_OB_CASH, user_id=USER_ID, type=TransactionType.opening_balance,
                        transacted_at=_dt(2026, 1, 1), amount=Decimal("5000"),
                        currency="INR", account_id=ACC_CASH,
                        description="Opening balance"),
            Transaction(id=TXN_SALARY_APR, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 4, 1), amount=Decimal("85000"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_EMPLOYER,
                        description="April salary"),
            Transaction(id=TXN_SALARY_MAY, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 5, 1), amount=Decimal("85000"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_EMPLOYER,
                        description="May salary"),
            Transaction(id=TXN_FOOD_1, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 5), amount=Decimal("420"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_SWIGGY,
                        payment_method_id=PM_HDFC_UPI, description="Dinner order"),
            Transaction(id=TXN_FOOD_2, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 12), amount=Decimal("680"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_SWIGGY,
                        payment_method_id=PM_HDFC_UPI, description="Weekend lunch"),
            Transaction(id=TXN_FOOD_3, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 18), amount=Decimal("310"),
                        currency="INR", account_id=ACC_CASH, description="Street food"),
            Transaction(id=TXN_UBER_1, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 8), amount=Decimal("250"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                        payment_method_id=PM_HDFC_UPI, description="Ride to airport"),
            Transaction(id=TXN_UBER_2, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 20), amount=Decimal("180"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                        payment_method_id=PM_HDFC_UPI, description="Ride to office"),
            Transaction(id=TXN_NETFLIX, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 4, 15), amount=Decimal("649"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_NETFLIX,
                        description="Netflix Apr"),
            Transaction(id=TXN_SPOTIFY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 4, 20), amount=Decimal("119"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SPOTIFY,
                        description="Spotify Apr"),
            Transaction(id=TXN_PHARMACY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 10), amount=Decimal("540"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_PHARMACY,
                        payment_method_id=PM_HDFC_DEBIT, description="Monthly meds"),
            Transaction(id=TXN_AMAZON, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 3), amount=Decimal("1899"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_AMAZON,
                        description="USB hub"),
            Transaction(id=TXN_TRANSFER, user_id=USER_ID, type=TransactionType.transfer,
                        transacted_at=_dt(2026, 5, 2), amount=Decimal("10000"),
                        currency="INR", account_id=ACC_HDFC,
                        to_account_id=ACC_ICICI, to_amount=Decimal("10000"),
                        to_currency="INR", description="Top-up ICICI savings"),
            Transaction(id=TXN_WORK_MEAL, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 15), amount=Decimal("2400"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SWIGGY,
                        description="Team lunch — reimbursable"),
            Transaction(id=TXN_CC_PAYMENT, user_id=USER_ID, type=TransactionType.transfer,
                        transacted_at=_dt(2026, 5, 22), amount=Decimal("15000"),
                        currency="INR", account_id=ACC_HDFC,
                        to_account_id=ACC_CREDIT, to_amount=Decimal("15000"),
                        to_currency="INR", description="Credit card bill payment"),
            Transaction(id=TXN_GYM_APR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 4, 5), amount=Decimal("2500"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Gym membership Apr"),
            Transaction(id=TXN_GYM_MAY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 5), amount=Decimal("2500"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Gym membership May"),
            Transaction(id=TXN_PIG_LAPTOP_1, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 1), amount=Decimal("2500"),
                        currency="INR", account_id=ACC_HDFC,
                        description="Laptop fund — monthly save"),
            Transaction(id=TXN_PIG_TRIP_1, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 4, 1), amount=Decimal("10000"),
                        currency="INR", account_id=ACC_HDFC,
                        description="Goa trip fund — Apr"),
            Transaction(id=TXN_PIG_TRIP_2, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 1), amount=Decimal("8000"),
                        currency="INR", account_id=ACC_HDFC,
                        description="Goa trip fund — May"),
            Transaction(id=TXN_PIG_PHONE_1, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 3, 15), amount=Decimal("45000"),
                        currency="INR", account_id=ACC_HDFC,
                        description="New phone purchase"),

            # Scenario: Jan–Mar salary on HDFC (fills cashflow year view)
            Transaction(id=TXN_SALARY_JAN, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 1, 1), amount=Decimal("85000"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_EMPLOYER,
                        description="January salary"),
            Transaction(id=TXN_SALARY_FEB, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 2, 1), amount=Decimal("85000"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_EMPLOYER,
                        description="February salary"),
            Transaction(id=TXN_SALARY_MAR, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 3, 1), amount=Decimal("85000"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_EMPLOYER,
                        description="March salary"),

            # Scenario: monthly gym on HDFC Jan–Mar
            Transaction(id=TXN_GYM_JAN, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 1, 5), amount=Decimal("2500"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Gym membership Jan"),
            Transaction(id=TXN_GYM_FEB, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 2, 5), amount=Decimal("2500"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Gym membership Feb"),
            Transaction(id=TXN_GYM_MAR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 3, 5), amount=Decimal("2500"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Gym membership Mar"),

            # Scenario: monthly food on HDFC Jan–Mar
            Transaction(id=TXN_FOOD_JAN, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 1, 15), amount=Decimal("850"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_SWIGGY,
                        payment_method_id=PM_HDFC_UPI, description="Swiggy Jan"),
            Transaction(id=TXN_FOOD_FEB, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 2, 14), amount=Decimal("640"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_SWIGGY,
                        payment_method_id=PM_HDFC_UPI, description="Swiggy Feb"),
            Transaction(id=TXN_FOOD_MAR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 3, 10), amount=Decimal("720"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_SWIGGY,
                        payment_method_id=PM_HDFC_UPI, description="Swiggy Mar"),

            # Scenario: Netflix on Credit Card Jan–Mar
            Transaction(id=TXN_NETFLIX_JAN, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 1, 15), amount=Decimal("649"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_NETFLIX,
                        description="Netflix Jan"),
            Transaction(id=TXN_NETFLIX_FEB, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 2, 15), amount=Decimal("649"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_NETFLIX,
                        description="Netflix Feb"),
            Transaction(id=TXN_NETFLIX_MAR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 3, 15), amount=Decimal("649"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_NETFLIX,
                        description="Netflix Mar"),

            # Scenario: ICICI used for utility bills Jan–Mar
            Transaction(id=TXN_ICICI_JAN, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 1, 20), amount=Decimal("1800"),
                        currency="INR", account_id=ACC_ICICI,
                        description="Electricity bill Jan"),
            Transaction(id=TXN_ICICI_FEB, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 2, 20), amount=Decimal("1650"),
                        currency="INR", account_id=ACC_ICICI,
                        description="Electricity bill Feb"),
            Transaction(id=TXN_ICICI_MAR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 3, 20), amount=Decimal("1900"),
                        currency="INR", account_id=ACC_ICICI,
                        description="Electricity bill Mar"),

            # Scenario: cash wallet used in Jan and Feb
            Transaction(id=TXN_CASH_JAN, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 1, 10), amount=Decimal("350"),
                        currency="INR", account_id=ACC_CASH,
                        description="Auto fare Jan"),
            Transaction(id=TXN_CASH_FEB, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 2, 8), amount=Decimal("280"),
                        currency="INR", account_id=ACC_CASH,
                        description="Street food Feb"),

            # Scenario: transport budget — Uber rides Jan–Apr (varied amounts for realism)
            Transaction(id=TXN_UBER_JAN, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 1, 12), amount=Decimal("520"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                        payment_method_id=PM_HDFC_UPI, description="Uber Jan"),
            Transaction(id=TXN_UBER_FEB, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 2, 10), amount=Decimal("410"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                        payment_method_id=PM_HDFC_UPI, description="Uber Feb"),
            Transaction(id=TXN_UBER_MAR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 3, 8), amount=Decimal("680"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                        payment_method_id=PM_HDFC_UPI, description="Uber Mar"),
            Transaction(id=TXN_UBER_APR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 4, 14), amount=Decimal("1200"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_UBER,
                        payment_method_id=PM_HDFC_UPI, description="Uber Apr"),

            # Scenario: entertainment budget — Spotify Jan–Mar + May; Netflix May
            Transaction(id=TXN_SPOTIFY_JAN, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 1, 15), amount=Decimal("119"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SPOTIFY,
                        description="Spotify Jan"),
            Transaction(id=TXN_SPOTIFY_FEB, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 2, 15), amount=Decimal("119"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SPOTIFY,
                        description="Spotify Feb"),
            Transaction(id=TXN_SPOTIFY_MAR, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 3, 15), amount=Decimal("119"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SPOTIFY,
                        description="Spotify Mar"),
            Transaction(id=TXN_SPOTIFY_MAY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 15), amount=Decimal("119"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SPOTIFY,
                        description="Spotify May"),
            Transaction(id=TXN_NETFLIX_MAY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 15), amount=Decimal("649"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_NETFLIX,
                        description="Netflix May"),

            # Scenario: standalone May transactions (no split)
            Transaction(id=TXN_GROCERY_MAY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 9), amount=Decimal("1250"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Weekly groceries"),
            Transaction(id=TXN_PETROL_MAY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 16), amount=Decimal("2000"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Petrol"),
            Transaction(id=TXN_COFFEE_MAY, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 23), amount=Decimal("380"),
                        currency="INR", account_id=ACC_CASH, payee_id=PAYEE_SWIGGY,
                        description="Coffee & snacks"),

            # Scenario: split — Dinner at Taj (4-way, only my share counted → 25% settled)
            # Total ₹3600: me ₹900, Rahul ₹900 pending, Priya ₹900 pending, Neel ₹900 pending
            Transaction(id=TXN_SPLIT_DINNER, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 7), amount=Decimal("3600"),
                        currency="INR", account_id=ACC_CREDIT, payee_id=PAYEE_SWIGGY,
                        description="Dinner at Taj"),

            # Scenario: split — Weekend trip fuel (3-way, all payees settled → 100% settled)
            # Total ₹2400: me ₹800, Rahul ₹800 settled, Priya ₹800 settled
            Transaction(id=TXN_SPLIT_FUEL, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 14), amount=Decimal("2400"),
                        currency="INR", account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI,
                        description="Weekend trip fuel"),

            # Scenario: split — Movie + dinner (2-way, Neel settled → 50% settled)
            # Total ₹1800: me ₹900, Neel ₹900 settled
            Transaction(id=TXN_SPLIT_MOVIE, user_id=USER_ID, type=TransactionType.expense,
                        transacted_at=_dt(2026, 5, 21), amount=Decimal("1800"),
                        currency="INR", account_id=ACC_CREDIT,
                        description="Movie + dinner"),

            # Scenario: split share settlements (income received from friends)
            Transaction(id=TXN_SETTLE_FUEL_RAHUL, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 5, 16), amount=Decimal("800"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_RAHUL,
                        description="Rahul's share – fuel split"),
            Transaction(id=TXN_SETTLE_FUEL_PRIYA, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 5, 17), amount=Decimal("800"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_PRIYA,
                        description="Priya's share – fuel split"),
            Transaction(id=TXN_SETTLE_MOVIE_NEEL, user_id=USER_ID, type=TransactionType.income,
                        transacted_at=_dt(2026, 5, 22), amount=Decimal("900"),
                        currency="INR", account_id=ACC_HDFC, payee_id=PAYEE_NEEL,
                        description="Neel's share – movie + dinner"),
        ]
        for txn in txns:
            session.add(txn)
        await session.flush()

        # Transaction categories
        for txn_id, cat_id in [
            (TXN_SALARY_APR, CAT_SALARY), (TXN_SALARY_MAY, CAT_SALARY),
            (TXN_FOOD_1, CAT_FOOD), (TXN_FOOD_2, CAT_FOOD), (TXN_FOOD_3, CAT_FOOD),
            (TXN_UBER_1, CAT_TRANSPORT), (TXN_UBER_2, CAT_TRANSPORT),
            (TXN_NETFLIX, CAT_STREAMING), (TXN_SPOTIFY, CAT_STREAMING),
            (TXN_PHARMACY, CAT_HEALTH), (TXN_AMAZON, CAT_SHOPPING),
            (TXN_WORK_MEAL, CAT_FOOD),
            # Jan–Mar spread
            (TXN_SALARY_JAN, CAT_SALARY), (TXN_SALARY_FEB, CAT_SALARY), (TXN_SALARY_MAR, CAT_SALARY),
            (TXN_FOOD_JAN, CAT_FOOD), (TXN_FOOD_FEB, CAT_FOOD), (TXN_FOOD_MAR, CAT_FOOD),
            (TXN_NETFLIX_JAN, CAT_STREAMING), (TXN_NETFLIX_FEB, CAT_STREAMING), (TXN_NETFLIX_MAR, CAT_STREAMING),
            (TXN_ICICI_JAN, CAT_UTILITIES), (TXN_ICICI_FEB, CAT_UTILITIES), (TXN_ICICI_MAR, CAT_UTILITIES),
            # Budget-linked transport Jan–Apr
            (TXN_UBER_JAN, CAT_TRANSPORT), (TXN_UBER_FEB, CAT_TRANSPORT),
            (TXN_UBER_MAR, CAT_TRANSPORT), (TXN_UBER_APR, CAT_TRANSPORT),
            # Budget-linked entertainment Jan–May
            (TXN_SPOTIFY_JAN, CAT_STREAMING), (TXN_SPOTIFY_FEB, CAT_STREAMING),
            (TXN_SPOTIFY_MAR, CAT_STREAMING), (TXN_SPOTIFY_MAY, CAT_STREAMING),
            (TXN_NETFLIX_MAY, CAT_STREAMING),
        ]:
            await session.execute(
                transaction_categories.insert().values(transaction_id=txn_id, category_id=cat_id)
            )

        # Transaction tags
        for txn_id, tag_id in [
            (TXN_FOOD_2, TAG_WEEKEND),
            (TXN_WORK_MEAL, TAG_WORK), (TXN_WORK_MEAL, TAG_REIMBURS),
            (TXN_UBER_1, TAG_WORK),
        ]:
            await session.execute(
                transaction_tags.insert().values(transaction_id=txn_id, tag_id=tag_id)
            )

        # ── Budgets ───────────────────────────────────────────────────────────
        today = date.today()
        month_start = today.replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        # Scenario: ad-hoc budget for current month (activated at month start)
        session.add(Budget(id=BUD_FOOD_CURR, user_id=USER_ID, name="May Food Budget",
                           type=BudgetType.adhoc, amount=Decimal("5000"), currency="INR",
                           start_date=month_start, end_date=month_end,
                           activated_at=_dt(today.year, month_start.month, month_start.day),
                           notes="Includes dining out"))
        # Scenario: recurring monthly budget activated at start of year
        session.add(Budget(id=BUD_TRANSPORT, user_id=USER_ID, name="Transport (Monthly)",
                           type=BudgetType.recurring, amount=Decimal("3000"), currency="INR",
                           period=BudgetPeriod.monthly,
                           recurrence_rule="FREQ=MONTHLY;BYMONTHDAY=1",
                           activated_at=_dt(today.year, 1, 1)))
        session.add(Budget(id=BUD_ENTERTAIN, user_id=USER_ID, name="Entertainment",
                           type=BudgetType.recurring, amount=Decimal("2000"), currency="INR",
                           period=BudgetPeriod.monthly,
                           recurrence_rule="FREQ=MONTHLY;BYMONTHDAY=1",
                           activated_at=_dt(today.year, 1, 1)))
        await session.flush()

        for bud_id, cat_id in [
            (BUD_FOOD_CURR, CAT_FOOD), (BUD_TRANSPORT, CAT_TRANSPORT),
            (BUD_ENTERTAIN, CAT_ENTERTAIN), (BUD_ENTERTAIN, CAT_STREAMING),
        ]:
            await session.execute(
                budget_categories.insert().values(budget_id=bud_id, category_id=cat_id)
            )

        # Transaction-budget links: transport Jan–May, entertainment Jan–May
        for txn_id, bud_id in [
            # Transport budget — one Uber ride per month, varied amounts
            (TXN_UBER_JAN, BUD_TRANSPORT),   # Jan  520
            (TXN_UBER_FEB, BUD_TRANSPORT),   # Feb  410
            (TXN_UBER_MAR, BUD_TRANSPORT),   # Mar  680
            (TXN_UBER_APR, BUD_TRANSPORT),   # Apr 1200
            (TXN_UBER_1,   BUD_TRANSPORT),   # May  250
            (TXN_UBER_2,   BUD_TRANSPORT),   # May  180
            # Entertainment budget — Netflix + Spotify per month
            (TXN_NETFLIX_JAN, BUD_ENTERTAIN), (TXN_SPOTIFY_JAN, BUD_ENTERTAIN),   # Jan 768
            (TXN_NETFLIX_FEB, BUD_ENTERTAIN), (TXN_SPOTIFY_FEB, BUD_ENTERTAIN),   # Feb 768
            (TXN_NETFLIX_MAR, BUD_ENTERTAIN), (TXN_SPOTIFY_MAR, BUD_ENTERTAIN),   # Mar 768
            (TXN_NETFLIX,     BUD_ENTERTAIN), (TXN_SPOTIFY,     BUD_ENTERTAIN),   # Apr 768
            (TXN_NETFLIX_MAY, BUD_ENTERTAIN), (TXN_SPOTIFY_MAY, BUD_ENTERTAIN),   # May 768
        ]:
            await session.execute(
                transaction_budgets.insert().values(transaction_id=txn_id, budget_id=bud_id)
            )

        # ── Splits ────────────────────────────────────────────────────────────
        # Scenario: Dinner at Taj — 4-way, my share pending + 3 payees pending (ring 25%)
        # Total ₹3600: own ₹900, Rahul ₹900 pending, Priya ₹900 pending, Neel ₹900 pending
        session.add(Split(id=SPLIT_DINNER, user_id=USER_ID))
        session.add(SplitExpense(id=SPLIT_EXP_DINNER, split_id=SPLIT_DINNER,
                                 transaction_id=TXN_SPLIT_DINNER))
        session.add(SplitShare(id=SHARE_DINNER_OWN, split_id=SPLIT_DINNER,
                               payee_id=None, amount=Decimal("900"),
                               status=SplitShareStatus.pending,
                               forgiven_amount=Decimal("0")))
        session.add(SplitShare(id=SHARE_DINNER_RAHUL, split_id=SPLIT_DINNER,
                               payee_id=PAYEE_RAHUL, amount=Decimal("900"),
                               status=SplitShareStatus.pending,
                               forgiven_amount=Decimal("0")))
        session.add(SplitShare(id=SHARE_DINNER_PRIYA, split_id=SPLIT_DINNER,
                               payee_id=PAYEE_PRIYA, amount=Decimal("900"),
                               status=SplitShareStatus.pending,
                               forgiven_amount=Decimal("0")))
        session.add(SplitShare(id=SHARE_DINNER_NEEL, split_id=SPLIT_DINNER,
                               payee_id=PAYEE_NEEL, amount=Decimal("900"),
                               status=SplitShareStatus.pending,
                               forgiven_amount=Decimal("0")))

        # Scenario: Weekend trip fuel — 3-way, both payees settled + own pending (ring 67%)
        # Total ₹2400: own ₹800, Rahul ₹800 settled, Priya ₹800 settled
        session.add(Split(id=SPLIT_FUEL, user_id=USER_ID))
        session.add(SplitExpense(id=SPLIT_EXP_FUEL, split_id=SPLIT_FUEL,
                                 transaction_id=TXN_SPLIT_FUEL))
        session.add(SplitShare(id=SHARE_FUEL_OWN, split_id=SPLIT_FUEL,
                               payee_id=None, amount=Decimal("800"),
                               status=SplitShareStatus.pending,
                               forgiven_amount=Decimal("0")))
        session.add(SplitShare(id=SHARE_FUEL_RAHUL, split_id=SPLIT_FUEL,
                               payee_id=PAYEE_RAHUL, amount=Decimal("800"),
                               status=SplitShareStatus.settled,
                               forgiven_amount=Decimal("0")))
        session.add(SplitShare(id=SHARE_FUEL_PRIYA, split_id=SPLIT_FUEL,
                               payee_id=PAYEE_PRIYA, amount=Decimal("800"),
                               status=SplitShareStatus.settled,
                               forgiven_amount=Decimal("0")))

        # Scenario: Movie + dinner — 2-way, Neel settled + own pending (ring 50%)
        # Total ₹1800: own ₹900, Neel ₹900 settled
        session.add(Split(id=SPLIT_MOVIE, user_id=USER_ID))
        session.add(SplitExpense(id=SPLIT_EXP_MOVIE, split_id=SPLIT_MOVIE,
                                 transaction_id=TXN_SPLIT_MOVIE))
        session.add(SplitShare(id=SHARE_MOVIE_OWN, split_id=SPLIT_MOVIE,
                               payee_id=None, amount=Decimal("900"),
                               status=SplitShareStatus.pending,
                               forgiven_amount=Decimal("0")))
        session.add(SplitShare(id=SHARE_MOVIE_NEEL, split_id=SPLIT_MOVIE,
                               payee_id=PAYEE_NEEL, amount=Decimal("900"),
                               status=SplitShareStatus.settled,
                               forgiven_amount=Decimal("0")))
        await session.flush()

        # Settlement links — income transactions linked to settled shares
        for sid, share_id, txn_id, amount in [
            (SETTLEMENT_FUEL_RAHUL, SHARE_FUEL_RAHUL,  TXN_SETTLE_FUEL_RAHUL, Decimal("800")),
            (SETTLEMENT_FUEL_PRIYA, SHARE_FUEL_PRIYA,  TXN_SETTLE_FUEL_PRIYA, Decimal("800")),
            (SETTLEMENT_MOVIE_NEEL, SHARE_MOVIE_NEEL,  TXN_SETTLE_MOVIE_NEEL, Decimal("900")),
        ]:
            session.add(SplitShareSettlement(id=sid, share_id=share_id,
                                             transaction_id=txn_id, amount=amount))
        await session.flush()

        # ── Subscriptions ─────────────────────────────────────────────────────
        due_soon_day = (today + timedelta(days=2)).day
        one_month_ago = datetime(today.year, today.month, today.day, tzinfo=UTC) - timedelta(days=32)

        session.add(Subscription(id=SUB_NETFLIX, user_id=USER_ID, name="Netflix",
                                 amount=Decimal("649"), currency="INR",
                                 billing_cycle=BillingCycle.monthly, billing_day=15,
                                 account_id=ACC_CREDIT,
                                 category_id=CAT_STREAMING, url="https://netflix.com"))
        session.add(Subscription(id=SUB_SPOTIFY, user_id=USER_ID, name="Spotify",
                                 amount=Decimal("119"), currency="INR",
                                 billing_cycle=BillingCycle.monthly, billing_day=due_soon_day,
                                 account_id=ACC_CREDIT,
                                 category_id=CAT_STREAMING))
        session.add(Subscription(id=SUB_CLOUD, user_id=USER_ID, name="AWS S3 (Personal)",
                                 amount=Decimal("350"), currency="INR",
                                 billing_cycle=BillingCycle.monthly, billing_day=1,
                                 last_billed_at=one_month_ago,
                                 account_id=ACC_HDFC, notes="Object storage for backups"))
        session.add(Subscription(id=SUB_GYM, user_id=USER_ID, name="Gym Membership",
                                 amount=Decimal("2500"), currency="INR",
                                 billing_cycle=BillingCycle.monthly, billing_day=5,
                                 account_id=ACC_HDFC, payment_method_id=PM_HDFC_UPI))
        await session.flush()

        # Link gym transactions to the gym subscription
        for txn_id in [TXN_GYM_APR, TXN_GYM_MAY]:
            await session.execute(
                sa.update(Transaction)
                .where(Transaction.id == txn_id)
                .values(subscription_id=SUB_GYM)
            )

        # ── Piggy banks ───────────────────────────────────────────────────────
        session.add(PiggyBank(id=PIG_LAPTOP, user_id=USER_ID, name="New Laptop",
                              target_amount=Decimal("50000"), currency="INR",
                              current_amount=Decimal("2500"),
                              target_date=today + timedelta(days=300),
                              notes="Saving for a MacBook"))
        session.add(PiggyBank(id=PIG_TRIP, user_id=USER_ID, name="Goa Trip",
                              target_amount=Decimal("30000"), currency="INR",
                              current_amount=Decimal("18000"),
                              target_date=today + timedelta(days=90)))
        session.add(PiggyBank(id=PIG_PHONE, user_id=USER_ID, name="New Phone",
                              target_amount=Decimal("45000"), currency="INR",
                              current_amount=Decimal("45000"), is_completed=True))
        await session.flush()

        for contrib in [
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
        ]:
            session.add(contrib)

        await session.commit()
        print("✓ Dev seed data loaded")
