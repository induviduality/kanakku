# Current Task: Task 2.2 — Accounts CRUD

## What I'm implementing
Account model, full CRUD + soft delete + restore, currency defaults from user settings.

## Files I'll work in
backend/app/models/account.py
backend/alembic/versions/0003_accounts.py
backend/app/routers/accounts.py
backend/app/schemas/account.py
backend/tests/test_accounts.py

## Key constraints to remember
- Account types: bank, cash, credit_card, loan
- Fields: id (UUID), user_id (FK→users CASCADE), name, type (enum), currency (str, defaults from user settings primary_currency), current_balance (Numeric, default 0), is_active (bool, default true), created_at, updated_at, deleted_at (nullable — soft delete)
- Soft delete: PATCH /{id}/delete sets deleted_at; restore: PATCH /{id}/restore clears it
- Deleted accounts excluded from list by default; 30-day purge rule (no endpoint yet, just enforce in model/test)
- Currency: if not provided at creation, pull from user's UserSettings.primary_currency
- All endpoints scoped to current_user.id — never cross-user

## Definition of done
pytest passes for accounts tests
