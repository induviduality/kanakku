import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.account import AccountCreate, AccountPatch, AccountResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])

_SOFT_DELETE_WINDOW = timedelta(days=30)


async def _get_account_or_404(
    account_id: uuid.UUID,
    user: User,
    session: AsyncSession,
    include_deleted: bool = False,
) -> Account:
    stmt = select(Account).where(Account.id == account_id, Account.user_id == user.id)
    if not include_deleted:
        stmt = stmt.where(Account.deleted_at.is_(None))
    result = await session.execute(stmt)
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("", status_code=201, response_model=AccountResponse)
async def create_account(
    body: AccountCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AccountResponse:
    currency = body.currency
    if currency is None:
        result = await session.execute(
            select(UserSettings).where(UserSettings.user_id == current_user.id)
        )
        user_settings = result.scalar_one_or_none()
        currency = user_settings.primary_currency if user_settings else "INR"

    account = Account(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=body.name,
        type=body.type,
        currency=currency,
        opening_balance=body.opening_balance,
        current_balance=body.opening_balance,
        is_active=body.is_active,
    )
    session.add(account)
    await session.commit()
    await session.refresh(account)
    return AccountResponse.model_validate(account)


@router.get("", response_model=list[AccountResponse])
async def list_accounts(
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AccountResponse]:
    stmt = select(Account).where(Account.user_id == current_user.id)
    if not include_deleted:
        stmt = stmt.where(Account.deleted_at.is_(None))
    stmt = stmt.order_by(Account.created_at)
    result = await session.execute(stmt)
    return [AccountResponse.model_validate(a) for a in result.scalars()]


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AccountResponse:
    account = await _get_account_or_404(account_id, current_user, session)
    return AccountResponse.model_validate(account)


@router.patch("/{account_id}", response_model=AccountResponse)
async def patch_account(
    account_id: uuid.UUID,
    body: AccountPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AccountResponse:
    account = await _get_account_or_404(account_id, current_user, session)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await session.commit()
    await session.refresh(account)
    return AccountResponse.model_validate(account)


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    account = await _get_account_or_404(account_id, current_user, session)

    # Block delete while live (non-deleted) transactions still reference the
    # account in either direction. Soft-deleting would leave orphaned ledger
    # data and break the purge job 30 days later (FK is ondelete=RESTRICT).
    live_ref_count = (
        await session.execute(
            select(Transaction.id)
            .where(
                or_(
                    Transaction.account_id == account.id,
                    Transaction.to_account_id == account.id,
                ),
                Transaction.deleted_at.is_(None),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if live_ref_count is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Account still has transactions. Delete or move those transactions "
                "before deleting the account."
            ),
        )

    account.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{account_id}/restore", response_model=AccountResponse)
async def restore_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AccountResponse:
    account = await _get_account_or_404(
        account_id, current_user, session, include_deleted=True
    )
    if account.deleted_at is None:
        raise HTTPException(status_code=400, detail="Account is not deleted")
    if datetime.now(UTC) - account.deleted_at.replace(tzinfo=UTC) > _SOFT_DELETE_WINDOW:
        raise HTTPException(
            status_code=410, detail="Account deleted more than 30 days ago; cannot restore"
        )
    account.deleted_at = None
    await session.commit()
    await session.refresh(account)
    return AccountResponse.model_validate(account)
