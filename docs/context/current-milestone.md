# Milestone 4: Splits (in progress)

## Next Task: Task 4.3 — Retroactive Bundling

### What to implement
- POST /splits/bundle endpoint
- Takes one expense_transaction_id + optional list of income_transaction_ids (settlement legs) + optional forgiven_shares (list of {payee_id, amount})
- Computes user_own_share = expense.amount - sum(income legs) - sum(forgiven)
- Validation: sum(income legs) + sum(forgiven) ≤ expense.amount (FR-7.6)
- Conflict detection: expense already has a split → 409
- Income transactions must belong to the same user, be income type, not already linked to a settlement
- Creates Split + SplitShare rows atomically:
  - One share per income leg (status=settled, settlement_transaction_id=leg.id)
  - One share per forgiven entry (status=forgiven)
  - One share for user's own portion (payee_id=null, status=pending) if remainder > 0
- Tests: all paths (happy path, sum over budget, already bundled, income txn not found, zero remainder)

### Files to create/modify
- backend/app/schemas/split.py — add BundleCreate schema
- backend/app/routers/splits.py — POST /splits/bundle
- backend/tests/test_splits_bundle.py
