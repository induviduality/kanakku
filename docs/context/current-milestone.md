# Milestone 4: Splits (in progress)

## Next Task: Task 4.2 — Upfront Split Creation

### What to implement
- POST /splits endpoint with bundled payload:
  - split + all shares in one request body
  - Atomic: split, shares, invariant check all in one DB transaction
  - Only expense transactions may be wrapped (validate type)
  - Transaction must not already have a split (expense_transaction_id UNIQUE enforces this at DB level)
- Schemas: SplitCreate (expense_transaction_id, notes, shares: list[SplitShareCreate]), SplitShareCreate (payee_id nullable, amount, notes)
- SplitResponse, SplitShareResponse
- Router: app/routers/splits.py — POST /splits
- Tests: happy path, shares sum mismatch (400), non-expense transaction (400), duplicate split (409), rollback on any error

### Files to create/modify
- backend/app/schemas/split.py
- backend/app/routers/splits.py
- backend/app/main.py (register router)
- backend/tests/test_splits.py
