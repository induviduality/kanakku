import base64
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.account import Account, AccountType
from app.models.payment_method import PaymentMethod
from app.models.split import Split, SplitExpense
from app.models.piggy_bank import ContributionType, PiggyBankContribution
from app.models.transaction import (
    Transaction,
    TransactionType,
    transaction_budgets,
    transaction_categories,
    transaction_tags,
)
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionListResponse,
    TransactionPatch,
    TransactionResponse,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])

_SOFT_DELETE_WINDOW = timedelta(days=30)


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_txn_or_404(
    txn_id: uuid.UUID,
    user: User,
    session: AsyncSession,
    include_deleted: bool = False,
) -> Transaction:
    stmt = select(Transaction).where(
        Transaction.id == txn_id, Transaction.user_id == user.id
    )
    if not include_deleted:
        stmt = stmt.where(Transaction.deleted_at.is_(None))
    result = await session.execute(stmt)
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


async def _get_account_or_404(
    account_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession
) -> Account:
    result = await session.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == user_id,
            Account.deleted_at.is_(None),
        )
    )
    acc = result.scalar_one_or_none()
    if acc is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return acc


async def _fetch_category_ids(txn_id: uuid.UUID, session: AsyncSession) -> list[uuid.UUID]:
    rows = (
        await session.execute(
            select(transaction_categories.c.category_id).where(
                transaction_categories.c.transaction_id == txn_id
            )
        )
    ).fetchall()
    return [r.category_id for r in rows]


async def _fetch_tag_ids(txn_id: uuid.UUID, session: AsyncSession) -> list[uuid.UUID]:
    rows = (
        await session.execute(
            select(transaction_tags.c.tag_id).where(
                transaction_tags.c.transaction_id == txn_id
            )
        )
    ).fetchall()
    return [r.tag_id for r in rows]


async def _fetch_budget_ids(txn_id: uuid.UUID, session: AsyncSession) -> list[uuid.UUID]:
    rows = (
        await session.execute(
            select(transaction_budgets.c.budget_id).where(
                transaction_budgets.c.transaction_id == txn_id
            )
        )
    ).fetchall()
    return [r.budget_id for r in rows]


async def _fetch_piggy_bank_id(txn_id: uuid.UUID, session: AsyncSession) -> uuid.UUID | None:
    row = (
        await session.execute(
            select(PiggyBankContribution.piggy_bank_id).where(
                PiggyBankContribution.transaction_id == txn_id
            )
        )
    ).scalar_one_or_none()
    return row


async def _fetch_payment_method_name(
    pm_id: uuid.UUID | None, session: AsyncSession
) -> str | None:
    if pm_id is None:
        return None
    row = (
        await session.execute(
            select(PaymentMethod.name).where(PaymentMethod.id == pm_id)
        )
    ).scalar_one_or_none()
    return row


async def _fetch_split_id(txn_id: uuid.UUID, session: AsyncSession) -> uuid.UUID | None:
    row = (
        await session.execute(
            select(Split.id)
            .join(SplitExpense, SplitExpense.split_id == Split.id)
            .where(
                SplitExpense.transaction_id == txn_id,
                Split.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    return row


async def _to_response(txn: Transaction, session: AsyncSession) -> TransactionResponse:
    category_ids = await _fetch_category_ids(txn.id, session)
    tag_ids = await _fetch_tag_ids(txn.id, session)
    budget_ids = await _fetch_budget_ids(txn.id, session)
    piggy_bank_id = await _fetch_piggy_bank_id(txn.id, session)
    payment_method_name = await _fetch_payment_method_name(txn.payment_method_id, session)
    split_id = await _fetch_split_id(txn.id, session)
    data = {c.key: getattr(txn, c.key) for c in txn.__table__.columns}
    data["category_ids"] = category_ids
    data["tag_ids"] = tag_ids
    data["budget_ids"] = budget_ids
    data["piggy_bank_id"] = piggy_bank_id
    data["payment_method_name"] = payment_method_name
    data["split_id"] = split_id
    data["is_split"] = split_id is not None
    return TransactionResponse.model_validate(data)


_LIABILITY_TYPES = {AccountType.credit_card, AccountType.loan}


def _apply_balance_delta(account: Account, txn: Transaction, sign: int) -> None:
    """Adjust account.current_balance. sign=+1 to apply, -1 to reverse."""
    amount = txn.amount * sign
    if txn.type == TransactionType.expense:
        account.current_balance -= amount
    elif txn.type in (TransactionType.income, TransactionType.opening_balance):
        account.current_balance += amount
    # transfer handled separately via _apply_transfer_balances


async def _apply_transfer_balances(
    txn: Transaction,
    session: AsyncSession,
    user_id: uuid.UUID,
    sign: int,
) -> None:
    src = await _get_account_or_404(txn.account_id, user_id, session)
    dst = await _get_account_or_404(txn.to_account_id, user_id, session)  # type: ignore[arg-type]
    debit = txn.amount * sign
    credit = (txn.to_amount or txn.amount) * sign
    src.current_balance -= debit
    dst.current_balance += credit


async def _apply_balance(
    txn: Transaction, session: AsyncSession, user_id: uuid.UUID, sign: int
) -> None:
    if txn.type == TransactionType.transfer:
        await _apply_transfer_balances(txn, session, user_id, sign)
    else:
        acc = await _get_account_or_404(txn.account_id, user_id, session)
        _apply_balance_delta(acc, txn, sign)


async def _set_joins(
    txn_id: uuid.UUID,
    category_ids: list[uuid.UUID],
    tag_ids: list[uuid.UUID],
    budget_ids: list[uuid.UUID],
    session: AsyncSession,
) -> None:
    await session.execute(
        delete(transaction_categories).where(transaction_categories.c.transaction_id == txn_id)
    )
    await session.execute(
        delete(transaction_tags).where(transaction_tags.c.transaction_id == txn_id)
    )
    await session.execute(
        delete(transaction_budgets).where(transaction_budgets.c.transaction_id == txn_id)
    )
    if category_ids:
        await session.execute(
            transaction_categories.insert(),
            [{"transaction_id": txn_id, "category_id": cid} for cid in category_ids],
        )
    if tag_ids:
        await session.execute(
            transaction_tags.insert(),
            [{"transaction_id": txn_id, "tag_id": tid} for tid in tag_ids],
        )
    if budget_ids:
        await session.execute(
            transaction_budgets.insert(),
            [{"transaction_id": txn_id, "budget_id": bid} for bid in budget_ids],
        )


async def _sync_piggy_bank(
    txn: Transaction,
    piggy_bank_id: uuid.UUID | None,
    session: AsyncSession,
) -> None:
    """Reconcile the piggy bank contribution for a transaction.

    Removes any existing contribution then creates a new one if piggy_bank_id is set.
    """
    await session.execute(
        delete(PiggyBankContribution).where(PiggyBankContribution.transaction_id == txn.id)
    )
    if piggy_bank_id is not None:
        ctype = (
            ContributionType.transfer
            if txn.type == TransactionType.income
            else ContributionType.expense
        )
        session.add(PiggyBankContribution(
            piggy_bank_id=piggy_bank_id,
            transaction_id=txn.id,
            contribution_type=ctype,
            amount=txn.amount,
            date=txn.transacted_at.date(),
        ))


def _encode_cursor(transacted_at: datetime, txn_id: uuid.UUID) -> str:
    raw = f"{transacted_at.isoformat()}|{txn_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts_str, id_str = raw.split("|", 1)
        return datetime.fromisoformat(ts_str), uuid.UUID(id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cursor")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201, response_model=TransactionResponse)
async def create_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TransactionResponse:
    # Validate transfer constraint
    if body.type == TransactionType.transfer and body.to_account_id is None:
        raise HTTPException(status_code=422, detail="transfer requires to_account_id")
    if body.type != TransactionType.transfer and body.to_account_id is not None:
        raise HTTPException(status_code=422, detail="to_account_id only allowed for transfer")

    # Resolve currency and validate opening_balance account type
    currency = body.currency
    if currency is None:
        acc = await _get_account_or_404(body.account_id, current_user.id, session)
        currency = acc.currency
    else:
        acc = await _get_account_or_404(body.account_id, current_user.id, session)

    if body.type == TransactionType.opening_balance and acc.type in _LIABILITY_TYPES:
        raise HTTPException(
            status_code=422,
            detail="opening_balance cannot be applied to liability accounts (credit_card, loan)",
        )

    if body.type == TransactionType.opening_balance:
        existing = (await session.execute(
            select(Transaction.id).where(
                Transaction.account_id == body.account_id,
                Transaction.type == TransactionType.opening_balance,
                Transaction.deleted_at.is_(None),
            ).limit(1)
        )).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=422,
                detail="An opening_balance transaction already exists for this account",
            )

    if body.to_account_id:
        await _get_account_or_404(body.to_account_id, current_user.id, session)

    txn = Transaction(
        id=uuid.uuid4(),
        user_id=current_user.id,
        type=body.type,
        transacted_at=body.transacted_at,
        amount=body.amount,
        currency=currency,
        description=body.description,
        notes=body.notes,
        account_id=body.account_id,
        payment_method_id=body.payment_method_id,
        payee_id=body.payee_id,
        to_account_id=body.to_account_id,
        to_amount=body.to_amount,
        to_currency=body.to_currency,
        subscription_id=body.subscription_id,
        spending_classification=body.spending_classification,
    )
    session.add(txn)
    await session.flush()

    await _apply_balance(txn, session, current_user.id, sign=+1)
    await _set_joins(txn.id, body.category_ids, body.tag_ids, body.budget_ids, session)
    await _sync_piggy_bank(txn, body.piggy_bank_id, session)
    await session.commit()
    await session.refresh(txn)
    return await _to_response(txn, session)


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    type: TransactionType | None = None,
    account_id: uuid.UUID | None = None,
    payee_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    tag_id: uuid.UUID | None = None,
    budget_id: uuid.UUID | None = None,
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    cursor: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TransactionListResponse:
    base_where = [Transaction.user_id == current_user.id]

    if not include_deleted:
        base_where.append(Transaction.deleted_at.is_(None))
    if type is not None:
        base_where.append(Transaction.type == type)
    if account_id is not None:
        base_where.append(Transaction.account_id == account_id)
    if payee_id is not None:
        base_where.append(Transaction.payee_id == payee_id)
    if from_date is not None:
        base_where.append(Transaction.transacted_at >= from_date)
    if to_date is not None:
        base_where.append(Transaction.transacted_at <= to_date)
    if category_id is not None:
        base_where.append(
            Transaction.id.in_(
                select(transaction_categories.c.transaction_id).where(
                    transaction_categories.c.category_id == category_id
                )
            )
        )
    if tag_id is not None:
        base_where.append(
            Transaction.id.in_(
                select(transaction_tags.c.transaction_id).where(
                    transaction_tags.c.tag_id == tag_id
                )
            )
        )
    if budget_id is not None:
        base_where.append(
            Transaction.id.in_(
                select(transaction_budgets.c.transaction_id).where(
                    transaction_budgets.c.budget_id == budget_id
                )
            )
        )

    # Total count (no cursor, no limit)
    count_stmt = select(func.count()).select_from(Transaction).where(*base_where)
    total: int = (await session.execute(count_stmt)).scalar_one()

    stmt = select(Transaction).where(*base_where)

    # Cursor (transacted_at DESC, id DESC)
    if cursor is not None:
        cur_ts, cur_id = _decode_cursor(cursor)
        stmt = stmt.where(
            (Transaction.transacted_at < cur_ts)
            | (
                (Transaction.transacted_at == cur_ts)
                & (Transaction.id < cur_id)
            )
        )

    stmt = stmt.order_by(Transaction.transacted_at.desc(), Transaction.id.desc())
    stmt = stmt.limit(limit + 1)

    rows = (await session.execute(stmt)).scalars().all()

    has_more = len(rows) > limit
    items = rows[:limit]

    next_cursor: str | None = None
    if has_more and items:
        last = items[-1]
        next_cursor = _encode_cursor(last.transacted_at, last.id)

    responses = [await _to_response(t, session) for t in items]
    return TransactionListResponse(items=responses, next_cursor=next_cursor, total=total)


@router.get("/{txn_id}", response_model=TransactionResponse)
async def get_transaction(
    txn_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TransactionResponse:
    txn = await _get_txn_or_404(txn_id, current_user, session)
    return await _to_response(txn, session)


@router.patch("/{txn_id}", response_model=TransactionResponse)
async def patch_transaction(
    txn_id: uuid.UUID,
    body: TransactionPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TransactionResponse:
    txn = await _get_txn_or_404(txn_id, current_user, session)

    # Reverse old balance effect before applying changes
    await _apply_balance(txn, session, current_user.id, sign=-1)

    # Apply scalar field patches. exclude_unset=True keeps fields the client
    # did NOT send out of the patch entirely, while still allowing them to
    # send explicit nulls to clear nullable fields (payee_id, to_account_id, …).
    scalar_fields = {
        "type", "transacted_at", "amount", "currency", "description", "notes",
        "external_ref",
        "account_id", "payment_method_id", "payee_id", "to_account_id", "to_amount",
        "to_currency", "subscription_id", "spending_classification",
    }
    patch_data = body.model_dump(
        exclude_unset=True, exclude={"category_ids", "tag_ids", "budget_ids", "piggy_bank_id"}
    )

    # Validate transfer constraint after patching
    new_type = patch_data.get("type", txn.type)
    new_to_account = (
        patch_data["to_account_id"] if "to_account_id" in patch_data else txn.to_account_id
    )
    if new_type == TransactionType.transfer and new_to_account is None:
        raise HTTPException(status_code=422, detail="transfer requires to_account_id")
    if new_type != TransactionType.transfer and new_to_account is not None:
        raise HTTPException(status_code=422, detail="to_account_id only allowed for transfer")

    if new_type == TransactionType.opening_balance:
        acc = await _get_account_or_404(txn.account_id, current_user.id, session)
        if acc.type in _LIABILITY_TYPES:
            raise HTTPException(
                status_code=422,
                detail="opening_balance cannot be applied to liability accounts (credit_card, loan)",
            )

    for field, value in patch_data.items():
        if field in scalar_fields:
            setattr(txn, field, value)

    await session.flush()

    # Re-apply new balance effect
    await _apply_balance(txn, session, current_user.id, sign=+1)

    # Update joins if provided. For each list, None = leave alone, [] = clear.
    if body.category_ids is not None or body.tag_ids is not None or body.budget_ids is not None:
        existing_cats = await _fetch_category_ids(txn.id, session)
        existing_tags = await _fetch_tag_ids(txn.id, session)
        existing_budgets = await _fetch_budget_ids(txn.id, session)
        await _set_joins(
            txn.id,
            body.category_ids if body.category_ids is not None else existing_cats,
            body.tag_ids if body.tag_ids is not None else existing_tags,
            body.budget_ids if body.budget_ids is not None else existing_budgets,
            session,
        )

    # piggy_bank_id=None in the patch means "leave alone"; explicit null not supported
    # (users unlink via the piggy bank detail page). Only sync when explicitly provided.
    if "piggy_bank_id" in body.model_fields_set:
        await _sync_piggy_bank(txn, body.piggy_bank_id, session)

    await session.commit()
    await session.refresh(txn)
    return await _to_response(txn, session)


@router.delete("/{txn_id}", status_code=204)
async def delete_transaction(
    txn_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    txn = await _get_txn_or_404(txn_id, current_user, session)
    await _apply_balance(txn, session, current_user.id, sign=-1)
    txn.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{txn_id}/restore", response_model=TransactionResponse)
async def restore_transaction(
    txn_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TransactionResponse:
    txn = await _get_txn_or_404(txn_id, current_user, session, include_deleted=True)
    if txn.deleted_at is None:
        raise HTTPException(status_code=400, detail="Transaction is not deleted")
    if datetime.now(UTC) - txn.deleted_at.replace(tzinfo=UTC) > _SOFT_DELETE_WINDOW:
        raise HTTPException(
            status_code=410, detail="Transaction deleted more than 30 days ago; cannot restore"
        )
    txn.deleted_at = None
    await _apply_balance(txn, session, current_user.id, sign=+1)
    await session.commit()
    await session.refresh(txn)
    return await _to_response(txn, session)
