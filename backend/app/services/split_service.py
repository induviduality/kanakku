"""Application-level invariant validator for splits."""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.split import Split, SplitShare
from app.models.transaction import Transaction


class SplitInvariantError(Exception):
    pass


async def validate_invariant(session: AsyncSession, split_id: uuid.UUID) -> None:
    """Raise SplitInvariantError if split shares do not sum to the parent transaction amount."""
    split = (
        await session.execute(select(Split).where(Split.id == split_id))
    ).scalar_one_or_none()
    if split is None:
        raise SplitInvariantError(f"Split {split_id} not found")

    txn = (
        await session.execute(
            select(Transaction).where(Transaction.id == split.expense_transaction_id)
        )
    ).scalar_one_or_none()
    if txn is None:
        raise SplitInvariantError(f"Transaction for split {split_id} not found")

    total: Decimal = (
        await session.execute(
            select(func.sum(SplitShare.amount)).where(SplitShare.split_id == split_id)
        )
    ).scalar_one_or_none() or Decimal("0")

    if total != txn.amount:
        raise SplitInvariantError(
            f"Split shares sum ({total}) does not match transaction amount ({txn.amount})"
        )
