import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.account import LIABILITY_ACCOUNT_TYPES, Account
from app.models.earmark import Earmark
from app.models.piggy_bank import PiggyBank
from app.models.user import User
from app.schemas.earmark import (
    EarmarkCreate,
    EarmarkPatch,
    EarmarkResponse,
)
from app.services.account_balance import compute_balances
from app.services.earmark_balance import sum_all

router = APIRouter(prefix="/earmarks", tags=["earmarks"])

_SOFT_DELETE_WINDOW = timedelta(days=30)


async def _get_total_cash(session: AsyncSession, user_id: uuid.UUID) -> Decimal:
    """Sum of balances across all active asset (non-liability) accounts."""
    result = await session.execute(
        select(Account).where(
            Account.user_id == user_id,
            Account.deleted_at.is_(None),
            Account.type.not_in(LIABILITY_ACCOUNT_TYPES),
        )
    )
    accounts = result.scalars().all()
    if not accounts:
        return Decimal("0.00")
    balances = await compute_balances(session, [a.id for a in accounts], user_id)
    return sum(balances.values(), Decimal("0.00"))


async def _get_earmark_or_404(
    earmark_id: uuid.UUID, user: User, session: AsyncSession
) -> Earmark:
    result = await session.execute(
        select(Earmark).where(
            Earmark.id == earmark_id,
            Earmark.user_id == user.id,
            Earmark.deleted_at.is_(None),
        )
    )
    earmark = result.scalar_one_or_none()
    if earmark is None:
        raise HTTPException(status_code=404, detail="Earmark not found")
    return earmark


async def _to_responses(
    earmarks: list[Earmark], session: AsyncSession
) -> list[EarmarkResponse]:
    if not earmarks:
        return []

    acc_ids = {e.account_id for e in earmarks if e.account_id is not None}
    pb_ids = {e.piggy_bank_id for e in earmarks if e.piggy_bank_id is not None}

    acc_map: dict[uuid.UUID, str] = {}
    if acc_ids:
        acc_rows = (
            await session.execute(
                select(Account.id, Account.name).where(Account.id.in_(acc_ids))
            )
        ).all()
        acc_map = {r[0]: r[1] for r in acc_rows}

    pb_map: dict[uuid.UUID, str] = {}
    if pb_ids:
        pb_rows = (
            await session.execute(
                select(PiggyBank.id, PiggyBank.name).where(PiggyBank.id.in_(pb_ids))
            )
        ).all()
        pb_map = {r[0]: r[1] for r in pb_rows}

    responses: list[EarmarkResponse] = []
    for e in earmarks:
        data = {c.key: getattr(e, c.key) for c in e.__table__.columns}
        data["account_name"] = acc_map.get(e.account_id) if e.account_id else None
        data["piggy_bank_name"] = pb_map.get(e.piggy_bank_id) if e.piggy_bank_id else None
        responses.append(EarmarkResponse.model_validate(data))

    return responses


async def _to_single_response(earmark: Earmark, session: AsyncSession) -> EarmarkResponse:
    res = await _to_responses([earmark], session)
    return res[0]


@router.post("", status_code=201, response_model=EarmarkResponse)
async def create_earmark(
    body: EarmarkCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EarmarkResponse:
    # 1. Validate account if specified
    if body.account_id:
        acc_res = await session.execute(
            select(Account).where(
                Account.id == body.account_id,
                Account.user_id == current_user.id,
                Account.deleted_at.is_(None),
            )
        )
        acc = acc_res.scalar_one_or_none()
        if not acc:
            raise HTTPException(status_code=404, detail="Account not found")
        if acc.type in LIABILITY_ACCOUNT_TYPES:
            raise HTTPException(
                status_code=422,
                detail="Earmarks cannot be assigned to liability accounts",
            )
        if acc.currency != body.currency:
            raise HTTPException(
                status_code=422,
                detail=f"Currency mismatch: earmark currency '{body.currency}' does not match account currency '{acc.currency}'",
            )

    # 2. Validate piggy bank if specified
    if body.piggy_bank_id:
        pb_res = await session.execute(
            select(PiggyBank).where(
                PiggyBank.id == body.piggy_bank_id,
                PiggyBank.user_id == current_user.id,
                PiggyBank.deleted_at.is_(None),
            )
        )
        pb = pb_res.scalar_one_or_none()
        if not pb:
            raise HTTPException(status_code=404, detail="Piggy bank not found")
        if pb.currency != body.currency:
            raise HTTPException(
                status_code=422,
                detail=f"Currency mismatch: earmark currency '{body.currency}' does not match piggy bank currency '{pb.currency}'",
            )

    # 3. Global constraint validation
    existing_earmarked = await sum_all(session, current_user.id)
    total_cash = await _get_total_cash(session, current_user.id)
    if existing_earmarked + body.amount > total_cash:
        raise HTTPException(
            status_code=422,
            detail=f"Earmark total would exceed available cash ({existing_earmarked + body.amount} earmarked vs {total_cash} total cash)",
        )

    earmark = Earmark(
        user_id=current_user.id,
        name=body.name,
        amount=body.amount,
        currency=body.currency,
        account_id=body.account_id,
        piggy_bank_id=body.piggy_bank_id,
        icon=body.icon,
        color=body.color,
        notes=body.notes,
        is_active=True,
    )
    session.add(earmark)
    await session.commit()
    await session.refresh(earmark)
    return await _to_single_response(earmark, session)


@router.get("", response_model=list[EarmarkResponse])
async def list_earmarks(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[EarmarkResponse]:
    result = await session.execute(
        select(Earmark)
        .where(
            Earmark.user_id == current_user.id,
            Earmark.deleted_at.is_(None),
        )
        .order_by(Earmark.is_active.desc(), Earmark.created_at.desc())
    )
    earmarks = list(result.scalars().all())
    return await _to_responses(earmarks, session)


@router.get("/{earmark_id}", response_model=EarmarkResponse)
async def get_earmark(
    earmark_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EarmarkResponse:
    earmark = await _get_earmark_or_404(earmark_id, current_user, session)
    return await _to_single_response(earmark, session)


@router.patch("/{earmark_id}", response_model=EarmarkResponse)
async def patch_earmark(
    earmark_id: uuid.UUID,
    body: EarmarkPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EarmarkResponse:
    earmark = await _get_earmark_or_404(earmark_id, current_user, session)

    target_currency = body.currency if body.currency is not None else earmark.currency
    target_amount = body.amount if body.amount is not None else earmark.amount
    target_active = body.is_active if body.is_active is not None else earmark.is_active
    target_account_id = (
        body.account_id if body.account_id is not None else earmark.account_id
    )
    target_pb_id = (
        body.piggy_bank_id if body.piggy_bank_id is not None else earmark.piggy_bank_id
    )

    # 1. Validate account if specified / changing
    if body.account_id is not None:
        if body.account_id is not None:  # explicit UUID
            acc_res = await session.execute(
                select(Account).where(
                    Account.id == body.account_id,
                    Account.user_id == current_user.id,
                    Account.deleted_at.is_(None),
                )
            )
            acc = acc_res.scalar_one_or_none()
            if not acc:
                raise HTTPException(status_code=404, detail="Account not found")
            if acc.type in LIABILITY_ACCOUNT_TYPES:
                raise HTTPException(
                    status_code=422,
                    detail="Earmarks cannot be assigned to liability accounts",
                )
            if acc.currency != target_currency:
                raise HTTPException(
                    status_code=422,
                    detail=f"Currency mismatch: earmark currency '{target_currency}' does not match account currency '{acc.currency}'",
                )

    # 2. Validate piggy bank if specified / changing
    if body.piggy_bank_id is not None:
        pb_res = await session.execute(
            select(PiggyBank).where(
                PiggyBank.id == body.piggy_bank_id,
                PiggyBank.user_id == current_user.id,
                PiggyBank.deleted_at.is_(None),
            )
        )
        pb = pb_res.scalar_one_or_none()
        if not pb:
            raise HTTPException(status_code=404, detail="Piggy bank not found")
        if pb.currency != target_currency:
            raise HTTPException(
                status_code=422,
                detail=f"Currency mismatch: earmark currency '{target_currency}' does not match piggy bank currency '{pb.currency}'",
            )

    # 3. Global constraint validation if amount or active state changes
    if target_active:
        # Sum all other active earmarks
        other_earmarked_res = await session.execute(
            select(sa.func.coalesce(sa.func.sum(Earmark.amount), Decimal("0"))).where(
                Earmark.user_id == current_user.id,
                Earmark.id != earmark.id,
                Earmark.deleted_at.is_(None),
                Earmark.is_active.is_(True),
            )
        )
        other_earmarked = other_earmarked_res.scalar_one() or Decimal("0")
        total_cash = await _get_total_cash(session, current_user.id)
        if other_earmarked + target_amount > total_cash:
            raise HTTPException(
                status_code=422,
                detail=f"Earmark total would exceed available cash ({other_earmarked + target_amount} earmarked vs {total_cash} total cash)",
            )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(earmark, field, value)

    await session.commit()
    await session.refresh(earmark)
    return await _to_single_response(earmark, session)


@router.patch("/{earmark_id}/toggle", response_model=EarmarkResponse)
async def toggle_earmark(
    earmark_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EarmarkResponse:
    earmark = await _get_earmark_or_404(earmark_id, current_user, session)
    new_active = not earmark.is_active

    if new_active:
        # Check global constraint before reactivating
        other_earmarked_res = await session.execute(
            select(sa.func.coalesce(sa.func.sum(Earmark.amount), Decimal("0"))).where(
                Earmark.user_id == current_user.id,
                Earmark.id != earmark.id,
                Earmark.deleted_at.is_(None),
                Earmark.is_active.is_(True),
            )
        )
        other_earmarked = other_earmarked_res.scalar_one() or Decimal("0")
        total_cash = await _get_total_cash(session, current_user.id)
        if other_earmarked + earmark.amount > total_cash:
            raise HTTPException(
                status_code=422,
                detail=f"Earmark total would exceed available cash ({other_earmarked + earmark.amount} earmarked vs {total_cash} total cash)",
            )

    earmark.is_active = new_active
    await session.commit()
    await session.refresh(earmark)
    return await _to_single_response(earmark, session)


@router.delete("/{earmark_id}", status_code=204)
async def delete_earmark(
    earmark_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    earmark = await _get_earmark_or_404(earmark_id, current_user, session)
    earmark.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{earmark_id}/restore", response_model=EarmarkResponse)
async def restore_earmark(
    earmark_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> EarmarkResponse:
    result = await session.execute(
        select(Earmark).where(
            Earmark.id == earmark_id,
            Earmark.user_id == current_user.id,
        )
    )
    earmark = result.scalar_one_or_none()
    if earmark is None:
        raise HTTPException(status_code=404, detail="Earmark not found")
    if earmark.deleted_at is None:
        raise HTTPException(status_code=400, detail="Earmark is not deleted")
    cutoff = datetime.now(UTC) - _SOFT_DELETE_WINDOW
    if earmark.deleted_at < cutoff:
        raise HTTPException(status_code=410, detail="Restore window expired")

    earmark.deleted_at = None
    await session.commit()
    await session.refresh(earmark)
    return await _to_single_response(earmark, session)
