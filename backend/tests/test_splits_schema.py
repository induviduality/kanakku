"""Schema and invariant tests for Split, SplitExpense, and SplitShare."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.models.account import Account
from app.models.split import Split, SplitExpense, SplitShare, SplitShareStatus
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.models.user_settings import UserSettings
from app.services.split_service import SplitInvariantError, validate_invariant

# ---------------------------------------------------------------------------
# Trigger SQL (updated to use split_expenses)
# ---------------------------------------------------------------------------

_TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION check_split_invariant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_split_id UUID;
    v_expected_amount NUMERIC(15,2);
    v_actual_amount   NUMERIC(15,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_split_id := OLD.split_id;
    ELSE
        v_split_id := NEW.split_id;
    END IF;

    SELECT COALESCE(SUM(t.amount), 0) INTO v_expected_amount
    FROM split_expenses se
    JOIN transactions t ON t.id = se.transaction_id
    WHERE se.split_id = v_split_id;

    IF v_expected_amount = 0 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_actual_amount
    FROM split_shares
    WHERE split_id = v_split_id;

    IF v_actual_amount != v_expected_amount THEN
        RAISE EXCEPTION 'Split invariant violated: shares sum % != expenses sum %',
            v_actual_amount, v_expected_amount;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;
"""

_TRIGGER_SQL = """
CREATE CONSTRAINT TRIGGER trg_split_invariant
AFTER INSERT OR UPDATE OR DELETE ON split_shares
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_split_invariant();
"""


@pytest.fixture
async def db_session_with_trigger(
    db_engine: AsyncEngine, db_tables: None
) -> AsyncSession:
    """Session with the split invariant DB trigger installed."""
    async with db_engine.begin() as conn:
        await conn.execute(text(_TRIGGER_FUNCTION_SQL))
        await conn.execute(text(_TRIGGER_SQL))

    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    async with db_engine.begin() as conn:
        await conn.execute(text("DROP FUNCTION IF EXISTS check_split_invariant() CASCADE"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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


async def _make_expense(
    session: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID, amount: str = "300.00"
) -> Transaction:
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


async def _make_split(
    session: AsyncSession, user_id: uuid.UUID, *txn_ids: uuid.UUID
) -> Split:
    """Create a Split and link one or more expense transactions via split_expenses."""
    split = Split(id=uuid.uuid4(), user_id=user_id)
    session.add(split)
    await session.flush()
    for txn_id in txn_ids:
        session.add(SplitExpense(id=uuid.uuid4(), split_id=split.id, transaction_id=txn_id))
    await session.flush()
    return split


def _share(split_id: uuid.UUID, amount: str, status: SplitShareStatus = SplitShareStatus.pending) -> SplitShare:
    return SplitShare(
        id=uuid.uuid4(),
        split_id=split_id,
        amount=Decimal(amount),
        status=status,
    )


# ---------------------------------------------------------------------------
# Model-level tests
# ---------------------------------------------------------------------------


async def test_split_created(db_session: AsyncSession) -> None:
    user = await _make_user(db_session)
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id)
    split = await _make_split(db_session, user.id, txn.id)
    await db_session.commit()

    row = (await db_session.execute(select(Split).where(Split.id == split.id))).scalar_one()
    assert row.deleted_at is None

    # Verify the split_expenses row was created
    exp_row = (
        await db_session.execute(
            select(SplitExpense).where(SplitExpense.split_id == split.id)
        )
    ).scalar_one()
    assert exp_row.transaction_id == txn.id


async def test_split_multi_expense(db_session: AsyncSession) -> None:
    """A split can reference multiple expense transactions."""
    user = await _make_user(db_session, "multi@example.com")
    acc = await _make_account(db_session, user.id)
    txn1 = await _make_expense(db_session, user.id, acc.id, "100.00")
    txn2 = await _make_expense(db_session, user.id, acc.id, "200.00")
    split = await _make_split(db_session, user.id, txn1.id, txn2.id)
    await db_session.commit()

    rows = (
        await db_session.execute(
            select(SplitExpense).where(SplitExpense.split_id == split.id)
        )
    ).scalars().all()
    assert {r.transaction_id for r in rows} == {txn1.id, txn2.id}


async def test_split_expense_transaction_unique(db_session: AsyncSession) -> None:
    """One transaction can only be linked to one split."""
    user = await _make_user(db_session, "uniq@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id)

    split1 = Split(id=uuid.uuid4(), user_id=user.id)
    db_session.add(split1)
    await db_session.flush()
    db_session.add(SplitExpense(id=uuid.uuid4(), split_id=split1.id, transaction_id=txn.id))
    await db_session.flush()

    split2 = Split(id=uuid.uuid4(), user_id=user.id)
    db_session.add(split2)
    await db_session.flush()
    db_session.add(SplitExpense(id=uuid.uuid4(), split_id=split2.id, transaction_id=txn.id))
    with pytest.raises(IntegrityError):
        await db_session.flush()
    await db_session.rollback()


async def test_split_share_statuses(db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "status@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "100.00")
    split = await _make_split(db_session, user.id, txn.id)

    for status in SplitShareStatus:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            amount=Decimal("100.00"),
            status=status,
        )
        db_session.add(share)
        await db_session.flush()
        db_session.expunge(share)


# ---------------------------------------------------------------------------
# Application-level validator tests
# ---------------------------------------------------------------------------


async def test_validate_invariant_ok(db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "v_ok@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    split = await _make_split(db_session, user.id, txn.id)

    db_session.add(_share(split.id, "200.00"))
    db_session.add(_share(split.id, "100.00"))
    await db_session.commit()

    await validate_invariant(db_session, split.id)


async def test_validate_invariant_multi_expense(db_session: AsyncSession) -> None:
    """validate_invariant sums across multiple expense transactions."""
    user = await _make_user(db_session, "v_multi@example.com")
    acc = await _make_account(db_session, user.id)
    txn1 = await _make_expense(db_session, user.id, acc.id, "200.00")
    txn2 = await _make_expense(db_session, user.id, acc.id, "100.00")
    split = await _make_split(db_session, user.id, txn1.id, txn2.id)

    db_session.add(_share(split.id, "150.00"))
    db_session.add(_share(split.id, "150.00"))
    await db_session.commit()

    await validate_invariant(db_session, split.id)


async def test_validate_invariant_mismatch(db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "v_bad@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    split = await _make_split(db_session, user.id, txn.id)

    db_session.add(_share(split.id, "200.00"))
    await db_session.commit()

    with pytest.raises(SplitInvariantError, match="does not match"):
        await validate_invariant(db_session, split.id)


async def test_validate_invariant_duplicate_payee(db_session: AsyncSession) -> None:
    """validate_invariant catches duplicate named payees."""
    import uuid as uuid_mod
    from app.models.payee import Payee, PayeeType

    user = await _make_user(db_session, "v_dup@example.com")
    acc = await _make_account(db_session, user.id)
    txn = await _make_expense(db_session, user.id, acc.id, "300.00")
    split = await _make_split(db_session, user.id, txn.id)

    payee = Payee(id=uuid.uuid4(), user_id=user.id, name="Alice", type=PayeeType.person)
    db_session.add(payee)
    await db_session.flush()

    db_session.add(SplitShare(id=uuid.uuid4(), split_id=split.id,
                              payee_id=payee.id, amount=Decimal("150.00"),
                              status=SplitShareStatus.pending))
    db_session.add(SplitShare(id=uuid.uuid4(), split_id=split.id,
                              payee_id=payee.id, amount=Decimal("150.00"),
                              status=SplitShareStatus.pending))
    await db_session.flush()

    with pytest.raises(SplitInvariantError, match="[Dd]uplicate"):
        await validate_invariant(db_session, split.id)


# ---------------------------------------------------------------------------
# DB trigger tests
# ---------------------------------------------------------------------------


async def test_trigger_sum_matches_ok(db_session_with_trigger: AsyncSession) -> None:
    session = db_session_with_trigger
    user = await _make_user(session, "trig_ok@example.com")
    acc = await _make_account(session, user.id)
    txn = await _make_expense(session, user.id, acc.id, "300.00")
    split = await _make_split(session, user.id, txn.id)

    session.add(_share(split.id, "200.00"))
    session.add(_share(split.id, "100.00"))
    await session.commit()


async def test_trigger_sum_mismatch_raises(db_session_with_trigger: AsyncSession) -> None:
    session = db_session_with_trigger
    user = await _make_user(session, "trig_bad@example.com")
    acc = await _make_account(session, user.id)
    txn = await _make_expense(session, user.id, acc.id, "300.00")
    split = await _make_split(session, user.id, txn.id)

    session.add(_share(split.id, "200.00"))
    with pytest.raises(DBAPIError, match="Split invariant violated"):
        await session.commit()
    await session.rollback()


async def test_trigger_update_breaking_sum_raises(db_session_with_trigger: AsyncSession) -> None:
    session = db_session_with_trigger
    user = await _make_user(session, "trig_upd@example.com")
    acc = await _make_account(session, user.id)
    txn = await _make_expense(session, user.id, acc.id, "300.00")
    split = await _make_split(session, user.id, txn.id)

    share1 = _share(split.id, "200.00")
    share2 = _share(split.id, "100.00")
    session.add(share1)
    session.add(share2)
    await session.commit()

    row = (await session.execute(select(SplitShare).where(SplitShare.id == share1.id))).scalar_one()
    row.amount = Decimal("250.00")
    with pytest.raises(DBAPIError, match="Split invariant violated"):
        await session.commit()
    await session.rollback()


async def test_trigger_delete_breaking_sum_raises(db_session_with_trigger: AsyncSession) -> None:
    session = db_session_with_trigger
    user = await _make_user(session, "trig_del@example.com")
    acc = await _make_account(session, user.id)
    txn = await _make_expense(session, user.id, acc.id, "300.00")
    split = await _make_split(session, user.id, txn.id)

    share1 = _share(split.id, "200.00")
    share2 = _share(split.id, "100.00")
    session.add(share1)
    session.add(share2)
    await session.commit()

    row = (await session.execute(select(SplitShare).where(SplitShare.id == share2.id))).scalar_one()
    await session.delete(row)
    with pytest.raises(DBAPIError, match="Split invariant violated"):
        await session.commit()
    await session.rollback()
