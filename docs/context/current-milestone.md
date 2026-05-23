# Current Task: Task 2.5 — Categories CRUD

## What I'm implementing
Category model, CRUD + seed-defaults endpoint. Also wire up payee_default_categories join (deferred from 2.4).

## Files I'll work in
backend/app/models/category.py
backend/alembic/versions/0006_categories.py  (includes payee_default_categories table)
backend/app/routers/categories.py
backend/app/schemas/category.py
backend/tests/test_categories.py

## Key constraints to remember
- Category fields: id (UUID), user_id (FK→users CASCADE), name, icon (str nullable), color (str nullable), applicability (enum: expense/income/both, nullable), created_at, updated_at, deleted_at
- payee_default_categories: (payee_id FK→payees, category_id FK→categories, PK both) — join table added in this migration
- Seed-defaults endpoint: POST /categories/seed-defaults creates a standard set if none exist
- All endpoints scoped to current_user.id
- Soft delete + 30-day restore

## Definition of done
pytest passes for categories tests
