# Milestone 4: Splits (in progress)

## Next Task: Task 4.5 — Net Expense Calculation

### What to implement
- services/expense_calculator.py: `net_expense(session, transaction_id) -> Decimal`
  - For a non-split expense: returns transaction.amount
  - For a split expense: returns user_own_share + forgiven_shares (FR-7.9)
    - user_own_share = shares where payee_id IS NULL and status != settled (sum)
    - forgiven_shares = shares where status = forgiven (sum)
    - pending shares from others do NOT reduce reported expense
- SQL view: `transaction_with_net_amount` (for future use in reporting/dashboard)
  - Columns: all transaction columns + net_amount
  - Alembic migration: 0010_net_expense_view.py
- Tests: all split combinations per FR-7.9 spec

### Files to create
- backend/app/services/expense_calculator.py
- backend/alembic/versions/0010_net_expense_view.py
- backend/tests/test_expense_calculator.py
