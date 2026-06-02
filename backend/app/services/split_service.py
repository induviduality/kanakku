"""Application-level invariant validator for splits."""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.split import Split, SplitExpense, SplitShare
from app.models.transaction import Transaction


class SplitInvariantError(Exception):
    pass


async def validate_invariant(session: AsyncSession, split_id: uuid.UUID) -> None:
    """Raise SplitInvariantError if:
    - shares do not sum to the total of all linked expense transactions, or
    - any two non-null payees are duplicated within the split.
    """
    split = (
        await session.execute(select(Split).where(Split.id == split_id))
    ).scalar_one_or_none()
    if split is None:
        raise SplitInvariantError(f"Split {split_id} not found")

    # Sum expected amount across all linked expense transactions
    expense_rows = (
        await session.execute(
            select(SplitExpense).where(SplitExpense.split_id == split_id)
        )
    ).scalars().all()
    if not expense_rows:
        raise SplitInvariantError(f"Split {split_id} has no linked expense transactions")

    txn_ids = [e.transaction_id for e in expense_rows]
    expected: Decimal = (
        await session.execute(
            select(func.sum(Transaction.amount)).where(Transaction.id.in_(txn_ids))
        )
    ).scalar_one_or_none() or Decimal("0")

    # Sum actual shares
    actual: Decimal = (
        await session.execute(
            select(func.sum(SplitShare.amount)).where(SplitShare.split_id == split_id)
        )
    ).scalar_one_or_none() or Decimal("0")

    if actual != expected:
        raise SplitInvariantError(
            f"Split shares sum ({actual}) does not match total expense amount ({expected})"
        )

    # Check no duplicate non-null payees
    shares = (
        await session.execute(
            select(SplitShare).where(SplitShare.split_id == split_id)
        )
    ).scalars().all()
    non_null_payees = [s.payee_id for s in shares if s.payee_id is not None]
    if len(non_null_payees) != len(set(non_null_payees)):
        raise SplitInvariantError(
            "Duplicate payee detected: each payee may appear in at most one share per split"
        )
