# Development Checklist — Personal Finance Tracker

> Companion to `prompt_plan.md` and `personal-finance-tracker-tdd.md`.
> Check items off as you progress. Follow TDD — write tests before implementing each item.

---

## Setup & Prerequisites

- [ ] Install Python 3.12+, Bun, Docker + Docker Compose
- [ ] Clone repo skeleton
- [ ] Copy `infra/env.example` to `.env` and fill in values
- [ ] Verify Docker Desktop / engine is running

---

## Milestone 0: Foundation

### Task 0.1: Monorepo Structure
- [ ] Create directory tree (`backend/`, `frontend/`, `infra/`, `docs/`, `.github/workflows/`)
- [ ] Add top-level `README.md` with project stub
- [ ] Add comprehensive `.gitignore`
- [ ] Copy TDD v2 to `docs/tdd.md`
- [ ] Add MIT `LICENSE` file
- [ ] Verify with `tree -L 2`

### Task 0.2: Backend Bootstrap
- [ ] `pyproject.toml` with dependencies (FastAPI, SQLAlchemy 2, Alembic, argon2-cffi, etc.)
- [ ] Dev dependencies (pytest, mypy, ruff)
- [ ] `app/main.py` with FastAPI app + `/health` endpoint
- [ ] `app/config.py` with pydantic-settings
- [ ] `app/db/session.py` with async engine
- [ ] `app/db/base.py` with DeclarativeBase
- [ ] Alembic initialized (`alembic.ini`, `alembic/` directory)
- [ ] `tests/conftest.py` with async test client + test DB fixtures
- [ ] `Dockerfile` for backend
- [ ] Write tests: `/health` returns ok, DB connection works
- [ ] `pytest` passes, `ruff check` clean, `mypy app` clean

### Task 0.3: Frontend Bootstrap
- [ ] `bun create vite . --template react-ts` in `/frontend`
- [ ] Add Tailwind CSS with PostCSS config
- [ ] Add Radix UI primitives (dialog, dropdown, tabs, toast)
- [ ] Add TanStack Query, TanStack Router, Recharts
- [ ] Add `vite-plugin-pwa` (disabled initially)
- [ ] Add Vitest + RTL
- [ ] Standard directory structure (`api/`, `components/`, `pages/`, `lib/`, `styles/`)
- [ ] `Dockerfile` for frontend (multi-stage)
- [ ] Minimal App with Radix Dialog demo
- [ ] Write tests: App renders, Dialog opens on click
- [ ] `bun test` passes, `bun run build` clean

### Task 0.4: Docker Compose Dev Setup
- [ ] `infra/docker-compose.yml` with postgres, redis, api, frontend services
- [ ] `infra/env.example` with all required vars (see TDD 4.9)
- [ ] `Makefile` with `up`, `down`, `logs`, `backend-shell`, `psql` targets
- [ ] Verify: `make up` starts all services, `/health` reachable

### Task 0.5: GitHub Actions CI
- [ ] `.github/workflows/ci.yml` with backend + frontend jobs in parallel
- [ ] Backend job: ruff, mypy, pytest with coverage
- [ ] Frontend job: lint, test, build
- [ ] Test by opening a dummy PR
- [ ] Both jobs pass green

---

## Milestone 1: Authentication & User Management

### Task 1.1: Users + Sessions Schema
- [ ] `User`, `Session`, `InviteToken` SQLAlchemy models
- [ ] Alembic migration generated and reviewed
- [ ] UUID columns use PG UUID type, timestamps use TIMESTAMPTZ
- [ ] Tests: unique email constraint, timestamps default correctly
- [ ] Tests: migration upgrade/downgrade clean

### Task 1.2: Password Hashing & JWT
- [ ] `security/passwords.py` with argon2-cffi
- [ ] `security/tokens.py` with JWT (HS256)
- [ ] Access token TTL 24h, refresh 30d
- [ ] Tests: hash differs per call, verify correct/wrong
- [ ] Tests: token round-trip, expiry, tampering

### Task 1.3: First-Run Setup Endpoint
- [ ] `POST /auth/setup` endpoint
- [ ] `assert_no_users_exist` dependency
- [ ] Tests: first call succeeds, subsequent calls 404
- [ ] Tests: validation (email format, password length)

### Task 1.4: Login & Session Endpoints
- [ ] `POST /auth/login`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] `POST /auth/refresh`
- [ ] `get_current_user` dependency
- [ ] Tests for all four endpoints

### Task 1.5: Invite Token System
- [ ] `POST /auth/invites` (auth required)
- [ ] `POST /auth/accept-invite`
- [ ] `GET /auth/invites/{token}/info`
- [ ] Tokens stored hashed, plain only in URL
- [ ] Tests: creation, redemption, expiry, single-use

### Task 1.6: Frontend Auth Pages
- [ ] `Setup.tsx` page (first-run wizard)
- [ ] `Login.tsx` page
- [ ] `AcceptInvite.tsx` page
- [ ] `api/auth.ts` with TanStack Query hooks
- [ ] `lib/auth-storage.ts` for token storage
- [ ] `AuthGuard.tsx` wrapper component
- [ ] Routing configured for public + protected routes
- [ ] Component tests with MSW

---

## Milestone 2: Settings & Core Entities

### Task 2.1: User Settings
- [ ] `UserSettings` model with primary_currency, timezone, etc.
- [ ] Auto-create on user signup with defaults
- [ ] `GET /settings`, `PATCH /settings`
- [ ] Tests: defaults created, only authed user sees own settings

### Task 2.2: Accounts CRUD
- [ ] `Account` model
- [ ] Full CRUD endpoints + soft delete + restore
- [ ] Currency defaults from user settings
- [ ] Tests: CRUD, access control, soft delete + restore, 30-day purge

### Task 2.3: Payment Methods CRUD
- [ ] `PaymentMethod` model
- [ ] Nested under accounts
- [ ] Validation: `upi_app` only with `type=upi`
- [ ] Tests: validation, access control

### Task 2.4: Payees CRUD
- [ ] `Payee` model + `payee_default_categories` join table
- [ ] CRUD with search by name + filter by type
- [ ] Tests: round trip with defaults, search, type filter

### Task 2.5: Categories CRUD
- [ ] `Category` model with optional applicability
- [ ] Standard CRUD
- [ ] Optional `POST /categories/seed-defaults`
- [ ] Tests: CRUD, seed

### Task 2.6: Tags CRUD
- [ ] `Tag` model with unique constraint per user
- [ ] Standard CRUD
- [ ] Tests: duplicate returns 409, soft delete frees name

### Task 2.7: Frontend — Settings Page
- [ ] `Settings.tsx` page
- [ ] `SettingsForm.tsx` component
- [ ] `api/settings.ts` hooks
- [ ] Save with optimistic update + toast
- [ ] Tests: form renders, save calls PATCH

### Task 2.8: Frontend — Entity Management Pages
- [ ] `DataTable.tsx` reusable component (mobile fallback)
- [ ] `EntityModal.tsx` reusable
- [ ] `ConfirmDialog.tsx` reusable
- [ ] Accounts page (with inline payment methods)
- [ ] Payees page
- [ ] Categories page
- [ ] Tags page
- [ ] Tests for each entity page

---

## Milestone 3: Transactions (Core)

### Task 3.1: Transactions Schema
- [ ] `Transaction` model with all fields per TDD
- [ ] `transaction_categories`, `transaction_tags`, `transaction_budgets` join tables
- [ ] Indexes: `(user_id, transacted_at DESC)`, etc.
- [ ] Constraints: transfer requires `to_account_id`, others forbid it
- [ ] Tests: model creation with joins, constraint enforcement

### Task 3.2: Transactions CRUD
- [ ] `POST /transactions`
- [ ] `GET /transactions` with all filters + cursor pagination
- [ ] `GET /transactions/{id}`
- [ ] `PATCH /transactions/{id}`
- [ ] `DELETE /transactions/{id}` (soft) + restore
- [ ] Currency override logic
- [ ] Account balance recomputed transactionally
- [ ] Tests: all paths, balance correctness, all filters

### Task 3.3: Frontend — Transaction Form
- [ ] `TransactionForm.tsx` (create + edit modes)
- [ ] `Autocomplete.tsx` reusable (with inline create)
- [ ] Type toggle hides/shows fields appropriately
- [ ] Payee selection auto-populates categories
- [ ] Defaults from settings (currency, timezone)
- [ ] Tests: all field rendering, type behavior, payee defaults, validation

### Task 3.4: Frontend — Transaction List
- [ ] `Transactions.tsx` page
- [ ] Filters panel synced to URL params
- [ ] Desktop table / mobile cards
- [ ] Infinite scroll with cursor pagination
- [ ] Bulk select UI (action button comes in Milestone 4)
- [ ] Tests: filters, pagination, responsive layout

---

## Milestone 4: Splits

### Task 4.1: Splits Schema + Invariant
- [ ] `Split` model
- [ ] `SplitShare` model
- [ ] Status enum: pending/settled/forgiven
- [ ] Application-layer invariant validator
- [ ] DB trigger enforcing sum(shares) == expense.amount
- [ ] Tests: invariant enforcement on insert/update/delete

### Task 4.2: Upfront Split Creation
- [ ] `POST /splits` with bundled transaction + shares
- [ ] Atomic creation, rollback on failure
- [ ] Tests: happy path, sum mismatch, type mismatch, rollback

### Task 4.3: Retroactive Bundling
- [ ] `POST /splits/bundle` endpoint
- [ ] Computes user's share as remainder
- [ ] Validates no transaction is double-counted
- [ ] Tests: mixed settled/forgiven, negative share rejection, conflict detection

### Task 4.4: Settlement & Forgiveness
- [ ] `PATCH /split-shares/{id}/settle` (existing OR new transaction)
- [ ] `PATCH /split-shares/{id}/forgive`
- [ ] `PATCH /split-shares/{id}/unsettle` (escape hatch)
- [ ] Tests: all transitions, amount mismatch rejection

### Task 4.5: Net Expense Calculation
- [ ] `services/expense_calculator.py`
- [ ] `compute_net_expense(transaction)`
- [ ] `compute_net_expenses_bulk(transactions)`
- [ ] Reimbursement income identification helper
- [ ] SQL view `transaction_with_net_amount`
- [ ] Tests: all split combinations produce correct net

### Task 4.6: Frontend — Split UIs
- [ ] `SplitSharesEditor.tsx` (upfront)
- [ ] Split toggle integrated into `TransactionForm.tsx`
- [ ] `BundleAsSplitModal.tsx` (retroactive)
- [ ] "Bundle as Split" action in transaction list bulk actions
- [ ] `SplitDetail.tsx` page
- [ ] Settle modal (link existing OR create new)
- [ ] Forgive confirm dialog
- [ ] Tests for each component

---

## Milestone 5: Budgets

### Task 5.1: Budgets Schema
- [ ] `Budget` model with RRULE support
- [ ] `budget_categories` join table
- [ ] Tests: creation of each type

### Task 5.2: Recurrence Expansion
- [ ] `services/budget_expander.py`
- [ ] `expand_budget(budget, window)`
- [ ] Handles recurring, ad-hoc with/without dates
- [ ] Modified instance override logic
- [ ] Tests: all expansion scenarios

### Task 5.3: Budgets CRUD with Scope Semantics
- [ ] `POST/GET/PATCH/DELETE /budgets`
- [ ] `?scope=current_and_future|future_only` on edit
- [ ] `?scope=instance|current_and_future|future_only` on delete
- [ ] Scope semantics implemented per TDD
- [ ] Tests: every scope combination

### Task 5.4: Linking Transactions to Budgets
- [ ] Transactions endpoints accept `budget_ids`
- [ ] `GET /budgets/{id}/transactions`
- [ ] Spent calculation (explicit + category-match auto-include)
- [ ] Tests: linking, unlinking, spent recompute on changes

### Task 5.5: Frontend — Budgets
- [ ] `Budgets.tsx` list with progress bars
- [ ] `BudgetDetail.tsx`
- [ ] `BudgetForm.tsx`
- [ ] Edit dialog with "also affect current period" checkbox
- [ ] Delete dialog with three radio options
- [ ] Tests: dialog rendering by budget type, progress bar accuracy

---

## Milestone 6: Subscriptions & Piggy Banks

### Task 6.1: Subscriptions
- [ ] `Subscription` model
- [ ] `services/subscription_dates.py` for next-date and status
- [ ] CRUD + link-transaction + history endpoints
- [ ] Transaction PATCH accepts `subscription_id`
- [ ] Tests: next-date calculations, status transitions, linking

### Task 6.2: Piggy Banks
- [ ] `PiggyBank` and `PiggyBankContribution` models
- [ ] CRUD + contributions endpoints
- [ ] `current_amount` updated transactionally
- [ ] Auto-complete at threshold
- [ ] Tests: contribution add/remove, auto-completion

### Task 6.3: Frontend — Subscriptions & Piggy Banks
- [ ] Subscriptions list, form, detail pages
- [ ] Status badges (color-coded)
- [ ] Piggy banks list, form, detail pages
- [ ] Progress rings
- [ ] Tests for each page

---

## Milestone 7: Home Dashboard

### Task 7.1: Dashboard Endpoint
- [ ] `GET /dashboard/home` returning all summary data
- [ ] Sub-queries parallelized with `asyncio.gather`
- [ ] Tests: full structure, empty state, cross-check numbers

### Task 7.2: Frontend — Dashboard
- [ ] `Dashboard.tsx` page
- [ ] `BudgetProgressCard.tsx`
- [ ] `CategoryBreakdownChart.tsx` (Recharts)
- [ ] `SubscriptionStatusBadge.tsx`
- [ ] `PiggyBankProgressRing.tsx`
- [ ] Skeleton loaders during fetch
- [ ] Mobile-first responsive grid
- [ ] Tests for each component

---

## Milestone 8: PDF Statement Import

### Task 8.1: Import Schema
- [ ] `ImportBatch` model
- [ ] `RawImportRecord` model
- [ ] Cascade behavior on deletion
- [ ] Tests: model behavior

### Task 8.2: PDF Upload & Unlock
- [ ] `POST /imports/pdf` multipart endpoint
- [ ] Per-user temp storage
- [ ] ARQ job `process_pdf_import`
- [ ] pikepdf unlock with password handling
- [ ] Tests: correct password, wrong password, corrupted PDF

### Task 8.3: HDFC PDF Parser
- [ ] `parsers/base.py` interface
- [ ] `parsers/banks/hdfc.py` implementation
- [ ] `parsers/registry.py` with auto-detection
- [ ] Fixture PDFs in `tests/fixtures/parsers/hdfc/`
- [ ] Tests: parse correctness, detection logic

### Task 8.4: Balance Verification
- [ ] `services/balance_verifier.py`
- [ ] Result stored on ImportBatch
- [ ] Tests: VERIFIED, DISCREPANCY with delta, INDETERMINATE

### Task 8.5: Deduplication
- [ ] `services/dedup.py` with rapidfuzz
- [ ] Tests: exact, fuzzy, cross-account negative, date window

### Task 8.6: Confirm/Reject Flow
- [ ] `GET /imports/{batch_id}/records`
- [ ] `PATCH /imports/{batch_id}/records/{id}`
- [ ] `POST /imports/{batch_id}/confirm`
- [ ] `POST /imports/{batch_id}/reject`
- [ ] Atomic transaction creation on confirm
- [ ] Tests: all paths, rollback on failure

### Task 8.7: Frontend — Import Pages
- [ ] `Imports.tsx` list
- [ ] `ImportUpload.tsx` (file + password + account)
- [ ] `ImportReview.tsx` with tabbed status grouping
- [ ] Inline editing per record
- [ ] Bulk confirm/reject actions
- [ ] Tests for each page

---

## Milestone 9: LLM Integration

### Task 9.1: LLMClient Interface
- [ ] `llm/base.py` ABC
- [ ] `llm/factory.py` selecting impl by env var
- [ ] `NullClient` for `LLM_BACKEND=none`
- [ ] Tests: factory dispatch, NullClient safety

### Task 9.2: Ollama Implementation
- [ ] `llm/ollama_client.py`
- [ ] Vision extraction (page → JSON)
- [ ] Category suggestion
- [ ] GPay matching helper
- [ ] Robust JSON parsing with retry
- [ ] Tests (mocked)

### Task 9.3: Anthropic Implementation
- [ ] `llm/anthropic_client.py`
- [ ] Zero-retention header support
- [ ] Vision input handling
- [ ] Tests (mocked) + opt-in real-API test

### Task 9.4: Vision Fallback Integration
- [ ] PDF worker updated to fall back when deterministic fails
- [ ] Confidence levels set correctly (high/low)
- [ ] Verification after vision extraction
- [ ] Tests: each fallback path

### Task 9.5: LLM Activity Log
- [ ] `LLMActivityLog` model
- [ ] Logging decorator/middleware on all LLM calls
- [ ] `GET /settings/llm-activity` endpoint
- [ ] Tests: every call logged, failures logged with `succeeded=false`

### Task 9.6: Frontend — LLM Activity Page
- [ ] `SettingsLLMActivity.tsx`
- [ ] Filter by operation and backend
- [ ] Expand for payload summary
- [ ] Tests: rendering, expansion

---

## Milestone 10: GPay Takeout Enrichment

### Task 10.1: GPay Parser & Matcher
- [ ] `POST /imports/gpay-takeout`
- [ ] `services/gpay_matcher.py`
- [ ] `GPayMatch` model
- [ ] Exact/ambiguous/orphan paths
- [ ] Enrichment writes merchant_name (preserve original)
- [ ] Tests: each match path, enrichment correctness

### Task 10.2: Frontend — GPay UI
- [ ] `GPayImport.tsx`
- [ ] `GPayResolve.tsx` with side-by-side candidate selection
- [ ] `GPayOrphans.tsx`
- [ ] Tests: resolution submits correct ID

---

## Milestone 11: Reports & Custom Dashboards

### Task 11.1: Read-Only Role & Query Endpoint
- [ ] Postgres `app_readonly` role with restricted SELECT
- [ ] Separate SQLAlchemy engine for read-only
- [ ] `POST /reports/query` with safety wrappers
- [ ] User-id filter enforcement (sqlglot AST check)
- [ ] Row limit (10k max)
- [ ] Statement timeout (10s)
- [ ] Tests: SELECT works, mutations blocked, timeout enforced, missing user_id rejected

### Task 11.2: Schema Reference Endpoint
- [ ] `GET /reports/schema` with curated tables + descriptions
- [ ] Foreign keys exposed
- [ ] Tests: expected tables only, FKs populated

### Task 11.3: Dashboards & Widgets
- [ ] `ReportDashboard` and `ReportWidget` models
- [ ] Full CRUD APIs
- [ ] Tests: CRUD, cascade, access control

### Task 11.4: Frontend — Reports
- [ ] `Reports.tsx` dashboard list
- [ ] `ReportDashboard.tsx` with react-grid-layout
- [ ] `QueryEditor.tsx` (Monaco or CodeMirror with SQL highlight)
- [ ] `SchemaReferencePanel.tsx` (clickable)
- [ ] `StarterQueryLibrary.tsx`
- [ ] `WidgetRenderer.tsx`
- [ ] `WidgetEditor.tsx` modal
- [ ] Tests: grid persistence, widget rendering, schema panel insertion

---

## Milestone 12: Data Portability

### Task 12.1: JSON Archive Export
- [ ] `POST /export` triggers ARQ job
- [ ] Manifest + per-table JSON files in tar.gz
- [ ] UUIDs preserved
- [ ] `GET /export/{job_id}` for status
- [ ] `GET /export/{job_id}/download`
- [ ] Tests: round trip, user isolation

### Task 12.2: JSON Archive Import
- [ ] `POST /import-archive` accepts tar.gz
- [ ] Schema version validation
- [ ] Tables loaded in dependency order
- [ ] UUID conflict detection
- [ ] Atomic transactional load
- [ ] Restricted to fresh user
- [ ] Tests: round trip, conflict detection, malformed manifest

### Task 12.3: pg_dump Scripts & CLI
- [ ] `infra/scripts/backup.sh`
- [ ] `infra/scripts/restore.sh`
- [ ] CLI: `create-user`, `export-archive`, `import-archive`
- [ ] Tests: dump validity, restore correctness, CLI commands

### Task 12.4: Frontend — Export/Import UI
- [ ] `SettingsDataExport.tsx` with polling for completion
- [ ] `SettingsDataImport.tsx` with safety warnings
- [ ] Tests: full flows

---

## Milestone 13: PWA & Polish

### Task 13.1: PWA Setup
- [ ] vite-plugin-pwa configured
- [ ] Manifest with icons (192, 512)
- [ ] Service worker (network-first for API, precache static)
- [ ] Installable on Chrome/iOS Safari
- [ ] Lighthouse PWA score ≥ 90

### Task 13.2: Mobile Responsiveness Audit
- [ ] Every page verified at 360px
- [ ] No horizontal scroll
- [ ] All tap targets ≥ 44x44 px
- [ ] `MobileNav.tsx` bottom tab bar
- [ ] Playwright snapshot tests at 360px per page

### Task 13.3: Soft Delete Recovery UI
- [ ] `RecentlyDeleted.tsx` with tabbed entity views
- [ ] Restore endpoints on all entities (audit complete)
- [ ] Daily cron job to purge items older than 30 days
- [ ] Tests: appearance within 30 days, purge after, restore behavior

---

## Milestone 14: Production Deployment

### Task 14.1: Caddyfile & Production Compose
- [ ] `infra/Caddyfile` with localhost + production profiles
- [ ] Production `docker-compose.yml` with Caddy + healthchecks
- [ ] `docker-compose.local-llm.yml` override for Ollama
- [ ] Both modes verified working

### Task 14.2: Backup Automation
- [ ] `infra/scripts/auto-backup.sh` with rotation
- [ ] Cron entry documented
- [ ] Tests: backup file produced, rotation works

### Task 14.3: Documentation
- [ ] `README.md` with quick start
- [ ] `docs/operations.md` runbook
- [ ] `docs/tdd.md` copied
- [ ] `docs/api.md` linking to OpenAPI
- [ ] Markdown lint clean

### Task 14.4: End-to-End Tests
- [ ] Playwright e2e suite covering 9 critical paths
- [ ] First-run setup → empty dashboard
- [ ] Create entity chain → see in list/dashboard
- [ ] PDF import → review → confirm
- [ ] Budget creation → link → see on dashboard
- [ ] Upfront split + settle + forgive
- [ ] Retroactive bundle
- [ ] Custom report dashboard
- [ ] Export → import round trip
- [ ] Mobile full transaction flow at 360px
- [ ] All e2e tests passing in CI

---

## Final Integration & Release

### Pre-Release Checklist
- [ ] Full test suite passes (`make test`)
- [ ] Lighthouse PWA ≥ 90, Performance ≥ 80
- [ ] Deploy to staging VPS via production compose
- [ ] Smoke-test all critical flows on staging
- [ ] Backup cron runs nightly, restore tested
- [ ] JSON archive round trip across two instances
- [ ] LLM activity log captures every call as expected

### Security Audit
- [ ] All endpoints behind auth (except setup/login/invite/health)
- [ ] argon2id for passwords confirmed
- [ ] JWT signing key only in env, rotated for production
- [ ] Read-only role enforced on `/reports/query`
- [ ] SQL injection attempts on query endpoint blocked
- [ ] CORS limited to PUBLIC_BASE_URL
- [ ] Rate limiting on auth + imports verified

### Accessibility Audit
- [ ] axe-core run on every page
- [ ] All critical issues addressed
- [ ] Keyboard navigation works end-to-end
- [ ] Screen reader spot-check on dashboard + transaction form

### Documentation Final
- [ ] README setup instructions verified by following them on a fresh machine
- [ ] Known issues / limitations documented in `docs/known-issues.md`
- [ ] Sample env files for both deployment modes committed

### Release
- [ ] Cut `v1.0.0` git tag
- [ ] Publish container images to GHCR
- [ ] Write release notes
- [ ] Announce in personal channels

---

## Post-v1 Backlog (Reference Only)

These are noted in TDD section 5 — pick up after v1 ships:

- [ ] Notifications (subscription renewals, budget overruns)
- [ ] Transaction attachments (receipts)
- [ ] Native mobile app
- [ ] Investments module
- [ ] Multi-user household support
- [ ] Row-level security for query endpoint
- [ ] LLM prompt evaluation harness
- [ ] Automatic GPay-bank reconciliation improvements
- [ ] Additional bank parsers (ICICI, SBI, Axis, Kotak, etc.)
