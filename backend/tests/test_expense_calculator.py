"""Tests for net_expense() per FR-7.9."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.split import Split, SplitShare, SplitShareStatus
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.models.user_settings import UserSettings
from app.services.expense_calculator import net_expense


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _make_user(session: AsyncSession, email: str = "u@example.com") -> User:
    user = User(id=uuid.uuid4(), email=email, password_hash="x")
    session.add(user)
    await session.flush()
    session.add(UserSettings(user_id=user.id))
    await session.flush()
    return user


async def _make_account(session: AsyncSession, user_id: uuid.UUID) -> Account:
    acc = Account(id=uuid.uuid4(), user_id=user_id, name="Bank", type="bank", currency="INR")
    session.add(acc)
    await session.flush()
    return acc


async def _make_expense(session: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID, amount: str) -> Transaction:
    txn = Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        type=TransactionType.expense,
        transacted_at=datetime.now(UTC),
        amount=Decimal(amount),
        currency="INR",
        account_id=account_id,
    )
    session.add(txn)
    await session.flush()
    return txn


async def _make_split_with_shares(
    session: AsyncSession,
    user_id: uuid.UUID,
    txn: Transaction,
    shares: list[tuple[str, SplitShareStatus, uuid.UUID | None]],
) -> Split:
    """shares: list of (amount, status, payee_id)"""
    split = Split(id=uuid.uuid4(), user_id=user_id, expense_transaction_id=txn.id)
    session.add(split)
    await session.flush()
    now = datetime.now(UTC)
    for amount, status, payee_id in shares:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=payee_id,
            amount=Decimal(amount),
            status=status,
            settled_at=now if status == SplitShareStatus.settled else None,
            forgiven_at=now if status == SplitShareStatus.forgiven else None,
        )
        session.add(share)
    await session.commit()
    return split


# ── Tests ──────────────────────────────────────────────────────────────────────

async def test_non_split_expense_returns_full_amount(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "500.00")
    await db_session.commit()

    result = await net_expense(db_session, txn.id)
    assert result == Decimal("500.00")


async def test_split_user_own_share_only(db_session: AsyncSession) -> None:
    """User's portion pending, friend's portion pending → net = user own."""
    user = await _make_user(db_session, "own@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    friend_id = uuid.uuid4()

    # user own = 100 (payee_id=None), friend pending = 200 (payee_id=friend)
    await _make_split_with_shares(db_session, user.id, txn, [
        ("100.00", SplitShareStatus.pending, None),
        ("200.00", SplitShareStatus.pending, friend_id),
    ])

    result = await net_expense(db_session, txn.id)
    assert result == Decimal("100.00")


async def test_split_with_forgiven_shares(db_session: AsyncSession) -> None:
    """User own + forgiven = net expense (FR-7.9)."""
    user = await _make_user(db_session, "forgiven@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    friend_id = uuid.uuid4()

    # user own = 100, forgiven = 150, friend settled = 50
    await _make_split_with_shares(db_session, user.id, txn, [
        ("100.00", SplitShareStatus.pending, None),
        ("150.00", SplitShareStatus.forgiven, friend_id),
        ("50.00", SplitShareStatus.settled, friend_id),
    ])

    result = await net_expense(db_session, txn.id)
    assert result == Decimal("250.00")  # 100 + 150


async def test_split_settled_shares_excluded(db_session: AsyncSession) -> None:
    """Settled shares (received money) are excluded from net expense."""
    user = await _make_user(db_session, "settled@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    friend_id = uuid.uuid4()

    # user own = 100, friend settled = 200
    await _make_split_with_shares(db_session, user.id, txn, [
        ("100.00", SplitShareStatus.pending, None),
        ("200.00", SplitShareStatus.settled, friend_id),
    ])

    result = await net_expense(db_session, txn.id)
    assert result == Decimal("100.00")


async def test_split_all_forgiven_no_own_share(db_session: AsyncSession) -> None:
    """All forgiven, no user own share → net = total forgiven."""
    user = await _make_user(db_session, "allforgiven@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    friend_id = uuid.uuid4()

    # The entire expense was split with a friend who couldn't pay, user forgave all
    # user own = 0, forgiven = 300
    await _make_split_with_shares(db_session, user.id, txn, [
        ("300.00", SplitShareStatus.forgiven, friend_id),
    ])

    result = await net_expense(db_session, txn.id)
    assert result == Decimal("300.00")


async def test_split_fully_settled_net_is_own_only(db_session: AsyncSession) -> None:
    """Friend paid back everything beyond user's own share."""
    user = await _make_user(db_session, "fullsettle@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    friend_id = uuid.uuid4()

    await _make_split_with_shares(db_session, user.id, txn, [
        ("100.00", SplitShareStatus.pending, None),
        ("200.00", SplitShareStatus.settled, friend_id),
    ])

    result = await net_expense(db_session, txn.id)
    assert result == Decimal("100.00")


async def test_net_expense_missing_txn_raises(db_session: AsyncSession) -> None:
    with pytest.raises(ValueError, match="not found"):
        await net_expense(db_session, uuid.uuid4())
