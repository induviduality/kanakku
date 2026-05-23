import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.split import Split, SplitShare, SplitShareStatus
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.split import BundleCreate, SettleRequest, SplitCreate, SplitResponse, SplitShareResponse
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


@router.post("/bundle", status_code=201, response_model=SplitResponse)
async def bundle_split(
    body: BundleCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitResponse:
    """Retroactively bundle an existing expense + optional income legs into a split."""
    # Fetch and validate the expense transaction
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

    # Conflict detection
    existing = (
        await session.execute(
            select(Split).where(Split.expense_transaction_id == txn.id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="A split already exists for this transaction"
        )

    # Load and validate all income legs
    income_txns: list[Transaction] = []
    for inc_id in body.income_transaction_ids:
        inc = (
            await session.execute(
                select(Transaction).where(
                    Transaction.id == inc_id,
                    Transaction.user_id == user.id,
                    Transaction.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if inc is None:
            raise HTTPException(
                status_code=404, detail=f"Income transaction {inc_id} not found"
            )
        if inc.type != TransactionType.income:
            raise HTTPException(
                status_code=422,
                detail=f"Transaction {inc_id} is not an income transaction",
            )
        # Ensure not already used as a settlement leg
        already_settled = (
            await session.execute(
                select(SplitShare).where(SplitShare.settlement_transaction_id == inc_id)
            )
        ).scalar_one_or_none()
        if already_settled is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Income transaction {inc_id} is already linked to another split",
            )
        income_txns.append(inc)

    income_total = sum(t.amount for t in income_txns)
    forgiven_total = sum(f.amount for f in body.forgiven_shares)

    # FR-7.6: sum(income legs) + sum(forgiven) ≤ expense amount
    if income_total + forgiven_total > txn.amount:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Income legs ({income_total}) + forgiven ({forgiven_total}) "
                f"exceed expense amount ({txn.amount})"
            ),
        )

    user_share_amount = txn.amount - income_total - forgiven_total

    # Create split and shares atomically
    from datetime import UTC, datetime

    split = Split(
        id=uuid.uuid4(),
        user_id=user.id,
        expense_transaction_id=txn.id,
        notes=body.notes,
    )
    session.add(split)
    await session.flush()

    share_rows: list[SplitShare] = []
    now = datetime.now(UTC)

    # Income legs → settled shares
    for inc in income_txns:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=None,
            amount=inc.amount,
            status=SplitShareStatus.settled,
            settled_at=now,
            settlement_transaction_id=inc.id,
        )
        session.add(share)
        share_rows.append(share)

    # Forgiven entries
    for fg in body.forgiven_shares:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=fg.payee_id,
            amount=fg.amount,
            status=SplitShareStatus.forgiven,
            forgiven_at=now,
            notes=fg.notes,
        )
        session.add(share)
        share_rows.append(share)

    # User's own share (remainder)
    if user_share_amount > 0:
        own_share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=None,
            amount=user_share_amount,
            status=SplitShareStatus.pending,
        )
        session.add(own_share)
        share_rows.append(own_share)

    await session.flush()

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


async def _get_share_or_404(
    split_id: uuid.UUID, share_id: uuid.UUID, user: User, session: AsyncSession
) -> tuple[Split, SplitShare]:
    split = await _get_split_or_404(split_id, user, session)
    share = (
        await session.execute(
            select(SplitShare).where(
                SplitShare.id == share_id, SplitShare.split_id == split.id
            )
        )
    ).scalar_one_or_none()
    if share is None:
        raise HTTPException(status_code=404, detail="Share not found")
    return split, share


@router.post(
    "/{split_id}/shares/{share_id}/settle",
    response_model=SplitShareResponse,
)
async def settle_share(
    split_id: uuid.UUID,
    share_id: uuid.UUID,
    body: SettleRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitShareResponse:
    from datetime import UTC, datetime

    _, share = await _get_share_or_404(split_id, share_id, user, session)
    if share.status != SplitShareStatus.pending:
        raise HTTPException(
            status_code=422,
            detail=f"Share is {share.status.value}, only pending shares can be settled",
        )

    # Validate settlement transaction
    inc = (
        await session.execute(
            select(Transaction).where(
                Transaction.id == body.settlement_transaction_id,
                Transaction.user_id == user.id,
                Transaction.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if inc is None:
        raise HTTPException(status_code=404, detail="Settlement transaction not found")
    if inc.type != TransactionType.income:
        raise HTTPException(
            status_code=422, detail="Settlement transaction must be an income transaction"
        )

    # Ensure the income transaction isn't already used by another share
    existing = (
        await session.execute(
            select(SplitShare).where(
                SplitShare.settlement_transaction_id == body.settlement_transaction_id,
                SplitShare.id != share_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="Settlement transaction already linked to another share"
        )

    share.status = SplitShareStatus.settled
    share.settled_at = datetime.now(UTC)
    share.settlement_transaction_id = body.settlement_transaction_id
    await session.commit()
    return SplitShareResponse.model_validate(share)


@router.post(
    "/{split_id}/shares/{share_id}/forgive",
    response_model=SplitShareResponse,
)
async def forgive_share(
    split_id: uuid.UUID,
    share_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitShareResponse:
    from datetime import UTC, datetime

    _, share = await _get_share_or_404(split_id, share_id, user, session)
    if share.status != SplitShareStatus.pending:
        raise HTTPException(
            status_code=422,
            detail=f"Share is {share.status.value}, only pending shares can be forgiven",
        )

    share.status = SplitShareStatus.forgiven
    share.forgiven_at = datetime.now(UTC)
    await session.commit()
    return SplitShareResponse.model_validate(share)


@router.post(
    "/{split_id}/shares/{share_id}/unsettle",
    response_model=SplitShareResponse,
)
async def unsettle_share(
    split_id: uuid.UUID,
    share_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitShareResponse:
    _, share = await _get_share_or_404(split_id, share_id, user, session)
    if share.status != SplitShareStatus.settled:
        raise HTTPException(
            status_code=422,
            detail=f"Share is {share.status.value}, only settled shares can be unsettled",
        )

    share.status = SplitShareStatus.pending
    share.settled_at = None
    share.settlement_transaction_id = None
    await session.commit()
    return SplitShareResponse.model_validate(share)
