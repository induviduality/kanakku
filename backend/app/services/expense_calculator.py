"""Net expense calculation per FR-7.9.

Net expense for a split = user_own_share + forgiven_shares.
- user_own_share: shares where payee_id IS NULL (the user's own portion)
- forgiven_shares: shares where status = 'forgiven' (absorbed into user's cost)
- Pending shares owed by others do NOT reduce net expense.
- Settled shares (received money) are excluded.
"""

import uuid
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.split import Split, SplitShare, SplitShareStatus
from app.models.transaction import Transaction


async def net_expense(session: AsyncSession, transaction_id: uuid.UUID) -> Decimal:
    """Return the net expense amount for a transaction.

    For non-split transactions: returns transaction.amount.
    For split transactions: returns user_own_share + sum(forgiven_shares).
    """
    txn = (
        await session.execute(select(Transaction).where(Transaction.id == transaction_id))
    ).scalar_one_or_none()
    if txn is None:
        raise ValueError(f"Transaction {transaction_id} not found")

    split = (
        await session.execute(
            select(Split).where(
                Split.expense_transaction_id == transaction_id,
                Split.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    if split is None:
        return txn.amount

    result = (
        await session.execute(
            select(func.sum(SplitShare.amount)).where(
                SplitShare.split_id == split.id,
                or_(
                    SplitShare.payee_id.is_(None),
                    SplitShare.status == SplitShareStatus.forgiven,
                ),
            )
        )
    ).scalar_one_or_none()

    return result or Decimal("0")
