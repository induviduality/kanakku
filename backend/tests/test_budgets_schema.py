"""Schema tests for Budget and budget_categories."""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import insert, select

from app.models.budget import Budget, BudgetPeriod, BudgetType, budget_categories
from app.models.category import Category
from app.models.user import User
from app.models.user_settings import UserSettings


async def _make_user(session):
    user = User(id=uuid.uuid4(), email=f"u{uuid.uuid4().hex[:6]}@test.com", password_hash="x")
    session.add(user)
    await session.flush()
    session.add(UserSettings(user_id=user.id))
    await session.flush()
    return user


@pytest.mark.asyncio
async def test_create_recurring_budget(db_session):
    user = await _make_user(db_session)

    budget = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Monthly Groceries",
        amount=Decimal("5000.00"),
        currency="INR",
        period=BudgetPeriod.monthly,
        start_date=date(2026, 1, 1),
        type=BudgetType.recurring,
        recurrence_rule="FREQ=MONTHLY",
        is_active=True,
    )
    db_session.add(budget)
    await db_session.flush()

    result = await db_session.execute(
        select(Budget).where(Budget.id == budget.id)
    )
    fetched = result.scalar_one()
    assert fetched.name == "Monthly Groceries"
    assert fetched.type == BudgetType.recurring
    assert fetched.recurrence_rule == "FREQ=MONTHLY"
    assert fetched.period == BudgetPeriod.monthly
    assert fetched.amount == Decimal("5000.00")
    assert fetched.is_modified_instance is False


@pytest.mark.asyncio
async def test_create_adhoc_budget_with_dates(db_session):
    user = await _make_user(db_session)

    budget = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Holiday Budget",
        amount=Decimal("20000.00"),
        currency="INR",
        start_date=date(2026, 12, 1),
        end_date=date(2026, 12, 31),
        type=BudgetType.adhoc,
        is_active=True,
    )
    db_session.add(budget)
    await db_session.flush()

    result = await db_session.execute(
        select(Budget).where(Budget.id == budget.id)
    )
    fetched = result.scalar_one()
    assert fetched.type == BudgetType.adhoc
    assert fetched.start_date == date(2026, 12, 1)
    assert fetched.end_date == date(2026, 12, 31)
    assert fetched.recurrence_rule is None
    assert fetched.period is None


@pytest.mark.asyncio
async def test_create_adhoc_budget_without_dates(db_session):
    user = await _make_user(db_session)

    budget = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Open Dining Budget",
        amount=Decimal("3000.00"),
        currency="INR",
        type=BudgetType.adhoc,
        is_active=True,
    )
    db_session.add(budget)
    await db_session.flush()

    result = await db_session.execute(
        select(Budget).where(Budget.id == budget.id)
    )
    fetched = result.scalar_one()
    assert fetched.type == BudgetType.adhoc
    assert fetched.start_date is None
    assert fetched.end_date is None
    assert fetched.is_active is True


@pytest.mark.asyncio
async def test_budget_categories_join(db_session):
    user = await _make_user(db_session)

    category = Category(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Groceries",
    )
    db_session.add(category)

    budget = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Food Budget",
        amount=Decimal("8000.00"),
        currency="INR",
        type=BudgetType.adhoc,
        is_active=True,
    )
    db_session.add(budget)
    await db_session.flush()

    await db_session.execute(
        insert(budget_categories).values(
            budget_id=budget.id, category_id=category.id
        )
    )
    await db_session.flush()

    result = await db_session.execute(
        select(budget_categories).where(
            budget_categories.c.budget_id == budget.id
        )
    )
    rows = result.all()
    assert len(rows) == 1
    assert rows[0].category_id == category.id


@pytest.mark.asyncio
async def test_modified_instance_parent_fk(db_session):
    user = await _make_user(db_session)

    template = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Monthly Bills",
        amount=Decimal("2000.00"),
        currency="INR",
        period=BudgetPeriod.monthly,
        start_date=date(2026, 1, 1),
        type=BudgetType.recurring,
        recurrence_rule="FREQ=MONTHLY",
    )
    db_session.add(template)
    await db_session.flush()

    modified = Budget(
        id=uuid.uuid4(),
        user_id=user.id,
        name="Monthly Bills (Mar override)",
        amount=Decimal("2500.00"),
        currency="INR",
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 31),
        type=BudgetType.adhoc,
        parent_budget_id=template.id,
        is_modified_instance=True,
    )
    db_session.add(modified)
    await db_session.flush()

    result = await db_session.execute(
        select(Budget).where(Budget.id == modified.id)
    )
    fetched = result.scalar_one()
    assert fetched.parent_budget_id == template.id
    assert fetched.is_modified_instance is True
