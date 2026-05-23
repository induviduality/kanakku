# Milestone 6: Subscriptions & Piggy Banks

## Completed Tasks
- 6.1 Subscriptions — COMPLETE

## Next Task: 6.2 — Piggy Banks

### Models
- PiggyBank(id, user_id, name, target_amount, currency, current_amount, target_date, notes, is_completed, timestamps, deleted_at)
- PiggyBankContribution(id, piggy_bank_id FK→piggy_banks, transaction_id FK→transactions, contribution_type enum(transfer/expense), amount, date, notes, created_at)

### Endpoints
- POST /piggy-banks — create
- GET /piggy-banks — list
- GET /piggy-banks/{id}
- PATCH /piggy-banks/{id}
- DELETE /piggy-banks/{id}
- POST /piggy-banks/{id}/restore
- POST /piggy-banks/{id}/contributions — add contribution (validates transaction belongs to user, auto-sets is_completed)
- DELETE /piggy-banks/{id}/contributions/{contrib_id} — remove (reverses current_amount, un-completes if needed)
- GET /piggy-banks/{id}/contributions — list

### Logic
- current_amount = sum of contributions; updated transactionally
- Auto-set is_completed = true when current_amount >= target_amount
- Auto-un-complete when contribution removed and current_amount drops below target

### Files
- backend/app/models/piggy_bank.py
- backend/app/schemas/piggy_bank.py
- backend/app/routers/piggy_banks.py
- backend/alembic/versions/0013_piggy_banks.py
- backend/tests/test_piggy_banks.py

## Remaining Tasks
- 6.3 Frontend — Subscriptions & Piggy Banks
