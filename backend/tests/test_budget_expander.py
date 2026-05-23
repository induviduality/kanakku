"""Tests for budget_expander.py — no DB required."""

import uuid
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

from app.models.budget import BudgetType
from app.services.budget_expander import expand_budget


def _budget(**kwargs) -> MagicMock:
    """Create a Budget-like mock with sensible defaults."""
    defaults = dict(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="Test Budget",
        amount=Decimal("1000.00"),
        currency="INR",
        period=None,
        start_date=None,
        end_date=None,
        type=BudgetType.adhoc,
        recurrence_rule=None,
        parent_budget_id=None,
        is_modified_instance=False,
        is_active=True,
    )
    defaults.update(kwargs)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


class TestRecurringMonthly:
    def test_monthly_rrule_12_instances_in_year(self):
        budget = _budget(
            type=BudgetType.recurring,
            recurrence_rule="FREQ=MONTHLY",
            start_date=date(2026, 1, 1),
            amount=Decimal("5000.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 12, 31))
        assert len(instances) == 12

    def test_monthly_instance_amounts_match_template(self):
        budget = _budget(
            type=BudgetType.recurring,
            recurrence_rule="FREQ=MONTHLY",
            start_date=date(2026, 1, 1),
            amount=Decimal("3000.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 12, 31))
        assert all(i.amount == 3000.0 for i in instances)
        assert all(not i.is_modified for i in instances)

    def test_monthly_start_dates_are_first_of_month(self):
        budget = _budget(
            type=BudgetType.recurring,
            recurrence_rule="FREQ=MONTHLY",
            start_date=date(2026, 1, 1),
            amount=Decimal("1000.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 3, 31))
        starts = [i.start_date for i in instances]
        assert starts == [date(2026, 1, 1), date(2026, 2, 1), date(2026, 3, 1)]

    def test_window_filters_out_of_range_occurrences(self):
        budget = _budget(
            type=BudgetType.recurring,
            recurrence_rule="FREQ=MONTHLY",
            start_date=date(2026, 1, 1),
            amount=Decimal("1000.00"),
        )
        instances = expand_budget(budget, date(2026, 6, 1), date(2026, 8, 31))
        assert len(instances) == 3
        assert instances[0].start_date == date(2026, 6, 1)


class TestRecurringWeekly:
    def test_weekly_rrule_produces_4_or_5_in_a_month(self):
        budget = _budget(
            type=BudgetType.recurring,
            recurrence_rule="FREQ=WEEKLY",
            start_date=date(2026, 1, 5),  # Monday
            amount=Decimal("500.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 1, 31))
        assert 4 <= len(instances) <= 5

    def test_weekly_all_instances_are_not_modified(self):
        budget = _budget(
            type=BudgetType.recurring,
            recurrence_rule="FREQ=WEEKLY",
            start_date=date(2026, 1, 5),
            amount=Decimal("500.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 1, 31))
        assert all(not i.is_modified for i in instances)


class TestModifiedInstanceOverride:
    def test_modified_instance_replaces_template_for_matching_start_date(self):
        template_id = uuid.uuid4()
        override_id = uuid.uuid4()

        template = _budget(
            id=template_id,
            type=BudgetType.recurring,
            recurrence_rule="FREQ=MONTHLY",
            start_date=date(2026, 1, 1),
            amount=Decimal("5000.00"),
        )
        modified = _budget(
            id=override_id,
            type=BudgetType.adhoc,
            parent_budget_id=template_id,
            is_modified_instance=True,
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
            amount=Decimal("7500.00"),
        )

        instances = expand_budget(
            template,
            date(2026, 1, 1),
            date(2026, 3, 31),
            modified_instances=[modified],
        )
        assert len(instances) == 3
        march = next(i for i in instances if i.start_date == date(2026, 3, 1))
        assert march.is_modified is True
        assert march.amount == 7500.0
        assert march.modified_budget_id == override_id

    def test_non_overridden_months_keep_template_amount(self):
        template_id = uuid.uuid4()
        template = _budget(
            id=template_id,
            type=BudgetType.recurring,
            recurrence_rule="FREQ=MONTHLY",
            start_date=date(2026, 1, 1),
            amount=Decimal("5000.00"),
        )
        modified = _budget(
            id=uuid.uuid4(),
            parent_budget_id=template_id,
            is_modified_instance=True,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            amount=Decimal("6000.00"),
        )
        instances = expand_budget(
            template,
            date(2026, 1, 1),
            date(2026, 3, 31),
            modified_instances=[modified],
        )
        jan = next(i for i in instances if i.start_date == date(2026, 1, 1))
        assert jan.is_modified is False
        assert jan.amount == 5000.0


class TestAdhocBudget:
    def test_adhoc_with_dates_returns_single_instance(self):
        budget = _budget(
            type=BudgetType.adhoc,
            start_date=date(2026, 12, 1),
            end_date=date(2026, 12, 31),
            amount=Decimal("20000.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 12, 31))
        assert len(instances) == 1
        inst = instances[0]
        assert inst.start_date == date(2026, 12, 1)
        assert inst.end_date == date(2026, 12, 31)
        assert inst.amount == 20000.0
        assert inst.is_modified is False

    def test_adhoc_without_dates_active_returns_open_ended_instance(self):
        budget = _budget(
            type=BudgetType.adhoc,
            start_date=None,
            end_date=None,
            is_active=True,
            amount=Decimal("3000.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 12, 31))
        assert len(instances) == 1
        inst = instances[0]
        assert inst.start_date is None
        assert inst.end_date is None

    def test_adhoc_without_dates_inactive_returns_empty(self):
        budget = _budget(
            type=BudgetType.adhoc,
            start_date=None,
            end_date=None,
            is_active=False,
            amount=Decimal("3000.00"),
        )
        instances = expand_budget(budget, date(2026, 1, 1), date(2026, 12, 31))
        assert len(instances) == 0


class TestCategoryIds:
    def test_category_ids_propagated_to_instances(self):
        cat_ids = [uuid.uuid4(), uuid.uuid4()]
        budget = _budget(
            type=BudgetType.recurring,
            recurrence_rule="FREQ=MONTHLY",
            start_date=date(2026, 1, 1),
            amount=Decimal("1000.00"),
        )
        instances = expand_budget(
            budget,
            date(2026, 1, 1),
            date(2026, 2, 28),
            category_ids=cat_ids,
        )
        assert all(i.category_ids == cat_ids for i in instances)
