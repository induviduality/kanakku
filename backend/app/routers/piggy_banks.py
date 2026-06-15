import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.piggy_bank import PiggyBank, PiggyBankContribution
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.piggy_bank import (
    ContributionCreate,
    ContributionResponse,
    PiggyBankCreate,
    PiggyBankPatch,
    PiggyBankResponse,
)

router = APIRouter(prefix="/piggy-banks", tags=["piggy-banks"])

_SOFT_DELETE_WINDOW = timedelta(days=30)


async def _get_piggy_or_404(
    piggy_id: uuid.UUID, user: User, session: AsyncSession
) -> PiggyBank:
    result = await session.execute(
        select(PiggyBank).where(
            PiggyBank.id == piggy_id,
            PiggyBank.user_id == user.id,
            PiggyBank.deleted_at.is_(None),
        )
    )
    pig = result.scalar_one_or_none()
    if pig is None:
        raise HTTPException(status_code=404, detail="Piggy bank not found")
    return pig


def _to_response(pig: PiggyBank) -> PiggyBankResponse:
    data = {c.key: getattr(pig, c.key) for c in pig.__table__.columns}
    target = pig.target_amount
    current = pig.current_amount
    data["progress_pct"] = (
        float(current / target * 100) if target > 0 else 0.0
    )
    return PiggyBankResponse.model_validate(data)


def _update_completion(pig: PiggyBank) -> None:
    pig.is_completed = pig.current_amount >= pig.target_amount


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("", status_code=201, response_model=PiggyBankResponse)
async def create_piggy_bank(
    body: PiggyBankCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PiggyBankResponse:
    pig = PiggyBank(
        user_id=current_user.id,
        name=body.name,
        target_amount=body.target_amount,
        currency=body.currency,
        current_amount=Decimal("0"),
        date_started=body.date_started,
        target_date=body.target_date,
        notes=body.notes,
        is_completed=False,
    )
    session.add(pig)
    await session.commit()
    await session.refresh(pig)
    return _to_response(pig)


@router.get("", response_model=list[PiggyBankResponse])
async def list_piggy_banks(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[PiggyBankResponse]:
    result = await session.execute(
        select(PiggyBank).where(
            PiggyBank.user_id == current_user.id,
            PiggyBank.deleted_at.is_(None),
        ).order_by(PiggyBank.name)
    )
    return [_to_response(p) for p in result.scalars().all()]


@router.get("/{piggy_id}", response_model=PiggyBankResponse)
async def get_piggy_bank(
    piggy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PiggyBankResponse:
    pig = await _get_piggy_or_404(piggy_id, current_user, session)
    return _to_response(pig)


@router.patch("/{piggy_id}", response_model=PiggyBankResponse)
async def patch_piggy_bank(
    piggy_id: uuid.UUID,
    body: PiggyBankPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PiggyBankResponse:
    pig = await _get_piggy_or_404(piggy_id, current_user, session)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(pig, field, value)
    _update_completion(pig)
    await session.commit()
    await session.refresh(pig)
    return _to_response(pig)


@router.delete("/{piggy_id}", status_code=204)
async def delete_piggy_bank(
    piggy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    pig = await _get_piggy_or_404(piggy_id, current_user, session)

    # Hard-delete contribution rows so linked transactions are no longer blocked
    # by the RESTRICT FK and can be freely deleted or re-linked.
    contribs = (
        await session.execute(
            select(PiggyBankContribution).where(
                PiggyBankContribution.piggy_bank_id == pig.id
            )
        )
    ).scalars().all()
    for c in contribs:
        await session.delete(c)

    pig.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{piggy_id}/restore", response_model=PiggyBankResponse)
async def restore_piggy_bank(
    piggy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PiggyBankResponse:
    result = await session.execute(
        select(PiggyBank).where(
            PiggyBank.id == piggy_id,
            PiggyBank.user_id == current_user.id,
        )
    )
    pig = result.scalar_one_or_none()
    if pig is None:
        raise HTTPException(status_code=404, detail="Piggy bank not found")
    if pig.deleted_at is None:
        raise HTTPException(status_code=400, detail="Piggy bank is not deleted")
    cutoff = datetime.now(UTC) - _SOFT_DELETE_WINDOW
    if pig.deleted_at < cutoff:
        raise HTTPException(status_code=410, detail="Restore window expired")
    pig.deleted_at = None
    await session.commit()
    await session.refresh(pig)
    return _to_response(pig)


# ── Contributions ─────────────────────────────────────────────────────────────

@router.post("/{piggy_id}/contributions", status_code=201, response_model=ContributionResponse)
async def add_contribution(
    piggy_id: uuid.UUID,
    body: ContributionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ContributionResponse:
    pig = await _get_piggy_or_404(piggy_id, current_user, session)

    txn_result = await session.execute(
        select(Transaction).where(
            Transaction.id == body.transaction_id,
            Transaction.user_id == current_user.id,
            Transaction.deleted_at.is_(None),
        )
    )
    if txn_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    contrib = PiggyBankContribution(
        piggy_bank_id=pig.id,
        transaction_id=body.transaction_id,
        contribution_type=body.contribution_type,
        amount=body.amount,
        date=body.date,
        notes=body.notes,
    )
    session.add(contrib)
    pig.current_amount += body.amount
    _update_completion(pig)
    await session.commit()
    await session.refresh(contrib)
    return ContributionResponse.model_validate(contrib)


@router.delete("/{piggy_id}/contributions/{contrib_id}", status_code=204)
async def remove_contribution(
    piggy_id: uuid.UUID,
    contrib_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    pig = await _get_piggy_or_404(piggy_id, current_user, session)

    result = await session.execute(
        select(PiggyBankContribution).where(
            PiggyBankContribution.id == contrib_id,
            PiggyBankContribution.piggy_bank_id == pig.id,
        )
    )
    contrib = result.scalar_one_or_none()
    if contrib is None:
        raise HTTPException(status_code=404, detail="Contribution not found")

    pig.current_amount -= contrib.amount
    if pig.current_amount < Decimal("0"):
        pig.current_amount = Decimal("0")
    _update_completion(pig)
    await session.delete(contrib)
    await session.commit()


@router.get("/{piggy_id}/contributions", response_model=list[ContributionResponse])
async def list_contributions(
    piggy_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ContributionResponse]:
    pig = await _get_piggy_or_404(piggy_id, current_user, session)

    result = await session.execute(
        select(PiggyBankContribution).where(
            PiggyBankContribution.piggy_bank_id == pig.id,
        ).order_by(PiggyBankContribution.date.desc())
    )
    return [ContributionResponse.model_validate(c) for c in result.scalars().all()]
