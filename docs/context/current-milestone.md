# Milestone 6: Subscriptions & Piggy Banks

## Completed Tasks
- 6.1 Subscriptions — COMPLETE
- 6.2 Piggy Banks — COMPLETE

## Next Task: 6.3 — Frontend: Subscriptions & Piggy Banks

### Pages
- pages/Subscriptions.tsx — list with status badges (green=upcoming, amber=due_soon, red=overdue)
- pages/SubscriptionForm.tsx — create/edit form
- pages/SubscriptionDetail.tsx — subscription info + history (linked transactions)
- pages/PiggyBanks.tsx — list with progress rings (SVG circle, progress_pct)
- pages/PiggyBankForm.tsx — create/edit form
- pages/PiggyBankDetail.tsx — piggy bank info + contributions list + add contribution form

### API hooks (frontend/src/api/)
- subscriptions.ts: Subscription type, SubscriptionCreate, useGetSubscriptions, useGetSubscription, useCreateSubscription, usePatchSubscription, useDeleteSubscription, useLinkTransaction, useGetHistory
- piggy_banks.ts: PiggyBank, PiggyBankCreate, ContributionCreate, useGetPiggyBanks, useGetPiggyBank, useCreatePiggyBank, usePatchPiggyBank, useDeletePiggyBank, useAddContribution, useRemoveContribution, useGetContributions

### Routes
- /subscriptions, /subscriptions/new, /subscriptions/$subId, /subscriptions/$subId/edit
- /piggy-banks, /piggy-banks/new, /piggy-banks/$piggyId, /piggy-banks/$piggyId/edit

### Tests
- Status badge colors (green/amber/red per status)
- Progress ring matches progress_pct
- Add contribution calls API and refetches

## Remaining Tasks
- 6.3 Frontend — Subscriptions & Piggy Banks

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
