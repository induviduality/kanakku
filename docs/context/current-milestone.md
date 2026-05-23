# Milestone 5: Budgets — IN PROGRESS

## Completed Tasks
- 5.1 Budgets Schema
- 5.2 Recurrence Expansion
- 5.3 Budgets CRUD with Scope Semantics
- 5.4 Transaction-Budget Linking

## Remaining Tasks
- 5.5 Frontend — Budgets

## Next Task: 5.5 — Frontend Budgets

### Pages
- pages/Budgets.tsx: list with progress bars (spent / amount), link to BudgetDetail
- pages/BudgetDetail.tsx: budget info + transactions list with link_type indicator
- pages/BudgetForm.tsx: create/edit form (name, amount, currency, type toggle, recurrence fields for recurring, category multi-select)

### Dialogs (recurring only)
- Edit dialog: "Also affect the current period?" checkbox (default checked → current_and_future; unchecked → future_only)
- Delete dialog: three radio options (this instance / current and future / future only)
- Ad-hoc: direct edit/delete (no dialog)

### API hooks
- frontend/src/api/budgets.ts: types + useGetBudgets, useGetBudget, useCreateBudget, usePatchBudget, useDeleteBudget, useGetBudgetTransactions

### Tests
- per page (Budgets, BudgetDetail, BudgetForm)

### What to implement
- POST /transactions and PATCH /transactions/{id} already accept budget_ids (from M3 stub); wire them to actually insert into transaction_budgets
- GET /budgets/{id}/transactions: list transactions linked to this budget, with optional ?from and ?to date filters scoped to the budget's instance window
- Spent calc: explicit transaction_budgets links + category-match auto-include (transactions whose category_id is in budget_categories for this budget and transacted_at in window)
- Response distinguishes: `linked_explicitly` vs `linked_via_category` per transaction

### Files
- backend/app/routers/budgets.py: add GET /budgets/{id}/transactions
- backend/app/routers/transactions.py: wire budget_ids on create/patch
- backend/tests/test_budget_linking.py

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
