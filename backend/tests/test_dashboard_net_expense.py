"""Tests asserting FR-7.9 / FR-7.10 net-expense logic in the dashboard.

Covers:
- Split expense contributes only net share (own + forgiven) to total_spent_net
- Settlement income transactions are excluded from total_income
- pending_splits_from_others reflects outstanding balances in the period
- Category breakdown uses net amounts, not gross
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.category import Category
from app.models.payee import Payee, PayeeType
from app.models.split import Split, SplitExpense, SplitShare, SplitShareSettlement, SplitShareStatus
from app.models.transaction import Transaction, TransactionType, transaction_categories
from app.models.user import User
from app.models.user_settings import UserSettings
from app.routers.dashboard import _monthly_totals, _category_breakdown, _pending_splits_from_others_total

# ── Fixtures / helpers ────────────────────────────────────────────────────────

_NOW = datetime(2026, 6, 3, 12, 0, 0, tzinfo=UTC)
_START = datetime(2026, 6, 1, tzinfo=UTC)
_END = datetime(2026, 7, 1, tzinfo=UTC)


async def _user(session: AsyncSession, email: str) -> User:
    u = User(id=uuid.uuid4(), email=email, password_hash="x")
    session.add(u)
    await session.flush()
    session.add(UserSettings(user_id=u.id))
    await session.flush()
    return u


async def _account(session: AsyncSession, user_id: uuid.UUID) -> Account:
    acc = Account(id=uuid.uuid4(), user_id=user_id, name="Bank", type="bank", currency="INR")
    session.add(acc)
    await session.flush()
    return acc


async def _payee(session: AsyncSession, user_id: uuid.UUID) -> Payee:
    p = Payee(id=uuid.uuid4(), user_id=user_id, name="Friend", type=PayeeType.person)
    session.add(p)
    await session.flush()
    return p


async def _expense(
    session: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID, amount: str
) -> Transaction:
    txn = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        type=TransactionType.expense,
        transacted_at=_NOW,
        amount=Decimal(amount),
        currency="INR",
        account_id=account_id,
    )
    session.add(txn)
    await session.flush()
    return txn


async def _income(
    session: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID, amount: str
) -> Transaction:
    txn = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        type=TransactionType.income,
        transacted_at=_NOW,
        amount=Decimal(amount),
        currency="INR",
        account_id=account_id,
    )
    session.add(txn)
    await session.flush()
    return txn


async def _split(
    session: AsyncSession,
    user_id: uuid.UUID,
    txn: Transaction,
    shares: list[tuple[str, SplitShareStatus, uuid.UUID | None, str]],
) -> list[SplitShare]:
    """shares: (amount, status, payee_id, forgiven_amount)"""
    sp = Split(id=uuid.uuid4(), user_id=user_id)
    session.add(sp)
    await session.flush()
    session.add(SplitExpense(split_id=sp.id, transaction_id=txn.id))
    await session.flush()
    result = []
    for amount, status, payee_id, forgiven in shares:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=sp.id,
            payee_id=payee_id,
            amount=Decimal(amount),
            status=status,
            forgiven_amount=Decimal(forgiven),
        )
        session.add(share)
        result.append(share)
    await session.flush()
    return result


# ── Tests: _monthly_totals ────────────────────────────────────────────────────

async def test_split_expense_uses_net_share(db_session: AsyncSession) -> None:
    """₹3000 dinner split 3 ways: user's ₹1000 own share + ₹500 forgiven share = ₹1500 net."""
    user = await _user(db_session, "net1@example.com")
    acc = await _account(db_session, user.id)
    friend = await _payee(db_session, user.id)

    txn = await _expense(db_session, user.id, acc.id, "3000.00")
    await _split(db_session, user.id, txn, [
        ("1000.00", SplitShareStatus.pending, None, "0.00"),       # user's own
        ("500.00",  SplitShareStatus.forgiven, friend.id, "0.00"), # fully forgiven
        ("1500.00", SplitShareStatus.pending, friend.id, "0.00"),  # pending (excluded)
    ])
    await db_session.commit()

    spent, income = await _monthly_totals(db_session, user.id, _START, _END)
    assert spent == Decimal("1500.00")  # 1000 own + 500 forgiven
    assert income == Decimal("0.00")


async def test_non_split_expense_counted_in_full(db_session: AsyncSession) -> None:
    user = await _user(db_session, "net2@example.com")
    acc = await _account(db_session, user.id)

    await _expense(db_session, user.id, acc.id, "800.00")
    await db_session.commit()

    spent, _ = await _monthly_totals(db_session, user.id, _START, _END)
    assert spent == Decimal("800.00")


async def test_partial_forgiveness_counted_in_net(db_session: AsyncSession) -> None:
    """Partially forgiven share: only forgiven_amount portion is absorbed."""
    user = await _user(db_session, "net3@example.com")
    acc = await _account(db_session, user.id)
    friend = await _payee(db_session, user.id)

    txn = await _expense(db_session, user.id, acc.id, "2000.00")
    # own=800, friend pending=1200 but 300 is forgiven → net = 800 + 300 = 1100
    await _split(db_session, user.id, txn, [
        ("800.00",  SplitShareStatus.pending, None, "0.00"),
        ("1200.00", SplitShareStatus.pending, friend.id, "300.00"),
    ])
    await db_session.commit()

    spent, _ = await _monthly_totals(db_session, user.id, _START, _END)
    assert spent == Decimal("1100.00")


async def test_settlement_income_excluded_from_total(db_session: AsyncSession) -> None:
    """Income linked in split_share_settlements is not counted as real income (FR-7.10)."""
    user = await _user(db_session, "net4@example.com")
    acc = await _account(db_session, user.id)
    friend = await _payee(db_session, user.id)

    txn = await _expense(db_session, user.id, acc.id, "1000.00")
    shares = await _split(db_session, user.id, txn, [
        ("500.00", SplitShareStatus.settled, None, "0.00"),
        ("500.00", SplitShareStatus.settled, friend.id, "0.00"),
    ])
    friend_share = shares[1]

    # Real income: salary
    await _income(db_session, user.id, acc.id, "5000.00")

    # Settlement income: friend repays their split share
    settlement_txn = await _income(db_session, user.id, acc.id, "500.00")
    db_session.add(SplitShareSettlement(
        share_id=friend_share.id,
        transaction_id=settlement_txn.id,
        amount=Decimal("500.00"),
    ))
    await db_session.commit()

    _, income = await _monthly_totals(db_session, user.id, _START, _END)
    assert income == Decimal("5000.00")  # settlement excluded


# ── Tests: _pending_splits_from_others_total ──────────────────────────────────

async def test_pending_splits_from_others(db_session: AsyncSession) -> None:
    """Outstanding = share.amount - forgiven - already settled."""
    user = await _user(db_session, "net5@example.com")
    acc = await _account(db_session, user.id)
    friend = await _payee(db_session, user.id)

    txn = await _expense(db_session, user.id, acc.id, "3000.00")
    shares = await _split(db_session, user.id, txn, [
        ("1000.00", SplitShareStatus.pending, None, "0.00"),
        ("2000.00", SplitShareStatus.pending, friend.id, "200.00"),  # 200 forgiven
    ])
    friend_share = shares[1]

    # Friend partially settles ₹500
    settlement_txn = await _income(db_session, user.id, acc.id, "500.00")
    db_session.add(SplitShareSettlement(
        share_id=friend_share.id,
        transaction_id=settlement_txn.id,
        amount=Decimal("500.00"),
    ))
    await db_session.commit()

    # pending = 2000 - 200 (forgiven) - 500 (paid) = 1300
    pending = await _pending_splits_from_others_total(db_session, user.id, _START, _END)
    assert pending == Decimal("1300.00")


async def test_pending_splits_outside_period_excluded(db_session: AsyncSession) -> None:
    user = await _user(db_session, "net6@example.com")
    acc = await _account(db_session, user.id)
    friend = await _payee(db_session, user.id)

    # Transaction in May (outside June period)
    old_txn = Transaction(
        id=uuid.uuid4(),
        user_id=user.id,
        type=TransactionType.expense,
        transacted_at=datetime(2026, 5, 15, tzinfo=UTC),
        amount=Decimal("1000.00"),
        currency="INR",
        account_id=acc.id,
    )
    db_session.add(old_txn)
    await db_session.flush()
    await _split(db_session, user.id, old_txn, [
        ("500.00", SplitShareStatus.pending, None, "0.00"),
        ("500.00", SplitShareStatus.pending, friend.id, "0.00"),
    ])
    await db_session.commit()

    pending = await _pending_splits_from_others_total(db_session, user.id, _START, _END)
    assert pending == Decimal("0.00")


# ── Tests: _category_breakdown ────────────────────────────────────────────────

async def test_category_breakdown_uses_net_amount(db_session: AsyncSession) -> None:
    """Category gets net share, not full transaction amount."""
    user = await _user(db_session, "net7@example.com")
    acc = await _account(db_session, user.id)
    friend = await _payee(db_session, user.id)

    cat = Category(id=uuid.uuid4(), user_id=user.id, name="Food", applicability="expense")
    db_session.add(cat)
    await db_session.flush()

    txn = await _expense(db_session, user.id, acc.id, "4000.00")
    # own=1000, friend pending=3000 → net to category = 1000
    await _split(db_session, user.id, txn, [
        ("1000.00", SplitShareStatus.pending, None, "0.00"),
        ("3000.00", SplitShareStatus.pending, friend.id, "0.00"),
    ])

    # Link transaction to category
    await db_session.execute(
        transaction_categories.insert().values(transaction_id=txn.id, category_id=cat.id)
    )
    await db_session.commit()

    spent, _ = await _monthly_totals(db_session, user.id, _START, _END)
    cats = await _category_breakdown(db_session, user.id, _START, _END, spent)

    assert len(cats) == 1
    assert cats[0].name == "Food"
    assert cats[0].amount == Decimal("1000.00")  # not 4000
