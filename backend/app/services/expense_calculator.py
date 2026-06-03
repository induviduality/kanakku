"""Net expense calculation per FR-7.9.

Net expense for a split = user_own_share + forgiven_shares.
- user_own_share: shares where payee_id IS NULL (the user's own portion)
- forgiven_shares: amounts absorbed into the user's cost. This includes:
  - the full `amount` of any share whose status is 'forgiven', AND
  - the `forgiven_amount` of any share that is partially forgiven (status
    could be 'settled' or 'pending' if some portion is paid/remaining but
    the rest was written off).
- Pending shares owed by others (not forgiven) do NOT reduce net expense.
- Settled portions (received money) are excluded.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.split import Split, SplitExpense, SplitShare, SplitShareStatus
from app.models.transaction import Transaction


async def net_expense(session: AsyncSession, transaction_id: uuid.UUID) -> Decimal:
    """Return the net expense amount for a transaction.

    For non-split transactions: returns transaction.amount.
    For split transactions: returns user_own_share + sum(forgiven amounts).
    """
    txn = (
        await session.execute(select(Transaction).where(Transaction.id == transaction_id))
    ).scalar_one_or_none()
    if txn is None:
        raise ValueError(f"Transaction {transaction_id} not found")

    split = (
        await session.execute(
            select(Split)
            .join(SplitExpense, SplitExpense.split_id == Split.id)
            .where(
                SplitExpense.transaction_id == transaction_id,
                Split.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if split is None:
        return txn.amount

    shares = (
        await session.execute(
            select(SplitShare).where(SplitShare.split_id == split.id)
        )
    ).scalars().all()

    total = Decimal("0")
    for s in shares:
        if s.payee_id is None:
            # User's own share — counted in full.
            total += s.amount
        elif s.status == SplitShareStatus.forgiven:
            # Fully-forgiven share — counted in full.
            total += s.amount
        else:
            # Settled or pending share with a payee. Only the partially-forgiven
            # portion (if any) is absorbed by the user.
            total += s.forgiven_amount or Decimal("0")

    return total
