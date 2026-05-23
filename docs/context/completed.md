# Completed Milestones

## Milestone 5: Budgets (in progress)

### Task 5.5: Frontend — Budgets
- frontend/src/api/budgets.ts: Budget, BudgetCreate, BudgetPatch, BudgetTransactionItem, BudgetTransactionsResponse types; useGetBudgets, useGetBudget, useCreateBudget, usePatchBudget (with EditScope param), useDeleteBudget (with DeleteScope param), useGetBudgetTransactions hooks
- frontend/src/pages/Budgets.tsx: list with progress bars, ProgressBar component, DeleteScopeDialog (recurring: 3 radio options; adhoc: simple confirm), create modal with type toggle (adhoc/recurring), recurrence rule field, date range, category multi-select chips
- frontend/src/pages/BudgetDetail.tsx: budget info + spending progress bar, transactions list with link_type badge (explicit=indigo, category_match=gray), total_spent display
- frontend/src/pages/BudgetForm.tsx: create/edit form, ScopeDialog for recurring edits (checkbox "Also affect the current period?", default checked → current_and_future, unchecked → future_only)
- frontend/src/router.tsx: /budgets, /budgets/new, /budgets/$budgetId, /budgets/$budgetId/edit routes added
- frontend/src/test/handlers.ts: BUDGETS_RESPONSE, BUDGET_TRANSACTIONS_RESPONSE fixtures + MSW handlers for all budget endpoints
- Tests: Budgets (8), BudgetDetail (5), BudgetForm (4) = 17 tests

### Task 5.4: Transaction-Budget Linking
- app/routers/budgets.py: added GET /budgets/{id}/transactions — returns explicit links (transaction_budgets) and category-match links (transaction_categories overlapping budget_categories), deduplicates so explicit wins; total_spent sums expense amounts; BudgetTransactionItem includes link_type field; supports ?from and ?to date filters; transaction_budgets linking already wired in transactions router (M3)
- tests/test_budget_linking.py: 11 integration tests — create with budget_ids, patch to link, explicit link appears, category match appears, no duplication when both explicit+category, total_spent sum, date filter narrows, auth guard, cross-user 404, unlink removes

### Task 5.3: Budgets CRUD with Scope Semantics
- app/schemas/budget.py: BudgetCreate, BudgetPatch, BudgetResponse, EditScope (current_and_future/future_only), DeleteScope (instance/current_and_future/future_only)
- app/routers/budgets.py: POST /budgets, GET /budgets (?include_inactive), GET /budgets/{id}, PATCH /budgets/{id}?scope, DELETE /budgets/{id}?scope; edit future_only clones budget at next recurrence boundary; delete instance creates soft-deleted modified instance; delete future_only caps end_date; delete current_and_future soft-deletes; ad-hoc ignores scope
- app/main.py: budgets_router registered
- tests/test_budgets.py: 20 integration tests — create adhoc/recurring/with-categories, invalid amount, auth guard, list active/inactive/cross-user, get/404/cross-user, patch adhoc/current_and_future/future_only, delete adhoc/current_and_future/future_only/instance/auth

### Task 5.2: Recurrence Expansion
- app/services/budget_expander.py: expand_budget(budget, window_start, window_end, modified_instances, category_ids) → list[BudgetInstance]; BudgetInstance dataclass (budget_id, start_date, end_date, amount, is_modified, modified_budget_id, category_ids); handles recurring (RRULE via python-dateutil, period end = day before next occurrence), ad-hoc with dates (single instance), ad-hoc without dates active (open-ended), ad-hoc inactive (empty); modified instances override template by matching start_date
- tests/test_budget_expander.py: 12 pure-unit tests (no DB) — monthly 12 in a year, monthly amounts, monthly start dates, window filtering, weekly 4-5 in a month, weekly not-modified, modified override, non-overridden months, adhoc-with-dates, adhoc-without-dates-active, adhoc-without-dates-inactive, category_ids propagation

### Task 5.1: Budgets Schema
- app/models/budget.py: Budget model (id, user_id, name, amount, currency, period enum, start_date, end_date, type enum, recurrence_rule, parent_budget_id self-FK, is_modified_instance, is_active, notes, timestamps, deleted_at); BudgetType (recurring/adhoc), BudgetPeriod (daily/weekly/monthly/quarterly/yearly); budget_categories join table
- alembic/versions/0011_budgets.py: creates budgets + budget_categories tables; adds FK from transaction_budgets.budget_id → budgets.id (deferred from M3)
- app/models/__init__.py: Budget, BudgetType, BudgetPeriod, budget_categories registered
- tests/test_budgets_schema.py: 5 tests — recurring budget, adhoc with dates, adhoc without dates, budget_categories join, modified instance with parent FK

## Milestone 4: Splits (complete)

### Task 4.6: Frontend — Split UIs
- frontend/src/api/splits.ts: TypeScript types + TanStack Query hooks (useGetSplit, useCreateSplit, useBundleSplit, useSettleShare, useForgiveShare, useUnsettleShare)
- components/SplitSharesEditor.tsx: per-share rows (payee, amount, Fill button, remove), live balance display, role="alert" when imbalanced
- components/BundleAsSplitModal.tsx: Radix Dialog for retroactive bundle — income txn picker, forgiven shares, real-time user share calc
- pages/SplitDetail.tsx: shares table with status badges (pending=amber, settled=green, forgiven=gray), settle modal, forgive confirm, unsettle
- pages/TransactionForm.tsx: split toggle for expense type, integrates SplitSharesEditor, validates sum before submit
- pages/Transactions.tsx: "Bundle as Split" bulk action wired (active when exactly one expense selected)
- router.tsx: /splits/$splitId route added
- test/handlers.ts: MSW handlers for all split endpoints
- Tests: SplitSharesEditor (6), BundleAsSplitModal (5), SplitDetail (3)

### Task 4.5: Net Expense Calculation
- app/services/expense_calculator.py: net_expense(session, transaction_id) — returns transaction.amount for non-split; for split returns SUM(shares WHERE payee_id IS NULL OR status='forgiven') per FR-7.9
- alembic/versions/0010_net_expense_view.py: CREATE OR REPLACE VIEW transaction_with_net_amount with same logic in SQL (LEFT JOIN splits + COALESCE subquery)
- tests/test_expense_calculator.py: 7 tests — non-split full amount, user-own-only, forgiven included, settled excluded, all-forgiven no own share, fully-settled, missing txn raises

### Task 4.4: Settle / Forgive Endpoints
- app/schemas/split.py: added SettleRequest schema
- app/routers/splits.py: POST /splits/{id}/shares/{id}/settle (validates pending status, income txn ownership, not-already-used), /forgive (pending only), /unsettle (settled only, clears settled_at + settlement_transaction_id)
- tests/test_splits_settle.py: 13 tests — settle happy path, already-settled fail, settle-forgiven fail, wrong txn type (422), income already used (409), forgive happy path, forgive-settled fail, unsettle happy path, unsettle-pending fail, unsettle-forgiven fail, auth guard, share-not-found

### Task 4.3: Retroactive Bundling
- app/schemas/split.py: added ForgivenShareCreate and BundleCreate schemas
- app/routers/splits.py: POST /splits/bundle — validates expense type and ownership, checks no existing split (409), loads and validates each income leg (type, existence, not-already-settled), enforces FR-7.6 (income+forgiven ≤ expense), computes user own share as remainder, creates Split + settled/forgiven/pending shares atomically
- tests/test_splits_bundle.py: 10 tests — expense only, income leg, forgiven share, zero remainder, sum over expense (422), already bundled (409), nonexistent expense (404), nonexistent income leg (404), income leg already settled (409), non-income leg (422), auth guard (401)

### Task 4.2: Upfront Split Creation
- app/schemas/split.py: SplitShareCreate (payee_id nullable, amount, notes), SplitCreate (expense_transaction_id, notes, shares), SplitShareResponse, SplitResponse
- app/routers/splits.py: POST /splits (validates expense type, duplicate, share sum; creates atomically; calls validate_invariant before commit), GET /splits/{id}
- app/main.py: splits_router registered
- tests/test_splits.py: 9 tests — happy path, GET, sum mismatch (422), income txn rejected (422), transfer txn rejected (422), nonexistent txn (404), duplicate (409), empty shares (422), auth guard (401), cross-user 404

### Task 4.1: Splits Schema + Invariant
- app/models/split.py: Split (id, user_id FK→users CASCADE, expense_transaction_id FK→transactions UNIQUE RESTRICT, notes, timestamps, deleted_at) and SplitShare (id, split_id FK→splits CASCADE, payee_id FK→payees SET NULL nullable, amount Numeric 15,2, status enum pending/settled/forgiven, settled_at, settlement_transaction_id FK→transactions SET NULL nullable, forgiven_at, notes, timestamps)
- app/services/split_service.py: SplitInvariantError + validate_invariant(session, split_id) — sums split_shares.amount and compares to parent transaction.amount
- alembic/versions/0009_splits.py: creates splits + split_shares tables; installs check_split_invariant() PL/pgSQL function + DEFERRABLE INITIALLY DEFERRED constraint trigger trg_split_invariant on split_shares
- app/models/__init__.py: Split, SplitShare, SplitShareStatus registered
- tests/test_splits_schema.py: 8 tests — model creation, unique constraint, all statuses, application validator (OK + mismatch), DB trigger (OK, insert mismatch, update mismatch, delete mismatch)
- docs/CLAUDE.md: added step 5 (commit after each task before moving on)

## Setup Guide & README

- docs/SETUP.md: new "start here" guide with platform-specific install commands for three scenarios — Local PC (Windows/macOS), Raspberry Pi 5, Cloud VPS (Ubuntu 22.04/24.04). Covers OS-level prerequisites (Docker, Git, openssl), platform-specific install commands (winget/brew/apt/get.docker.com), DNS setup for VPS, and links to the relevant running.md section per scenario.
- README.md: replaced 2-line stub with navigation table linking SETUP.md, running.md, TDD.md, and decisions log.
- docs/running.md: added "First time? See SETUP.md" cross-reference at the top.
- docs/todo.md: Diagrams Backlog and Setup & Docs Backlog sections added.

## Milestone 3: Transactions (Tasks 3.1–3.4)

### Task 3.1: Transactions Schema
- app/models/transaction.py: Transaction model (type: expense/income/transfer only, amount Numeric 15,2, soft delete, all FK columns)
- Join tables in model file: transaction_categories, transaction_tags, transaction_budgets (budget_id has no FK yet — added in M5)
- app/models/category.py: added payee_default_categories Table reference (needed by payees router in M3.3)
- alembic/versions/0008_transactions.py: migration with indexes on (user_id, transacted_at DESC), (user_id, account_id, transacted_at DESC), (user_id, deleted_at); CHECK constraints for transfer/to_account_id and amount > 0
- tests/test_transactions_schema.py: 9 model-level tests covering all transaction types, constraint violations, join tables, soft delete

### Task 3.2: Transactions CRUD
- app/schemas/transaction.py: TransactionCreate, TransactionPatch, TransactionResponse (with category_ids, tag_ids), TransactionListResponse
- app/routers/transactions.py: POST/GET/GET{id}/PATCH/DELETE/restore — cursor pagination (transacted_at DESC, id DESC, base64), balance recompute on create/patch/delete/restore, all filters (?type, ?account_id, ?payee_id, ?category_id, ?tag_id, ?from, ?to, ?budget_id, ?cursor, ?limit)
- app/main.py: transactions_router registered
- app/schemas/payee.py: added default_category_ids field to PayeeResponse
- app/routers/payees.py: all endpoints now return default_category_ids from payee_default_categories join table
- tests/test_transactions.py: 22 tests — create all types, constraint enforcement, balance correctness (expense/income/transfer/delete/restore), list/filters, date range, cursor pagination, get/patch, categories+tags, soft delete, restore

### Task 3.3: Frontend — Transaction Form
- frontend/src/api/transactions.ts: Transaction types, useTransactions, useInfiniteTransactions, useCreateTransaction, usePatchTransaction, useDeleteTransaction
- frontend/src/api/payees.ts: Payee type updated with default_category_ids field
- frontend/src/components/Autocomplete.tsx: reusable combobox with inline-create (onInlineCreate prop)
- frontend/src/components/forms/TransactionForm.tsx: full form with type toggle (expense/income/transfer), date/time, amount+currency, account select, to_account (transfer only), payment method autocomplete, payee autocomplete with inline-create, category multi-select (auto-populated from payee.default_category_ids), tag multi-select, description, notes
- frontend/src/pages/TransactionForm.tsx: page wrapper with create/edit mode (editId search param)
- frontend/src/test/handlers.ts: TRANSACTIONS_RESPONSE fixture + MSW handlers for GET/POST/PATCH/DELETE /transactions; PAYEES_RESPONSE updated with default_category_ids
- frontend/src/pages/TransactionForm.test.tsx: 7 tests — field rendering, type toggle visibility, transfer to_account, category auto-populate, validation, onSubmit payload

### Task 3.4: Frontend — Transaction List
- frontend/src/pages/Transactions.tsx: infinite scroll (IntersectionObserver + useInfiniteTransactions), filter panel (type/account/payee/category/tag/date range), desktop table + mobile cards, bulk select checkboxes (UI ready), delete with ConfirmDialog
- frontend/src/router.tsx: /transactions and /transactions/new routes added
- frontend/src/pages/Transactions.test.tsx: 7 tests — loading state, list render, empty state, filter panel toggle, bulk select, delete confirm dialog, delete flow

## Task 2.8: Frontend — Entity Pages
- lib/api-client.ts: shared authenticated fetch helpers (apiGet/apiPost/apiPatch/apiDelete)
- components/DataTable.tsx: responsive table — desktop HTML table, mobile card list
- components/EntityModal.tsx: Radix Dialog wrapper for create/edit forms
- components/ConfirmDialog.tsx: Radix Dialog wrapper for destructive confirms
- api/accounts.ts: useAccounts, useCreateAccount, usePatchAccount, useDeleteAccount, usePaymentMethods, useCreatePaymentMethod, useDeletePaymentMethod
- api/payees.ts: usePayees (with search), useCreatePayee, usePatchPayee, useDeletePayee
- api/categories.ts: useCategories, useCreateCategory, usePatchCategory, useDeleteCategory, useSeedDefaultCategories
- api/tags.ts: useTags, useCreateTag, usePatchTag, useDeleteTag
- pages/Accounts.tsx: accordion list with inline PaymentMethodsPanel per account; create/edit/delete via modals
- pages/Payees.tsx: searchable list, create/edit/delete
- pages/Categories.tsx: list with seed-defaults button (shown only when empty), create/edit/delete
- pages/Tags.tsx: list with duplicate-name 409 error shown inline
- Tests: 7+ per page (49 total across all test files), patched to handle DataTable's dual desktop/mobile render in jsdom
- router.tsx: /settings, /accounts, /payees, /categories, /tags routes added

## Task 2.7: Frontend — Settings Page
- api/settings.ts: useSettings (GET /settings), usePatchSettings (PATCH /settings), UserSettings + SettingsPatch types
- components/forms/SettingsForm.tsx: dropdowns for currency, timezone, date format, number format; shows "Saved!" flash
- pages/Settings.tsx: loading/error states + SettingsForm
- test/handlers.ts: settings + all entity MSW handlers added
- pages/Settings.test.tsx: 5 tests (render, loading, error, save, fields)
- router.tsx: /settings route added

## Task 2.6: Tags CRUD
- app/models/tag.py: Tag (name, color nullable, soft delete)
- alembic/versions/0007_tags.py: partial unique index uq_tags_user_name_active (user_id, name WHERE deleted_at IS NULL) — soft-deleting frees the name for reuse
- app/schemas/tag.py: TagCreate, TagPatch, TagResponse
- app/routers/tags.py: POST/GET/GET{id}/PATCH/DELETE/restore — 409 on duplicate name, IntegrityError caught on create/patch/restore
- tests/test_tags.py: 14 tests — CRUD, 409 duplicate, patch-to-duplicate, soft-delete frees name, restore, scoping

## Task 2.5: Categories CRUD
- app/models/category.py: Category (name, icon, color, applicability enum: expense/income/both nullable, soft delete)
- alembic/versions/0006_categories.py: creates categories table + payee_default_categories join table (payee_id FK→payees, category_id FK→categories)
- app/schemas/category.py: CategoryCreate, CategoryPatch, CategoryResponse
- app/routers/categories.py: POST/GET/GET{id}/PATCH/DELETE/restore + POST /categories/seed-defaults (12 defaults, 409 if any exist)
- tests/test_categories.py: 13 tests — CRUD, applicability filter, soft delete, restore, seed-defaults, 409 on second seed

## Task 2.4: Payees CRUD
- app/models/payee.py: Payee (PayeeType StrEnum: merchant/person/business/other), soft delete, is_active
- alembic/versions/0005_payees.py: migration with indexes on (user_id) and (user_id, name)
- app/schemas/payee.py: PayeeCreate, PayeePatch, PayeeResponse
- app/routers/payees.py: POST/GET/GET{id}/PATCH/DELETE/restore — list supports ?search + ?type filter
- tests/test_payees.py: 12 tests — CRUD, search, type filter, soft delete, restore, scoping
- Note: payee_default_categories join deferred to Task 2.5 when categories are implemented

## Task 2.3: Payment Methods CRUD
- app/models/payment_method.py: PaymentMethod (PaymentMethodType StrEnum: debit_card/credit_card/netbanking/upi), soft delete
- alembic/versions/0004_payment_methods.py: migration with index on account_id
- app/schemas/payment_method.py: PaymentMethodCreate (upi_app validator), PaymentMethodPatch, PaymentMethodResponse
- app/routers/payment_methods.py: nested under /accounts/{account_id}/payment-methods — full CRUD + soft delete + restore
- tests/test_payment_methods.py: 10 tests — CRUD, upi_app validation, access scoping, soft delete, restore

## Task 2.2: Accounts CRUD
- app/models/account.py: Account (AccountType StrEnum: bank/cash/credit_card/loan), opening_balance + current_balance (Numeric 15,2), soft delete
- alembic/versions/0003_accounts.py: migration with index on user_id
- app/schemas/account.py: AccountCreate (currency optional — defaults to user settings), AccountPatch, AccountResponse
- app/routers/accounts.py: POST/GET/GET{id}/PATCH/DELETE/restore — 30-day restore window enforced (410 if expired)
- tests/test_accounts.py: 12 tests — CRUD, currency default, access control (cross-user 404), soft delete, restore, 400 on restore-not-deleted

## Task 2.1: User Settings
- app/models/user_settings.py: UserSettings (PK=user_id FK→users CASCADE), fields: primary_currency/timezone/date_format/number_format/updated_at, all with INR/Asia/Kolkata/DD/MM/YYYY/en-IN defaults
- alembic/versions/0002_user_settings.py: migration with upgrade/downgrade
- app/schemas/settings.py: SettingsResponse, SettingsPatch (all fields optional)
- app/routers/settings.py: GET /settings + PATCH /settings (auth required, scoped to current user)
- app/main.py: settings router added; dev_mode + lifespan restored (lost in earlier git restore)
- app/config.py: dev_mode field restored
- app/routers/auth.py: UserSettings auto-created on setup and accept-invite via session.flush() + add
- app/models/__init__.py: UserSettings registered for Base.metadata
- tests/test_settings.py: 7 tests — defaults on setup, defaults on invite, PATCH partial, PATCH empty noop, auth guards, scoping (user A ≠ user B)
- ruff clean, mypy clean; tests require Postgres

## Dev mode unified toggle
- `.dev-config.yml`: single file with `preset: all | be_only | fe_only | infra_only` options
- `infra/load-dev-config.py`: reads the YAML, prints `export DEV_MODE_BACKEND/FRONTEND/INFRA` + `DEV_MODE` (backward compat)
- `infra/env.example`: documents new env var names
- `DEV_MODE_SETUP.md`: usage docs with bash/PowerShell examples
- Load in shell: `source <(python infra/load-dev-config.py)` then run app normally

## Task 1.6: Frontend Auth Pages
- lib/auth-storage.ts: access token in memory, refresh token in localStorage; storeTokens/clearAuth helpers
- api/auth.ts: useSetup, useLogin, useAcceptInvite mutations (TanStack Query); fetchInviteInfo query fn; storeTokens on success
- pages/Setup.tsx: email+password form → POST /auth/setup → navigate /
- pages/Login.tsx: email+password form → POST /auth/login → navigate /
- pages/AcceptInvite.tsx: reads token from useSearch; fetches invite info (shows 410/404 errors); pre-fills locked email; POST /auth/accept-invite → navigate /
- components/AuthGuard.tsx: useEffect redirect to /login when not authenticated; renders children when authed
- router.tsx: TanStack Router with /, /setup, /login, /accept-invite routes
- App.tsx: RouterProvider; main.tsx: QueryClientProvider wrapper
- MSW setup: test/handlers.ts, test/server.ts; setup.ts starts/resets/stops server per test
- Tests: 15 passing (5 test files) — Setup (4), Login (3), AcceptInvite (5), AuthGuard (2), App (1)
- bun run test passes, bun run build clean

## Task 1.5: Invite Token System
- POST /auth/invites: auth required, generates secrets.token_urlsafe(32), stores SHA-256 hash, optional email lock, 7-day TTL
- GET /auth/invites/{token}/info: public; 404 unknown, 410 expired/used, 200 with expires_at + email
- POST /auth/accept-invite: validates token (404/410), email match check (400), duplicate email (409), creates user + session, marks used_at
- tests/test_auth_invite.py: 13 integration tests covering all paths

## Task 1.4: Login, Logout, Me, Refresh
- app/dependencies.py: get_current_user — decodes Bearer access JWT, loads User from DB, 401 on invalid/expired/deleted
- POST /auth/login: verifies email+password, creates Session row (token_hash=SHA-256 of refresh token), returns token pair
- POST /auth/logout: requires auth, deletes Session by refresh token hash; 204
- GET /auth/me: returns id, email, created_at for current user
- POST /auth/refresh: verifies refresh JWT + Session row, rotates token (delete old session, issue new), returns new pair
- schemas/auth.py: added LoginRequest, LogoutRequest, RefreshRequest, MeResponse
- tests/test_auth_endpoints.py: 13 integration tests covering all paths (need Postgres)

## Task 1.3: First-Run Setup
- app/routers/auth.py: POST /api/v1/auth/setup — creates first user, returns token pair; 404 once any user exists
- _assert_no_users_exist dependency: counts users via SELECT COUNT(*), raises 404 if > 0
- app/schemas/auth.py: SetupRequest (EmailStr + password), TokenResponse
- app/main.py: auth router included at /api/v1 prefix
- pyproject.toml: pydantic[email] dependency added (needed for EmailStr)
- tests/test_auth_setup.py: 6 integration tests (success, token validity, 404 on repeat, validation errors)

## Task 1.2: Password Hashing & JWT
- app/security/passwords.py: argon2id hash + verify (argon2-cffi)
- app/security/tokens.py: create_access_token (24h), create_refresh_token (30d), decode_token — all HS256 via python-jose; accept optional expires_delta for test overrides
- tests/test_security.py: 9 unit tests (no DB) — hash, verify, roundtrip, expiry, tampering, wrong-secret; all passing

## Task 1.1: Users + Sessions Schema
- app/models/user.py: User (id UUID, email UNIQUE, password_hash, created_at TIMESTAMPTZ, deleted_at nullable)
- app/models/session.py: Session (id UUID, user_id FK→users CASCADE, token_hash UNIQUE, expires_at, created_at)
- app/models/invite_token.py: InviteToken (id UUID, created_by_user_id FK→users CASCADE, token_hash UNIQUE, email nullable, expires_at, used_at nullable, created_at)
- alembic/versions/0001_users_sessions_invite_tokens.py: migration with full upgrade/downgrade
- tests/test_models_users.py: create user, email unique constraint, timestamps, session/invite_token creation
- tests/test_migration.py: synchronous round-trip test (upgrade head + downgrade base)
- conftest.py: added db_tables + db_session fixtures using async_sessionmaker
- Note: tests require a running Postgres; ruff + mypy clean

## Task 0.5: GitHub Actions CI
- .github/workflows/ci.yml: backend (ruff + mypy + pytest) and frontend (lint + test + build) jobs in parallel
- .github/workflows/ci-arm.yml: ARM64 Docker builds via QEMU on push to main
- Backend job has postgres:16 + redis:7 service containers
- Uses astral-sh/setup-uv and oven-sh/setup-bun official actions
- Not verified yet — needs a real PR against main to confirm green

## Task 0.4: Docker Compose Dev Setup
- docker-compose.yml: postgres:16, redis:7, api, worker, frontend, ollama, caddy
- api/worker mount source for hot reload in dev
- env.example: all vars from TDD 4.10 with clear comments
- infra/Makefile: up/down/restart/build/ps/logs/logs-api/logs-worker/migrate/psql/redis-shell/ollama-shell/ollama-init
- infra/scripts/init-ollama.sh: waits for Ollama readiness then pulls model
- Not runtime-tested (no Docker locally); files are deployment-ready

## Task 0.3: Frontend Bootstrap
- Vite + React 19 + TypeScript scaffolded with bun
- Tailwind CSS v4 via @tailwindcss/vite (CSS-first, no config file)
- Radix UI: dialog, dropdown-menu, tabs, toast
- TanStack Query + Router, Recharts, vite-plugin-pwa (disabled)
- Vitest + RTL + jsdom; `bun run test` passes, `bun run build` clean
- src/ structure: api/, components/, pages/, lib/, styles/, test/
- App.tsx: "Kanakku" h1 + Radix Dialog demo with Tailwind
- Dockerfile: multi-stage oven/bun + nginx:alpine (ARM64-compatible)
- Note: use `bun run test` (vitest), NOT `bun test` (bun's native runner)

## Task 0.2: Backend Bootstrap
- pyproject.toml (hatchling build, all deps, dev extras)
- app/main.py — FastAPI app with GET /health → {"status": "ok"}
- app/config.py — pydantic-settings loading all env vars from TDD 4.10
- app/db/session.py — async engine + session factory
- app/db/base.py — SQLAlchemy DeclarativeBase
- alembic.ini + alembic/env.py (async-compatible) + script.py.mako
- tests/conftest.py — async client + db_engine fixtures
- tests/test_health.py + tests/test_db.py
- Dockerfile — multi-stage, python:3.12-slim, ARM64-compatible

## Task 0.1: Monorepo Structure
- Created full directory layout: backend/, frontend/, infra/, .github/workflows/
- Root .gitignore (Python, Node, env files, OS, Docker volumes)
- README.md with 2-sentence project description linking to docs/TDD.md
- MIT LICENSE
- Root CLAUDE.md importing docs/CLAUDE.md via @-import
- infra/docker-compose.yml (postgres, backend, frontend, caddy)
- infra/Caddyfile (reverse proxy skeleton)
- infra/env.example (all env vars from TDD 4.10)
