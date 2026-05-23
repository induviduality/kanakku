# Milestone 4: Splits (in progress)

## Next Task: Task 4.4 — Settle / Forgive Endpoints

### What to implement
- POST /splits/{split_id}/shares/{share_id}/settle
  - Body: settlement_transaction_id (income transaction)
  - Validates: share exists + belongs to split + belongs to user's split
  - Validates: status is pending (can't settle already-settled/forgiven)
  - Validates: settlement_transaction_id is an income txn owned by user, not already used
  - Sets: status=settled, settled_at=now(), settlement_transaction_id
- POST /splits/{split_id}/shares/{share_id}/forgive
  - Validates: share exists, status is pending
  - Sets: status=forgiven, forgiven_at=now()
- POST /splits/{split_id}/shares/{share_id}/unsettle
  - Reverses a settled share back to pending
  - Clears settled_at, settlement_transaction_id
  - Only allowed if status=settled
- Tests: all valid transitions + invalid transitions + auth guards

### Files to create/modify
- backend/app/routers/splits.py — add settle/forgive/unsettle sub-routes
- backend/app/schemas/split.py — add SettleRequest schema
- backend/tests/test_splits_settle.py
