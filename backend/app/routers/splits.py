import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.split import Split, SplitShare, SplitShareSettlement, SplitShareStatus
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.split import (
    BundleCreate,
    ForgiveRequest,
    SettleRequest,
    SplitCreate,
    SplitResponse,
    SplitShareResponse,
    SplitShareSettlementResponse,
)
from app.services.split_service import SplitInvariantError, validate_invariant

router = APIRouter(prefix="/splits", tags=["splits"])


# ── Helpers ───────────────────────────────────────────────────────────────────


def _derive_status(share_amount: Decimal, paid: Decimal, forgiven: Decimal) -> SplitShareStatus:
    if paid + forgiven >= share_amount:
        return SplitShareStatus.forgiven if paid == Decimal("0") else SplitShareStatus.settled
    return SplitShareStatus.pending


def _share_response(share: SplitShare, settlements: list[SplitShareSettlement]) -> SplitShareResponse:
    paid = sum((s.amount for s in settlements), Decimal("0.00"))
    return SplitShareResponse(
        id=share.id,
        split_id=share.split_id,
        payee_id=share.payee_id,
        amount=share.amount,
        status=share.status,
        forgiven_amount=share.forgiven_amount,
        paid_amount=paid,
        settlements=[SplitShareSettlementResponse.model_validate(s) for s in settlements],
        notes=share.notes,
        created_at=share.created_at,
        updated_at=share.updated_at,
    )


async def _load_settlements_for_shares(
    session: AsyncSession, share_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[SplitShareSettlement]]:
    if not share_ids:
        return {}
    rows = (
        await session.execute(
            select(SplitShareSettlement).where(
                SplitShareSettlement.share_id.in_(share_ids)
            )
        )
    ).scalars().all()
    result: dict[uuid.UUID, list[SplitShareSettlement]] = {sid: [] for sid in share_ids}
    for row in rows:
        result[row.share_id].append(row)
    return result


async def _build_response(
    split: Split, shares: list[SplitShare], session: AsyncSession
) -> SplitResponse:
    smap = await _load_settlements_for_shares(session, [s.id for s in shares])
    return SplitResponse(
        id=split.id,
        user_id=split.user_id,
        expense_transaction_id=split.expense_transaction_id,
        notes=split.notes,
        shares=[_share_response(s, smap[s.id]) for s in shares],
        created_at=split.created_at,
        updated_at=split.updated_at,
        deleted_at=split.deleted_at,
    )


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


async def _paid_total(session: AsyncSession, share_id: uuid.UUID) -> Decimal:
    rows = (
        await session.execute(
            select(SplitShareSettlement).where(SplitShareSettlement.share_id == share_id)
        )
    ).scalars().all()
    return sum((r.amount for r in rows), Decimal("0"))


# ── Create split ──────────────────────────────────────────────────────────────


@router.post("", status_code=201, response_model=SplitResponse)
async def create_split(
    body: SplitCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitResponse:
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

    existing = (
        await session.execute(
            select(Split).where(Split.expense_transaction_id == txn.id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="A split already exists for this transaction"
        )

    total = sum(s.amount for s in body.shares)
    if total != txn.amount:
        raise HTTPException(
            status_code=422,
            detail=f"Shares sum ({total}) does not equal transaction amount ({txn.amount})",
        )

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
            forgiven_amount=Decimal("0.00"),
            notes=s.notes,
        )
        session.add(share)
        share_rows.append(share)

    await session.flush()

    try:
        await validate_invariant(session, split.id)
    except SplitInvariantError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await session.commit()
    return await _build_response(split, share_rows, session)


# ── Bundle split ──────────────────────────────────────────────────────────────


@router.post("/bundle", status_code=201, response_model=SplitResponse)
async def bundle_split(
    body: BundleCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitResponse:
    """Retroactively bundle an existing expense + optional income legs into a split."""
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

    existing = (
        await session.execute(
            select(Split).where(Split.expense_transaction_id == txn.id)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="A split already exists for this transaction"
        )

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
        already_used = (
            await session.execute(
                select(SplitShareSettlement).where(
                    SplitShareSettlement.transaction_id == inc_id
                )
            )
        ).scalar_one_or_none()
        if already_used is not None:
            raise HTTPException(
                status_code=409,
                detail=f"Income transaction {inc_id} is already linked to another split",
            )
        income_txns.append(inc)

    income_total = sum(t.amount for t in income_txns)
    forgiven_total = sum(f.amount for f in body.forgiven_shares)

    if income_total + forgiven_total > txn.amount:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Income legs ({income_total}) + forgiven ({forgiven_total}) "
                f"exceed expense amount ({txn.amount})"
            ),
        )

    user_share_amount = txn.amount - income_total - forgiven_total

    split = Split(
        id=uuid.uuid4(),
        user_id=user.id,
        expense_transaction_id=txn.id,
        notes=body.notes,
    )
    session.add(split)
    await session.flush()

    share_rows: list[SplitShare] = []
    settlement_pairs: list[tuple[SplitShare, Transaction]] = []

    for inc in income_txns:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=None,
            amount=inc.amount,
            status=SplitShareStatus.settled,
            forgiven_amount=Decimal("0.00"),
        )
        session.add(share)
        share_rows.append(share)
        settlement_pairs.append((share, inc))

    for fg in body.forgiven_shares:
        share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=fg.payee_id,
            amount=fg.amount,
            status=SplitShareStatus.forgiven,
            forgiven_amount=fg.amount,
            notes=fg.notes,
        )
        session.add(share)
        share_rows.append(share)

    if user_share_amount > 0:
        own_share = SplitShare(
            id=uuid.uuid4(),
            split_id=split.id,
            payee_id=None,
            amount=user_share_amount,
            status=SplitShareStatus.pending,
            forgiven_amount=Decimal("0.00"),
        )
        session.add(own_share)
        share_rows.append(own_share)

    await session.flush()

    for share, inc in settlement_pairs:
        session.add(
            SplitShareSettlement(
                id=uuid.uuid4(),
                share_id=share.id,
                transaction_id=inc.id,
                amount=inc.amount,
            )
        )

    await session.flush()

    try:
        await validate_invariant(session, split.id)
    except SplitInvariantError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await session.commit()
    return await _build_response(split, share_rows, session)


# ── List / Get ────────────────────────────────────────────────────────────────


@router.get("", response_model=list[SplitResponse])
async def list_splits(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SplitResponse]:
    splits = (
        await session.execute(
            select(Split)
            .where(Split.user_id == user.id, Split.deleted_at.is_(None))
            .order_by(Split.created_at.desc())
        )
    ).scalars().all()

    result = []
    for split in splits:
        shares = (
            await session.execute(
                select(SplitShare).where(SplitShare.split_id == split.id)
            )
        ).scalars().all()
        result.append(await _build_response(split, list(shares), session))
    return result


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
    return await _build_response(split, list(shares), session)


# ── Settle: link an income transaction to a share ─────────────────────────────


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
    _, share = await _get_share_or_404(split_id, share_id, user, session)

    inc = (
        await session.execute(
            select(Transaction).where(
                Transaction.id == body.transaction_id,
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

    # Each income transaction may only be linked to one share (across all splits)
    already_used = (
        await session.execute(
            select(SplitShareSettlement).where(
                SplitShareSettlement.transaction_id == body.transaction_id
            )
        )
    ).scalar_one_or_none()
    if already_used is not None:
        raise HTTPException(
            status_code=409, detail="Settlement transaction already linked to a share"
        )

    credit_amount = body.amount if body.amount is not None else inc.amount

    paid = await _paid_total(session, share.id)
    remaining = share.amount - paid - share.forgiven_amount
    if remaining <= 0:
        raise HTTPException(
            status_code=422, detail="Share is already fully resolved"
        )
    if credit_amount > remaining:
        raise HTTPException(
            status_code=422,
            detail=f"Credit amount ({credit_amount}) exceeds remaining balance ({remaining})",
        )

    settlement = SplitShareSettlement(
        id=uuid.uuid4(),
        share_id=share.id,
        transaction_id=inc.id,
        amount=credit_amount,
    )
    session.add(settlement)

    new_paid = paid + credit_amount
    share.status = _derive_status(share.amount, new_paid, share.forgiven_amount)
    await session.commit()

    settlements = (
        await session.execute(
            select(SplitShareSettlement).where(SplitShareSettlement.share_id == share.id)
        )
    ).scalars().all()
    return _share_response(share, list(settlements))


# ── Unlink a single settlement ────────────────────────────────────────────────


@router.delete(
    "/{split_id}/shares/{share_id}/settlements/{settlement_id}",
    response_model=SplitShareResponse,
)
async def unlink_settlement(
    split_id: uuid.UUID,
    share_id: uuid.UUID,
    settlement_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitShareResponse:
    _, share = await _get_share_or_404(split_id, share_id, user, session)

    settlement = (
        await session.execute(
            select(SplitShareSettlement).where(
                SplitShareSettlement.id == settlement_id,
                SplitShareSettlement.share_id == share.id,
            )
        )
    ).scalar_one_or_none()
    if settlement is None:
        raise HTTPException(status_code=404, detail="Settlement not found")

    await session.delete(settlement)
    await session.flush()

    paid = await _paid_total(session, share.id)
    share.status = _derive_status(share.amount, paid, share.forgiven_amount)
    await session.commit()

    settlements = (
        await session.execute(
            select(SplitShareSettlement).where(SplitShareSettlement.share_id == share.id)
        )
    ).scalars().all()
    return _share_response(share, list(settlements))


# ── Forgive (partial or full) ─────────────────────────────────────────────────


@router.post(
    "/{split_id}/shares/{share_id}/forgive",
    response_model=SplitShareResponse,
)
async def forgive_share(
    split_id: uuid.UUID,
    share_id: uuid.UUID,
    body: ForgiveRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SplitShareResponse:
    _, share = await _get_share_or_404(split_id, share_id, user, session)

    paid = await _paid_total(session, share.id)
    if paid + body.amount > share.amount:
        raise HTTPException(
            status_code=422,
            detail=f"Paid ({paid}) + forgiven ({body.amount}) exceeds share amount ({share.amount})",
        )

    share.forgiven_amount = body.amount
    share.status = _derive_status(share.amount, paid, body.amount)
    await session.commit()

    settlements = (
        await session.execute(
            select(SplitShareSettlement).where(SplitShareSettlement.share_id == share.id)
        )
    ).scalars().all()
    return _share_response(share, list(settlements))


# ── Unsettle: clear all settlements + forgiveness ─────────────────────────────


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

    if share.status == SplitShareStatus.pending and share.forgiven_amount == Decimal("0"):
        raise HTTPException(
            status_code=422, detail="Share is already pending with no settlements or forgiveness"
        )

    # Delete all linked settlements
    settlements_to_delete = (
        await session.execute(
            select(SplitShareSettlement).where(SplitShareSettlement.share_id == share.id)
        )
    ).scalars().all()
    for s in settlements_to_delete:
        await session.delete(s)

    share.forgiven_amount = Decimal("0.00")
    share.status = SplitShareStatus.pending
    await session.commit()

    return _share_response(share, [])
