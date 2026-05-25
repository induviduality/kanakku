import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.budget import Budget, BudgetType, budget_categories
from app.models.category import Category
from app.models.transaction import (
    Transaction,
    TransactionType,
    transaction_budgets,
    transaction_categories,
)
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetPatch, BudgetResponse, DeleteScope, EditScope
from app.services.budget_expander import expand_budget

router = APIRouter(prefix="/budgets", tags=["budgets"])


class BudgetTransactionItem(BaseModel):
    id: uuid.UUID
    type: TransactionType
    transacted_at: datetime
    amount: Decimal
    currency: str
    description: str | None
    account_id: uuid.UUID
    payee_id: uuid.UUID | None
    category_ids: list[uuid.UUID]
    link_type: str  # "explicit" or "category_match"

    model_config = {"from_attributes": True}


class BudgetTransactionsResponse(BaseModel):
    items: list[BudgetTransactionItem]
    total_spent: Decimal


async def _get_budget_or_404(
    budget_id: uuid.UUID, user: User, session: AsyncSession
) -> Budget:
    result = await session.execute(
        select(Budget).where(
            Budget.id == budget_id,
            Budget.user_id == user.id,
            Budget.deleted_at.is_(None),
        )
    )
    b = result.scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    return b


async def _load_category_ids(budget_id: uuid.UUID, session: AsyncSession) -> list[uuid.UUID]:
    rows = (
        await session.execute(
            select(budget_categories.c.category_id).where(
                budget_categories.c.budget_id == budget_id
            )
        )
    ).all()
    return [r.category_id for r in rows]


async def _set_categories(
    budget_id: uuid.UUID,
    category_ids: list[uuid.UUID],
    user_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    # Validate all category_ids belong to the user
    if category_ids:
        result = await session.execute(
            select(Category.id).where(
                Category.id.in_(category_ids),
                Category.user_id == user_id,
                Category.deleted_at.is_(None),
            )
        )
        found = {r.id for r in result.all()}
        missing = set(category_ids) - found
        if missing:
            raise HTTPException(status_code=422, detail="Invalid category_ids")

    await session.execute(
        delete(budget_categories).where(budget_categories.c.budget_id == budget_id)
    )
    if category_ids:
        await session.execute(
            insert(budget_categories).values(
                [{"budget_id": budget_id, "category_id": cid} for cid in category_ids]
            )
        )


def _budget_response(
    b: Budget,
    category_ids: list[uuid.UUID],
    current_spent: Decimal = Decimal("0"),
) -> BudgetResponse:
    return BudgetResponse(
        id=b.id,
        user_id=b.user_id,
        name=b.name,
        amount=b.amount,
        currency=b.currency,
        period=b.period,
        start_date=b.start_date,
        end_date=b.end_date,
        type=b.type,
        recurrence_rule=b.recurrence_rule,
        parent_budget_id=b.parent_budget_id,
        is_modified_instance=b.is_modified_instance,
        is_active=b.is_active,
        notes=b.notes,
        category_ids=category_ids,
        current_spent=current_spent,
        created_at=b.created_at,
        updated_at=b.updated_at,
        deleted_at=b.deleted_at,
    )


async def _batch_spent(
    budget_ids: list[uuid.UUID], session: AsyncSession
) -> dict[uuid.UUID, Decimal]:
    """Return {budget_id: total_spent} for the given IDs in one query."""
    if not budget_ids:
        return {}
    import sqlalchemy as sa

    stmt = (
        sa.select(
            transaction_budgets.c.budget_id,
            sa.func.coalesce(sa.func.sum(Transaction.amount), Decimal("0")).label("spent"),
        )
        .join(Transaction, Transaction.id == transaction_budgets.c.transaction_id)
        .where(
            transaction_budgets.c.budget_id.in_(budget_ids),
            Transaction.type == TransactionType.expense,
            Transaction.deleted_at.is_(None),
        )
        .group_by(transaction_budgets.c.budget_id)
    )
    rows = (await session.execute(stmt)).all()
    return {r.budget_id: r.spent for r in rows}


def _next_recurrence_start(budget: Budget, from_date: date) -> date | None:
    """Return the start_date of the next occurrence after from_date."""
    window_end = date(from_date.year + 2, from_date.month, from_date.day)
    instances = expand_budget(budget, from_date, window_end)
    for inst in instances:
        if inst.start_date is not None and inst.start_date > from_date:
            return inst.start_date
    return None


@router.post("", response_model=BudgetResponse, status_code=201)
async def create_budget(
    body: BudgetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BudgetResponse:
    budget = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name=body.name,
        amount=body.amount,
        currency=body.currency,
        period=body.period,
        start_date=body.start_date,
        end_date=body.end_date,
        type=body.type,
        recurrence_rule=body.recurrence_rule,
        is_active=body.is_active,
        notes=body.notes,
    )
    session.add(budget)
    await session.flush()
    await _set_categories(budget.id, body.category_ids, user.id, session)
    await session.commit()
    await session.refresh(budget)
    cat_ids = await _load_category_ids(budget.id, session)
    return _budget_response(budget, cat_ids)


@router.get("", response_model=list[BudgetResponse])
async def list_budgets(
    include_inactive: bool = Query(False),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[BudgetResponse]:
    q = select(Budget).where(
        Budget.user_id == user.id,
        Budget.deleted_at.is_(None),
        Budget.is_modified_instance.is_(False),
    )
    if not include_inactive:
        q = q.where(Budget.is_active.is_(True))
    budgets = (await session.execute(q)).scalars().all()

    spent_map = await _batch_spent([b.id for b in budgets], session)

    result = []
    for b in budgets:
        cat_ids = await _load_category_ids(b.id, session)
        result.append(_budget_response(b, cat_ids, spent_map.get(b.id, Decimal("0"))))
    return result


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BudgetResponse:
    b = await _get_budget_or_404(budget_id, user, session)
    cat_ids = await _load_category_ids(b.id, session)
    return _budget_response(b, cat_ids)


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def patch_budget(
    budget_id: uuid.UUID,
    body: BudgetPatch,
    scope: EditScope = Query(EditScope.current_and_future),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BudgetResponse:
    b = await _get_budget_or_404(budget_id, user, session)

    if b.type == BudgetType.adhoc or scope == EditScope.current_and_future:
        # Edit in place
        if body.name is not None:
            b.name = body.name
        if body.amount is not None:
            b.amount = body.amount
        if body.currency is not None:
            b.currency = body.currency
        if body.period is not None:
            b.period = body.period
        if body.start_date is not None:
            b.start_date = body.start_date
        if body.end_date is not None:
            b.end_date = body.end_date
        if body.recurrence_rule is not None:
            b.recurrence_rule = body.recurrence_rule
        if body.is_active is not None:
            b.is_active = body.is_active
        if body.notes is not None:
            b.notes = body.notes
        if body.category_ids is not None:
            await _set_categories(b.id, body.category_ids, user.id, session)
        await session.commit()
        await session.refresh(b)
        cat_ids = await _load_category_ids(b.id, session)
        return _budget_response(b, cat_ids)

    # future_only: clone at next recurrence boundary
    today = date.today()
    next_start = _next_recurrence_start(b, today)
    if next_start is None:
        raise HTTPException(status_code=422, detail="No future recurrence found")

    # Cap old budget's end_date at one day before next_start
    b.end_date = next_start - timedelta(days=1)
    b.is_active = False

    # Load existing category_ids for the template
    old_cat_ids = await _load_category_ids(b.id, session)
    new_cat_ids = body.category_ids if body.category_ids is not None else old_cat_ids

    cloned = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name=body.name if body.name is not None else b.name,
        amount=body.amount if body.amount is not None else b.amount,
        currency=body.currency if body.currency is not None else b.currency,
        period=body.period if body.period is not None else b.period,
        start_date=next_start,
        end_date=body.end_date,
        type=b.type,
        recurrence_rule=(
            body.recurrence_rule if body.recurrence_rule is not None else b.recurrence_rule
        ),
        is_active=body.is_active if body.is_active is not None else True,
        notes=body.notes if body.notes is not None else b.notes,
    )
    session.add(cloned)
    await session.flush()
    await _set_categories(cloned.id, new_cat_ids, user.id, session)
    await session.commit()
    await session.refresh(cloned)
    cat_ids = await _load_category_ids(cloned.id, session)
    return _budget_response(cloned, cat_ids)


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: uuid.UUID,
    scope: DeleteScope = Query(DeleteScope.current_and_future),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    b = await _get_budget_or_404(budget_id, user, session)

    if b.type == BudgetType.adhoc:
        # ad-hoc: always soft delete regardless of scope
        b.deleted_at = datetime.now(UTC)
        await session.commit()
        return

    if scope == DeleteScope.current_and_future:
        b.deleted_at = datetime.now(UTC)

    elif scope == DeleteScope.future_only:
        today = date.today()
        next_start = _next_recurrence_start(b, today)
        if next_start is None:
            raise HTTPException(status_code=422, detail="No future recurrence found")
        b.end_date = next_start - timedelta(days=1)
        b.is_active = False

    elif scope == DeleteScope.instance:
        # Create a zero-amount modified instance for today's occurrence
        today = date.today()
        instances = expand_budget(b, today, today)
        if not instances:
            raise HTTPException(status_code=422, detail="No current instance found")
        inst = instances[0]

        existing = (
            await session.execute(
                select(Budget).where(
                    Budget.parent_budget_id == b.id,
                    Budget.start_date == inst.start_date,
                    Budget.is_modified_instance.is_(True),
                    Budget.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

        if existing is None:
            modified = Budget(
                id=uuid.uuid4(),
                user_id=user.id,
                name=b.name,
                amount=b.amount,
                currency=b.currency,
                start_date=inst.start_date,
                end_date=inst.end_date,
                type=BudgetType.adhoc,
                parent_budget_id=b.id,
                is_modified_instance=True,
                is_active=False,
                deleted_at=datetime.now(UTC),
            )
            session.add(modified)

    await session.commit()


@router.get("/{budget_id}/transactions", response_model=BudgetTransactionsResponse)
async def list_budget_transactions(
    budget_id: uuid.UUID,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BudgetTransactionsResponse:
    b = await _get_budget_or_404(budget_id, user, session)

    # Determine window from budget or query params
    win_start = from_date or b.start_date
    win_end = to_date or b.end_date

    # Explicit links
    explicit_q = (
        select(Transaction)
        .join(transaction_budgets, transaction_budgets.c.transaction_id == Transaction.id)
        .where(
            transaction_budgets.c.budget_id == budget_id,
            Transaction.user_id == user.id,
            Transaction.deleted_at.is_(None),
        )
    )
    if win_start:
        ws_dt = datetime(win_start.year, win_start.month, win_start.day)
        explicit_q = explicit_q.where(Transaction.transacted_at >= ws_dt)
    if win_end:
        we_dt = datetime(win_end.year, win_end.month, win_end.day, 23, 59, 59)
        explicit_q = explicit_q.where(Transaction.transacted_at <= we_dt)

    explicit_txns = (await session.execute(explicit_q)).scalars().all()
    explicit_ids = {t.id for t in explicit_txns}

    # Category-match links
    cat_ids = await _load_category_ids(budget_id, session)
    cat_match_txns: list[Transaction] = []
    if cat_ids:
        cat_q = (
            select(Transaction)
            .join(
                transaction_categories,
                transaction_categories.c.transaction_id == Transaction.id,
            )
            .where(
                transaction_categories.c.category_id.in_(cat_ids),
                Transaction.user_id == user.id,
                Transaction.deleted_at.is_(None),
                Transaction.id.not_in(explicit_ids),
            )
        )
        if win_start:
            cat_q = cat_q.where(Transaction.transacted_at >= ws_dt)
        if win_end:
            cat_q = cat_q.where(Transaction.transacted_at <= we_dt)
        cat_match_txns = list((await session.execute(cat_q)).scalars().all())

    items: list[BudgetTransactionItem] = []
    total_spent = Decimal("0")

    for txn in explicit_txns:
        cat_row_ids = [
            r.category_id
            for r in (
                await session.execute(
                    select(transaction_categories.c.category_id).where(
                        transaction_categories.c.transaction_id == txn.id
                    )
                )
            ).all()
        ]
        items.append(
            BudgetTransactionItem(
                id=txn.id,
                type=txn.type,
                transacted_at=txn.transacted_at,
                amount=txn.amount,
                currency=txn.currency,
                description=txn.description,
                account_id=txn.account_id,
                payee_id=txn.payee_id,
                category_ids=cat_row_ids,
                link_type="explicit",
            )
        )
        if txn.type == TransactionType.expense:
            total_spent += txn.amount

    for txn in cat_match_txns:
        cat_row_ids = [
            r.category_id
            for r in (
                await session.execute(
                    select(transaction_categories.c.category_id).where(
                        transaction_categories.c.transaction_id == txn.id
                    )
                )
            ).all()
        ]
        items.append(
            BudgetTransactionItem(
                id=txn.id,
                type=txn.type,
                transacted_at=txn.transacted_at,
                amount=txn.amount,
                currency=txn.currency,
                description=txn.description,
                account_id=txn.account_id,
                payee_id=txn.payee_id,
                category_ids=cat_row_ids,
                link_type="category_match",
            )
        )
        if txn.type == TransactionType.expense:
            total_spent += txn.amount

    return BudgetTransactionsResponse(items=items, total_spent=total_spent)


_SOFT_DELETE_WINDOW = timedelta(days=30)


@router.post("/{budget_id}/restore", response_model=BudgetResponse)
async def restore_budget(
    budget_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> BudgetResponse:
    result = await session.execute(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    b = result.scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    if b.deleted_at is None:
        raise HTTPException(status_code=400, detail="Budget is not deleted")
    if datetime.now(UTC) - b.deleted_at.replace(tzinfo=UTC) > _SOFT_DELETE_WINDOW:
        raise HTTPException(status_code=410, detail="Budget deleted more than 30 days ago; cannot restore")
    b.deleted_at = None
    await session.commit()
    await session.refresh(b)
    cat_ids = await _load_category_ids(b.id, session)
    return _budget_response(b, cat_ids)
