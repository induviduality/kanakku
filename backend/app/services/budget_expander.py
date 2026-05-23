"""Budget recurrence expansion service."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from dateutil.rrule import rrulestr

from app.models.budget import Budget, BudgetType


@dataclass
class BudgetInstance:
    budget_id: uuid.UUID
    start_date: date | None
    end_date: date | None
    amount: float
    is_modified: bool
    modified_budget_id: uuid.UUID | None
    category_ids: list[uuid.UUID] = field(default_factory=list)


def expand_budget(
    budget: Budget,
    window_start: date,
    window_end: date,
    modified_instances: list[Budget] | None = None,
    category_ids: list[uuid.UUID] | None = None,
) -> list[BudgetInstance]:
    """Return BudgetInstance list for the given date window.

    modified_instances: child Budget rows with is_modified_instance=True and
    parent_budget_id == budget.id; keyed by their start_date for override lookup.
    category_ids: category IDs associated with the template budget.
    """
    cats = category_ids or []
    overrides: dict[date, Budget] = {}
    if modified_instances:
        for m in modified_instances:
            if m.start_date is not None:
                overrides[m.start_date] = m

    if budget.type == BudgetType.recurring and budget.recurrence_rule:
        return _expand_recurring(budget, window_start, window_end, overrides, cats)

    # ad-hoc budget
    return _expand_adhoc(budget, overrides, cats)


def _expand_recurring(
    budget: Budget,
    window_start: date,
    window_end: date,
    overrides: dict[date, Budget],
    cats: list[uuid.UUID],
) -> list[BudgetInstance]:
    """Expand RRULE occurrences within [window_start, window_end]."""
    # dateutil rrulestr works with datetimes; anchor dtstart from budget start_date or window_start
    dtstart = datetime(
        budget.start_date.year if budget.start_date else window_start.year,
        budget.start_date.month if budget.start_date else window_start.month,
        budget.start_date.day if budget.start_date else window_start.day,
    )
    rule = rrulestr(budget.recurrence_rule, dtstart=dtstart)

    ws = datetime(window_start.year, window_start.month, window_start.day)
    we = datetime(window_end.year, window_end.month, window_end.day)

    instances: list[BudgetInstance] = []
    occurrences = list(rule.between(ws, we, inc=True))
    for i, occ in enumerate(occurrences):
        occ_date = occ.date()
        # Compute period end = day before next occurrence (or end_date if last)
        if i + 1 < len(occurrences):
            next_occ = occurrences[i + 1].date()
            period_end: date | None = next_occ - timedelta(days=1)
        elif budget.end_date:
            period_end = budget.end_date
        else:
            period_end = None

        override = overrides.get(occ_date)
        if override:
            instances.append(
                BudgetInstance(
                    budget_id=budget.id,
                    start_date=occ_date,
                    end_date=override.end_date if override.end_date else period_end,
                    amount=float(override.amount),
                    is_modified=True,
                    modified_budget_id=override.id,
                    category_ids=cats,
                )
            )
        else:
            instances.append(
                BudgetInstance(
                    budget_id=budget.id,
                    start_date=occ_date,
                    end_date=period_end,
                    amount=float(budget.amount),
                    is_modified=False,
                    modified_budget_id=None,
                    category_ids=cats,
                )
            )
    return instances


def _expand_adhoc(
    budget: Budget,
    overrides: dict[date, Budget],
    cats: list[uuid.UUID],
) -> list[BudgetInstance]:
    """Return a single instance for an ad-hoc budget."""
    if not budget.is_active and budget.start_date is None and budget.end_date is None:
        return []

    start = budget.start_date
    end = budget.end_date

    # Check if there's a modified instance covering this budget
    override = overrides.get(start) if start else None
    if override:
        return [
            BudgetInstance(
                budget_id=budget.id,
                start_date=override.start_date,
                end_date=override.end_date,
                amount=float(override.amount),
                is_modified=True,
                modified_budget_id=override.id,
                category_ids=cats,
            )
        ]

    return [
        BudgetInstance(
            budget_id=budget.id,
            start_date=start,
            end_date=end,
            amount=float(budget.amount),
            is_modified=False,
            modified_budget_id=None,
            category_ids=cats,
        )
    ]
