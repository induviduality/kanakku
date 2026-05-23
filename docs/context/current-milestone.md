# Milestone 5: Budgets — IN PROGRESS

## Completed Tasks
- 5.1 Budgets Schema
- 5.2 Recurrence Expansion

## Remaining Tasks
- 5.3 Budgets CRUD with Scope Semantics
- 5.4 Transaction-Budget Linking
- 5.5 Frontend — Budgets

## Next Task: 5.3 — Budgets CRUD with Scope Semantics

### Endpoints
- POST /budgets
- GET /budgets (?include_inactive=true)
- GET /budgets/{id}
- PATCH /budgets/{id}?scope=current_and_future|future_only
- DELETE /budgets/{id}?scope=instance|current_and_future|future_only

### Edit semantics
- future_only: clone budget at next recurrence boundary; old gets end_date set
- current_and_future: edit in place
- ad-hoc: scope ignored, direct edit

### Delete semantics
- instance: create a modified instance with amount=0 (treated as deleted)
- future_only: set end_date = current occurrence end
- current_and_future: soft delete (set deleted_at)
- ad-hoc: scope ignored, soft delete

### Files
- backend/app/schemas/budget.py
- backend/app/routers/budgets.py
- backend/app/main.py (register router)
- backend/tests/test_budgets.py (every scope path)
