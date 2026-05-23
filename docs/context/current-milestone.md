# Milestone 3 Complete

All tasks 3.1–3.4 are done. The next milestone is Milestone 4: Splits.

## Next Task: Task 4.1 — Splits Schema + Invariant

### What to implement
- Split model (id, user_id, expense_transaction_id FK UNIQUE, notes, timestamps, deleted_at)
- SplitShare model (id, split_id FK, payee_id NULL FK, amount, status enum: pending/settled/forgiven, settled_at, settlement_transaction_id, forgiven_at, notes, timestamps)
- Application-level invariant validator: services/split_service.py validate_invariant(split_id)
- DB trigger: check_split_invariant() fired AFTER INSERT/UPDATE/DELETE on split_shares
- Migration: 0009_splits.py
- Tests: sum matches OK, sum mismatch raises, update breaking sum raises, delete breaking sum raises

### Files to create
backend/app/models/split.py
backend/app/services/split_service.py
backend/alembic/versions/0009_splits.py
backend/tests/test_splits_schema.py
