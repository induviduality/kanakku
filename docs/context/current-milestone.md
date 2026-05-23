# Milestone 2 Complete

All tasks 2.1–2.8 are done. The next milestone is Milestone 3: Transactions.

## Next Task: Task 3.1 — Transactions Schema

### What to implement
- Transaction model with all fields
- Join tables (transaction_categories, transaction_tags)
- Indexes
- Constraints (transfer requires to_account_id, type enum: expense/income/transfer only)
- Tests

### Files to create
backend/app/models/transaction.py
backend/alembic/versions/0008_transactions.py
backend/tests/test_transactions_schema.py (model-level tests)

### Key constraints
- type: expense | income | transfer (NOT split_parent)
- transfer requires to_account_id
- amount: Numeric(15,2), must be positive
- currency: str, defaults to account's currency
- transaction_categories: (transaction_id, category_id)
- transaction_tags: (transaction_id, tag_id)
- Soft delete + 30-day restore
