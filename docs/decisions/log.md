# Decision Log
The format: date, title, context, decision, alternatives, what it affects.

## 2026-05-23 — transaction_budgets join table created without budget_id FK

**Context:** Task 3.1 requires a transaction_budgets join table, but the budgets table doesn't exist until M5.

**Decision:** Created transaction_budgets now with transaction_id FK → transactions, and budget_id as a plain UUID column (no FK). The FK to budgets will be added in the M5 migration when the budgets table exists.

**Alternatives considered:**
- Skip transaction_budgets until M5 — would mean PATCH /transactions accepting budget_ids couldn't be added in M3
- Use a deferred FK — not supported cleanly in SQLAlchemy / Postgres without separate ALTER TABLE

**Affects:** `0008_transactions.py`, `transaction.py`, `transactions.py` router (budget_ids accepted in create/patch).

## 2026-05-23 — Payee response extended with default_category_ids

**Context:** TransactionForm (Task 3.3) needs to auto-populate categories when a payee is selected. The payee_default_categories join table exists (from M2.5) but wasn't exposed in the API.

**Decision:** Added `default_category_ids: list[uuid.UUID]` to PayeeResponse. All payee router endpoints now query the join table and include the field. The Table reference (payee_default_categories) was added to category.py to enable this query.

**Alternatives considered:**
- Separate GET /payees/{id}/categories endpoint — extra round trip, more complex frontend
- Skip auto-populate in M3 — doesn't meet prompt_plan spec

**Affects:** `app/models/category.py`, `app/schemas/payee.py`, `app/routers/payees.py`, `frontend/src/api/payees.ts`.

## 2026-05-23 — Dev mode toggled via .dev-config.yml + loader script rather than .env editing

**Context:** User wanted a single touchpoint to toggle dev mode for backend, frontend, and infra independently without editing multiple files or the .env directly.

**Decision:** Separate config file (`.dev-config.yml`) + a Python loader script (`infra/load-dev-config.py`) that reads the YAML and exports shell-ready env vars. Script also exports `DEV_MODE` for backward compat alongside the new `DEV_MODE_BACKEND / DEV_MODE_FRONTEND / DEV_MODE_INFRA`.

**Alternatives considered:**
- Edit `.env` directly — defeats the single-touchpoint goal and risks committing secrets
- Shell alias / Makefile target — less discoverable, doesn't compose well across presets

**Affects:** `.dev-config.yml`, `infra/load-dev-config.py`, `infra/env.example`, `DEV_MODE_SETUP.md`. No backend code changes; backend still reads `DEV_MODE` as before.