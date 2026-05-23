# Milestone 5: Budgets — IN PROGRESS

## Completed Tasks
- 5.1 Budgets Schema

## Remaining Tasks
- 5.2 Recurrence Expansion
- 5.3 Budgets CRUD with Scope Semantics
- 5.4 Transaction-Budget Linking
- 5.5 Frontend — Budgets

## Next Task: 5.2 — Recurrence Expansion

### What to implement

`backend/app/services/budget_expander.py`:
- `expand_budget(budget, window_start, window_end) -> list[BudgetInstance]`
  - recurring: parse RRULE via python-dateutil, return instances within window
  - ad-hoc with dates: single instance from dates
  - ad-hoc without dates, active: one open-ended instance
- `BudgetInstance` dataclass: (budget_id, start_date, end_date, amount, is_modified, modified_budget_id, categories)
- If a modified instance exists for a given start_date, use it instead of the template

`backend/tests/test_budget_expander.py`:
- monthly RRULE → 12 instances in a year
- weekly RRULE → ~4-5 in a month
- modified instance override
- ad-hoc with dates
- ad-hoc without dates (open-ended)
