"""Model-level tests for Transaction and its join tables."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.account import Account
from app.models.category import Category
from app.models.tag import Tag
from app.models.transaction import (
    Transaction,
    TransactionType,
    transaction_categories,
    transaction_tags,
)
from app.models.user import User
from app.models.user_settings import UserSettings


async def _make_user(session, email: str = "u@example.com") -> User:
    user = User(id=uuid.uuid4(), email=email, password_hash="x")
    session.add(user)
    await session.flush()
    session.add(UserSettings(user_id=user.id))
    await session.flush()
    return user


async def _make_account(session, user_id: uuid.UUID, name: str = "Bank") -> Account:
    acc = Account(id=uuid.uuid4(), user_id=user_id, name=name, type="bank", currency="INR")
    session.add(acc)
    await session.flush()
    return acc


def _txn(user_id, account_id, *, type=TransactionType.expense, amount="500.00", **kw) -> Transaction:
    return Transaction(
        id=uuid.uuid4(),
        user_id=user_id,
        type=type,
        transacted_at=datetime.now(UTC),
        amount=Decimal(amount),
        currency="INR",
        account_id=account_id,
        **kw,
    )


async def test_create_expense(db_session) -> None:
    user = await _make_user(db_session)
    acc = await _make_account(db_session, user.id)
    txn = _txn(user.id, acc.id, description="Coffee")
    db_session.add(txn)
    await db_session.commit()

    row = (await db_session.execute(select(Transaction).where(Transaction.id == txn.id))).scalar_one()
    assert row.type == TransactionType.expense
    assert row.amount == Decimal("500.00")
    assert row.to_account_id is None
    assert row.deleted_at is None


async def test_create_income(db_session) -> None:
    user = await _make_user(db_session, "income@example.com")
    acc = await _make_account(db_session, user.id)
    txn = _txn(user.id, acc.id, type=TransactionType.income, amount="10000.00")
    db_session.add(txn)
    await db_session.commit()
    row = (await db_session.execute(select(Transaction).where(Transaction.id == txn.id))).scalar_one()
    assert row.type == TransactionType.income


async def test_create_transfer(db_session) -> None:
    user = await _make_user(db_session, "transfer@example.com")
    acc = await _make_account(db_session, user.id, "Source")
    acc2 = await _make_account(db_session, user.id, "Dest")
    txn = _txn(user.id, acc.id, type=TransactionType.transfer, amount="200.00", to_account_id=acc2.id)
    db_session.add(txn)
    await db_session.commit()
    row = (await db_session.execute(select(Transaction).where(Transaction.id == txn.id))).scalar_one()
    assert row.to_account_id == acc2.id


async def test_transfer_without_to_account_fails(db_session) -> None:
    user = await _make_user(db_session, "fail1@example.com")
    acc = await _make_account(db_session, user.id)
    txn = _txn(user.id, acc.id, type=TransactionType.transfer)  # no to_account_id
    db_session.add(txn)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


async def test_non_transfer_with_to_account_fails(db_session) -> None:
    user = await _make_user(db_session, "fail2@example.com")
    acc = await _make_account(db_session, user.id, "A")
    acc2 = await _make_account(db_session, user.id, "B")
    txn = _txn(user.id, acc.id, to_account_id=acc2.id)  # expense with to_account_id
    db_session.add(txn)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


async def test_zero_amount_fails(db_session) -> None:
    user = await _make_user(db_session, "fail3@example.com")
    acc = await _make_account(db_session, user.id)
    txn = _txn(user.id, acc.id, amount="0.00")
    db_session.add(txn)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


async def test_transaction_with_categories(db_session) -> None:
    user = await _make_user(db_session, "cat@example.com")
    acc = await _make_account(db_session, user.id)
    cat = Category(id=uuid.uuid4(), user_id=user.id, name="Food")
    db_session.add(cat)
    await db_session.flush()

    txn = _txn(user.id, acc.id)
    db_session.add(txn)
    await db_session.flush()

    await db_session.execute(
        transaction_categories.insert().values(transaction_id=txn.id, category_id=cat.id)
    )
    await db_session.commit()

    rows = (
        await db_session.execute(
            select(transaction_categories).where(transaction_categories.c.transaction_id == txn.id)
        )
    ).fetchall()
    assert len(rows) == 1
    assert rows[0].category_id == cat.id


async def test_transaction_with_tags(db_session) -> None:
    user = await _make_user(db_session, "tag@example.com")
    acc = await _make_account(db_session, user.id)
    tag = Tag(id=uuid.uuid4(), user_id=user.id, name="weekend")
    db_session.add(tag)
    await db_session.flush()

    txn = _txn(user.id, acc.id)
    db_session.add(txn)
    await db_session.flush()

    await db_session.execute(
        transaction_tags.insert().values(transaction_id=txn.id, tag_id=tag.id)
    )
    await db_session.commit()

    rows = (
        await db_session.execute(
            select(transaction_tags).where(transaction_tags.c.transaction_id == txn.id)
        )
    ).fetchall()
    assert len(rows) == 1
    assert rows[0].tag_id == tag.id


async def test_soft_delete(db_session) -> None:
    user = await _make_user(db_session, "sd@example.com")
    acc = await _make_account(db_session, user.id)
    txn = _txn(user.id, acc.id, amount="50.00")
    db_session.add(txn)
    await db_session.commit()

    txn.deleted_at = datetime.now(UTC)
    await db_session.commit()
    row = (await db_session.execute(select(Transaction).where(Transaction.id == txn.id))).scalar_one()
    assert row.deleted_at is not None
