import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.split import Split, SplitShare, SplitShareStatus
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.split import SplitCreate, SplitResponse, SplitShareResponse
from app.services.split_service import SplitInvariantError, validate_invariant

router = APIRouter(prefix="/splits", tags=["splits"])


async def _get_split_or_404(
    split_id: uuid.UUID, user: User, session: AsyncSession
) -> Split:
    split = (
        await session.execute(
            select(Split).where(
                Split.id == split_id,
                Split.user_id == user.id,
                Split.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if split is None:
        raise HTTPException(status_code=404, detail="Split not found")
    return split


def _build_response(split: Split, shares: list[SplitShare]) -> SplitResponse:
    return SplitResponse(
        id=split.id,
        user_id=split.user_id,
        expense_transaction_id=split.expense_transaction_id,
        notes=split.notes,
        shares=[SplitShareResponse.model_validate(s) for s in shares],
        created_at=split.created_at,
        updated_at=split.updated_at,
        deleted_at=split.deleted_at,
    )


@router.post("", status_code=201, response_model=SplitResponse)
async def create_split(
    body: SplitCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitResponse:
    # Fetch the transaction and verify ownership + type
    txn = (
        await session.execute(
            select(Transaction).where(
                Transaction.id == body.expense_transaction_id,
                Transaction.user_id == user.id,
                Transaction.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.type != TransactionType.expense:
        raise HTTPException(
            status_code=422, detail="Only expense transactions can be wrapped in a split"
        )

    # Guard against duplicate splits (UNIQUE constraint also enforces this at DB level)
    existing = (
        await session.execute(
            select(Split).where(Split.expense_transaction_id == txn.id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="A split already exists for this transaction"
        )

    # Validate share sum upfront — avoids a DB round-trip failure
    total = sum(s.amount for s in body.shares)
    if total != txn.amount:
        raise HTTPException(
            status_code=422,
            detail=f"Shares sum ({total}) does not equal transaction amount ({txn.amount})",
        )

    # Create atomically
    split = Split(
        id=uuid.uuid4(),
        user_id=user.id,
        expense_transaction_id=txn.id,
        notes=body.notes,
    )
    session.add(split)
    await session.flush()

    share_rows: list[SplitShare] = []
    for s in body.shares:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=s.payee_id,
            amount=s.amount,
            status=SplitShareStatus.pending,
            notes=s.notes,
        )
        session.add(share)
        share_rows.append(share)

    await session.flush()

    # Application-level invariant check (DB trigger also enforces at commit)
    try:
        await validate_invariant(session, split.id)
    except SplitInvariantError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await session.commit()
    return _build_response(split, share_rows)


@router.get("/{split_id}", response_model=SplitResponse)
async def get_split(
    split_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitResponse:
    split = await _get_split_or_404(split_id, user, session)
    shares = (
        await session.execute(
            select(SplitShare).where(SplitShare.split_id == split.id)
        )
    ).scalars().all()
    return _build_response(split, list(shares))
