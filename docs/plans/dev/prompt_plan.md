# Implementation Prompts for Kanakku

> **Source of truth:** `personal-finance-tracker-tdd.md` v3 (located at `/docs/tdd.md` in the repo).
> **Approach:** Test-Driven Development. Tests before implementation per the spec.
> **Stack:** Python 3.12 + FastAPI + SQLAlchemy 2 + Postgres 16 (backend); Bun + Vite + React 19 + Tailwind + Radix (frontend); Docker Compose; Ollama with qwen2.5:1.5b for LLM tasks.
> **Target hardware:** Raspberry Pi 5 (8GB).
> **Assumptions:** Monorepo (`/backend`, `/frontend`, `/infra`); GitHub Actions CI; first bank parser is HDFC.

---

## Milestone 0: Foundation

### Task 0.1: Monorepo Structure

```prompt
Initialize a monorepo for Kanakku with the following layout:

/
├── backend/
├── frontend/
├── infra/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── env.example
├── docs/
│   └── TDD.md
├── CLAUDE.md
├── .github/workflows/
├── .gitignore
├── README.md
└── LICENSE (MIT)

Add .gitignore entries for Python (.venv, __pycache__, *.pyc, .pytest_cache), Node (node_modules, dist, .vite), env files (.env, .env.local), OS (.DS_Store), and Docker volumes.

README should describe Kanakku in 2-3 sentences and link to docs/tdd.md.

No tests — pure scaffolding. Verify with `tree -L 2`.
```

### Task 0.2: Backend Bootstrap

```prompt
Context: FastAPI backend with SQLAlchemy 2 async, Alembic, pytest, argon2.

In /backend, create:
- pyproject.toml with deps: fastapi, uvicorn[standard], sqlalchemy[asyncio]>=2.0, asyncpg, alembic, pydantic, pydantic-settings, python-jose[cryptography], argon2-cffi, arq, redis, httpx
- Dev deps: pytest, pytest-asyncio, pytest-cov, httpx, factory-boy, ruff, mypy
- app/main.py — FastAPI app with /health endpoint
- app/config.py — pydantic-settings BaseSettings loading from env
- app/db/session.py — async engine + session factory
- app/db/base.py — DeclarativeBase
- alembic.ini and alembic/ initialized
- tests/conftest.py — fixtures for async test client and test DB
- Dockerfile — multi-stage, python:3.12-slim base, ARM64-compatible (Pi 5)

Tests:
- test_health.py: GET /health returns {"status": "ok"}
- test_db.py: DB connection works, SELECT 1 succeeds

Run pytest (pass), ruff check (clean), mypy app (clean).
```

### Task 0.3: Frontend Bootstrap

```prompt
Context: Bun + Vite + React 19 + Tailwind + Radix. No Next.js — pure SPA.

In /frontend, run `bun create vite . --template react-ts`, then add:
- Tailwind CSS with PostCSS
- Radix UI primitives (dialog, dropdown, tabs, toast)
- TanStack Query
- TanStack Router
- Recharts
- vite-plugin-pwa (configured but disabled initially)
- Vitest + React Testing Library

Structure:
/frontend
├── src/
│   ├── api/
│   ├── components/
│   ├── pages/
│   ├── lib/
│   ├── styles/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── vite.config.ts
├── tailwind.config.ts
├── Dockerfile (multi-stage, ARM64-compatible)
└── package.json

Build a minimal App that renders "Kanakku" heading + a button using Radix Dialog, with Tailwind styling.

Tests:
- App.test.tsx: renders heading
- Button.test.tsx: clicking button opens dialog

Run `bun test`, `bun run build` — both must succeed.
```

### Task 0.4: Docker Compose Dev Setup

```prompt
Context: Single docker-compose.yml in /infra that starts everything needed for development AND production (same file). Target: Raspberry Pi 5 ARM64.

Create /infra/docker-compose.yml with services:
- postgres:16 with named volume pgdata (use arm64-compatible image; postgres official supports arm64)
- redis:7 (arm64-compatible)
- api: builds /backend, mounts source for hot reload in dev
- worker: same image, runs ARQ
- frontend: builds /frontend, runs `bun run dev` in dev
- ollama: ollama/ollama image, with named volume; environment OLLAMA_MAX_LOADED_MODELS=1
- caddy:2 — reverse proxy (initially optional; can be added in M14)

Create /infra/env.example with all required vars from TDD section 4.10.

Add /infra/Makefile with: `up`, `down`, `logs`, `backend-shell`, `psql`, `ollama-shell`.

Add ollama init script /infra/scripts/init-ollama.sh that pulls qwen2.5:1.5b after Ollama starts.

Tests:
- `make up` brings up all services
- /health reachable at http://localhost:8000/health
- Frontend reachable at http://localhost:5173
- `ollama list` shows qwen2.5:1.5b after init

Verify on actual Pi 5 hardware if available.
```

### Task 0.5: GitHub Actions CI

```prompt
Context: CI on every PR. Backend + frontend in parallel.

Create .github/workflows/ci.yml with two jobs:

backend:
- Set up Python 3.12
- Install deps with `pip install -e ./backend[dev]`
- Service containers: postgres + redis
- Run: ruff check, mypy, pytest --cov
- Upload coverage artifact

frontend:
- Set up Bun
- bun install
- bun run lint
- bun test
- bun run build

Trigger on: push to main, pull_request to main.

(Note: GitHub-hosted runners are x86_64; CI tests amd64 builds. Pi 5 ARM64 builds happen at deploy time. To catch ARM-specific issues, add a separate workflow ci-arm.yml using QEMU emulation to build the docker images for arm64 — runs slower but catches issues before deploy.)

Confirm both jobs pass on a dummy PR.
```

---

## Milestone 1: Authentication & User Management

### Task 1.1: Users + Sessions Schema

```prompt
Context: FR-1 authentication.

SQLAlchemy models in /backend/app/models/:
- user.py: User(id UUID PK, email UNIQUE, password_hash, created_at)
- session.py: Session(id UUID PK, user_id FK, token_hash, expires_at, created_at)
- invite.py: InviteToken(id, created_by_user_id FK, token_hash, email NULL, expires_at, used_at, created_at)

Generate Alembic migration. Verify UUID columns use PG UUID type, timestamps use TIMESTAMPTZ.

Tests:
- test_models_users.py: create user, email unique constraint enforced, timestamps default
- test_migration.py: upgrade head + downgrade base both clean
```

### Task 1.2: Password Hashing & JWT

```prompt
Context: argon2id for passwords (NFR-6.1), JWT for sessions (NFR-6.2).

Create /backend/app/security/:
- passwords.py: hash_password, verify_password (argon2-cffi)
- tokens.py: create_access_token, create_refresh_token, decode_token

HS256, JWT_SECRET from config. Access 24h, refresh 30d.

Tests: hash differs per call (salting), verify correct/wrong, token round-trip, expired token raises, tampered token raises.
```

### Task 1.3: First-Run Setup Endpoint

```prompt
Context: FR-1.3.

POST /api/v1/auth/setup — body {email, password}. If users exist, returns 404. Otherwise creates first user, returns user + access_token + refresh_token.

Dependency `assert_no_users_exist` returns 404 when users exist.

Tests: first call succeeds, second returns 404, invalid email 422, password < 8 chars 422.
```

### Task 1.4: Login, Logout, Me, Refresh

```prompt
Context: Standard session lifecycle.

Endpoints:
- POST /auth/login — {email, password} → tokens + user
- POST /auth/logout — invalidates refresh token
- GET /auth/me — current user
- POST /auth/refresh — {refresh_token} → new access_token

Dependency `get_current_user` decodes Authorization: Bearer token.

Tests: valid creds work, wrong pwd 401, nonexistent email 401, logout invalidates, refresh round-trip.
```

### Task 1.5: Invite Token System

```prompt
Context: FR-1.4.

Endpoints:
- POST /auth/invites (auth required) → {invite_url, expires_at}
- POST /auth/accept-invite — {token, password} → creates user, returns tokens
- GET /auth/invites/{token}/info — public preview

Tokens stored hashed; plain token only in the URL.

Tests: creation, redemption, expiry (410), already-used (410), invalid (404).
```

### Task 1.6: Frontend Auth Pages

```prompt
Context: Setup wizard + Login + Session management.

Create:
- pages/Setup.tsx — first-run wizard. Detects via "try setup endpoint, redirect to login on 404"
- pages/Login.tsx
- pages/AcceptInvite.tsx — reads ?token=
- api/auth.ts — TanStack Query hooks
- lib/auth-storage.ts — tokens in memory + refresh in HttpOnly cookie if backend sets it
- components/AuthGuard.tsx — wraps protected routes

Routes:
- /setup, /login, /accept-invite — public
- All others wrapped in AuthGuard

Tests: Login submits creds correctly; AuthGuard redirects unauthenticated. Use MSW for API mocks.
```

---

## Milestone 2: Settings & Core Entities

### Task 2.1: User Settings

```prompt
Context: FR-2.

Model: UserSettings(user_id PK FK, primary_currency, timezone, date_format, number_format, updated_at).

Auto-create on user signup (setup + accept-invite) with defaults: INR, Asia/Kolkata.

Endpoints: GET /settings, PATCH /settings.

Tests: defaults on signup, GET returns them, PATCH updates, scoped to authed user.
```

### Task 2.2: Accounts CRUD

```prompt
Context: FR-3.

Model: Account(id, user_id, name, type, currency, opening_balance, current_balance, is_active, timestamps, deleted_at).

Type enum: bank, cash, credit_card, loan.

Endpoints: POST/GET/GET-by-id/PATCH/DELETE/POST-restore. current_balance = opening_balance at creation.

Currency defaults to user.settings.primary_currency.

Tests: CRUD, access control (other user's account 404), soft delete + restore, 30-day purge rejection.
```

### Task 2.3: Payment Methods CRUD

```prompt
Context: FR-3.3 / FR-3.4. Nested under accounts.

Model: PaymentMethod(id, account_id FK, type, label, upi_app NULL, is_active, timestamps, deleted_at).

Endpoints: GET /accounts/{id}/payment-methods, POST same, PATCH /payment-methods/{id}, DELETE /payment-methods/{id}.

Validate: upi_app only allowed when type=upi.

Tests: validation, access control via parent account.
```

### Task 2.4: Payees CRUD

```prompt
Context: FR-4.

Model: Payee(id, user_id, name, type, notes, is_active, timestamps, deleted_at).
Join: payee_default_categories(payee_id, category_id).

Endpoints: standard CRUD with search by name (substring, case-insensitive) and filter by type.

PATCH allows updating default_categories (full replacement).

Tests: round trip with defaults, search, type filter, can't reference other user's categories.
```

### Task 2.5: Categories CRUD

```prompt
Context: FR-5.1, FR-5.2.

Model: Category(id, user_id, name, icon, color, applicability NULL, timestamps, deleted_at).

Endpoints: standard CRUD + POST /categories/seed-defaults (creates standard set: food, transport, entertainment, salary, etc.).

Tests: CRUD, seed creates expected, soft delete + restore.
```

### Task 2.6: Tags CRUD

```prompt
Context: FR-5.3.

Model: Tag(id, user_id, name, color, timestamps, deleted_at). Unique (user_id, name) WHERE deleted_at IS NULL.

Endpoints: standard CRUD.

Tests: duplicate active name → 409; soft delete frees name for reuse.
```

### Task 2.7: Frontend — Settings Page

```prompt
Context: FR-2 UI.

Create pages/Settings.tsx + components/forms/SettingsForm.tsx + api/settings.ts.

Fields: primary currency (Radix Select), timezone, date/number format. Save with optimistic update + toast.

Tests: renders with defaults, save calls PATCH with modified fields only.
```

### Task 2.8: Frontend — Entity Pages

```prompt
Context: Accounts, Payees, Categories, Tags management UIs.

Build reusable components first:
- components/DataTable.tsx — table with mobile-card fallback under sm breakpoint
- components/EntityModal.tsx — generic Radix Dialog-based create/edit modal
- components/ConfirmDialog.tsx — for delete confirmations

For each entity (Account, Payee, Category, Tag):
- pages/{Entity}List.tsx
- components/forms/{Entity}Form.tsx
- api/{entity}.ts

Accounts page expands rows to show payment methods inline + add button.

Mobile-first throughout.

Tests: DataTable renders rows on desktop, cards on mobile; each entity page exercised with mocked API.
```

---

## Milestone 3: Transactions (Core)

### Task 3.1: Transactions Schema

```prompt
Context: FR-6.

Model: Transaction(
  id, user_id, type, transacted_at TIMESTAMPTZ,
  amount Numeric(15,2), currency,
  description, notes,
  account_id, payment_method_id NULL,
  payee_id NULL, to_account_id NULL,
  to_amount NULL, to_currency NULL,
  subscription_id NULL,    # add column now, nullable; populated later
  import_record_id NULL,
  timestamps, deleted_at
)

Join tables: transaction_categories, transaction_tags, transaction_budgets.

Indexes: (user_id, transacted_at DESC), (user_id, account_id, transacted_at DESC), (user_id, deleted_at).

Constraints: type=transfer requires to_account_id; type≠transfer forbids it.

Tests: create with categories + tags via joins, constraint enforcement.
```

### Task 3.2: Transactions CRUD

```prompt
Context: FR-6 API.

Endpoints:
- POST /transactions
- GET /transactions — filters: ?type, ?account_id, ?payee_id, ?category_id, ?tag_id, ?from, ?to, ?budget_id, ?cursor, ?limit (default 50)
- GET /transactions/{id}
- PATCH /transactions/{id}
- DELETE /transactions/{id} — soft
- POST /transactions/{id}/restore

Currency defaults to account currency; overrideable.

Cursor pagination by (transacted_at DESC, id DESC). Base64 cursor.

On create/edit/delete: recompute account current_balance transactionally (and to_account_id for transfers).

Tests: each path, balance correctness (create+delete+restore leaves balance unchanged), all filters, cursor pagination, multi-category/tag.
```

### Task 3.3: Frontend — Transaction Form

```prompt
Context: FR-13 — structured form only, no LLM, no compact syntax.

pages/TransactionForm.tsx handling create + edit (route param).

Fields per FR-6:
- Type toggle (expense/income/transfer)
- transacted_at (date + time, default now in user TZ, editable)
- Amount + currency selector (currency defaults from settings, overrideable)
- Account select with autocomplete (transfer mode shows source + destination)
- Payment method select (filtered by selected account)
- Payee autocomplete with inline-create
- Categories multi-select (auto-populated by payee default_categories)
- Tags multi-select
- Description, Notes

Components:
- components/forms/TransactionForm.tsx
- components/Autocomplete.tsx — reusable with inline creation

Tests: all fields render, type toggle controls visibility, payee defaults populate categories, validation (amount > 0, account required).
```

### Task 3.4: Frontend — Transaction List

```prompt
Context: FR-6 list UI.

pages/Transactions.tsx:
- Filters panel (synced to URL params): date range, account, type, category, tag, payee, search
- Desktop: dense table with date, payee, amount, account, categories, tags, actions
- Mobile: card per transaction
- Infinite scroll via TanStack Query useInfiniteQuery
- Row click → edit
- Bulk select checkboxes — UI ready, action button added in M4

Tests: filters update URL + refetch, infinite scroll loads pages, responsive layout works.
```

---

## Milestone 4: Splits

### Task 4.1: Splits Schema + Invariant

```prompt
Context: FR-7. Split as separate entity.

Models:
- Split(id, user_id, expense_transaction_id FK UNIQUE, notes, timestamps, deleted_at)
- SplitShare(id, split_id FK, payee_id NULL FK, amount, status enum, settled_at NULL, settlement_transaction_id NULL FK, forgiven_at NULL, notes, timestamps)

Status enum: pending/settled/forgiven.

Enforce invariant in two places:
1. Application: services/split_service.py validate_invariant(split_id)
2. Database: a trigger function check_split_invariant() fired after INSERT/UPDATE/DELETE on split_shares

Tests: sum matches → ok; sum mismatch → raises; update breaking sum → raises; delete breaking sum → raises.
```

### Task 4.2: Upfront Split Creation

```prompt
Context: FR-7.4.

POST /api/v1/splits — body has transaction payload + shares array + notes.

Server (in one DB transaction):
1. Validate transaction is type=expense
2. Validate sum(shares) == transaction.amount
3. Create transaction
4. Create split + shares
5. Return full split

Tests: happy path, sum mismatch 422, type ≠ expense 422, rollback on mid-flow failure.
```

### Task 4.3: Retroactive Bundling

```prompt
Context: FR-7.5, FR-7.6.

POST /api/v1/splits/bundle — body has expense_transaction_id, income_transaction_ids, forgiven_shares array, notes.

Server:
1. Validate expense exists, type=expense, not already in a split
2. Validate each income exists, type=income, not already a settlement_transaction_id
3. Compute user own share = expense.amount - sum(incomes) - sum(forgiven)
4. Validate share >= 0
5. Create split
6. Create shares: one settled per income leg, one forgiven per entry, one for user share

Tests: happy path with mixed states, negative-share rejection 422, reused income transaction 409, already-split expense 409.
```

### Task 4.4: Settlement & Forgiveness

```prompt
Context: FR-7.7, FR-7.8.

PATCH /api/v1/split-shares/{id}/settle — body: { settlement_transaction_id } OR { create_income_transaction: {...} }
- Validates share is pending
- Validates settlement amount == share amount
- Sets status=settled, settled_at=now

PATCH /api/v1/split-shares/{id}/forgive — sets status=forgiven, forgiven_at=now

PATCH /api/v1/split-shares/{id}/unsettle — back to pending

Tests: settle existing, settle creating new, double-settle 409, forgive pending, amount mismatch 422.
```

### Task 4.5: Net Expense Calculation

```prompt
Context: FR-7.9.

Create /backend/app/services/expense_calculator.py:
- compute_net_expense(transaction) -> Decimal
- compute_net_expenses_bulk(transactions) -> dict
- is_reimbursement_income(transaction) -> bool

Add SQL view transaction_with_net_amount(transaction_id, gross_amount, net_amount, is_reimbursement) for report queries.

Tests: non-split returns gross, all-settled returns user share, all-forgiven returns gross, mixed correct, reimbursement detection.
```

### Task 4.6: Frontend — Split UIs

```prompt
Context: FR-7 UIs.

Three integrations:

1. components/SplitSharesEditor.tsx — used in TransactionForm when "split" toggle on. Rows of (payee, amount), live-computed user share, sum validation.

2. components/BundleAsSplitModal.tsx — opens from TransactionList when bulk selection includes >=1 expense and >=0 incomes. Lets user add forgiven shares. Live computes user share.

3. pages/SplitDetail.tsx — shows parent expense + shares + statuses; per pending share offers Settle (with sub-modal to link existing OR create new income transaction) and Forgive (confirm dialog).

Tests: editor sum validation, bundle modal validates before submit, settle/forgive trigger correct API calls.
```

---

## Milestone 5: Budgets

### Task 5.1: Budgets Schema

```prompt
Context: FR-8.

Model: Budget(id, user_id, name, amount, currency, period NULL, start_date NULL, end_date NULL, type, recurrence_rule NULL, parent_budget_id NULL, is_modified_instance, is_active, notes, timestamps, deleted_at).

Join: budget_categories(budget_id, category_id).

Tests: create each variant (recurring with RRULE; ad-hoc with dates; ad-hoc without dates).
```

### Task 5.2: Recurrence Expansion

```prompt
Context: FR-8.5.

services/budget_expander.py:
- expand_budget(budget, window_start, window_end) -> list[BudgetInstance]
  - recurring: parse RRULE via python-dateutil, return instances within window
  - ad-hoc with dates: single instance from dates
  - ad-hoc without dates, active: one open-ended instance
- BudgetInstance dataclass: (budget_id, start_date, end_date, amount, is_modified, modified_budget_id NULL, categories)

If a modified instance exists for a given start_date, use it instead of the template.

Tests: monthly RRULE → 12 in a year, weekly → ~4-5 in a month, modified override, ad-hoc paths.
```

### Task 5.3: Budgets CRUD with Scope Semantics

```prompt
Context: FR-8.6, FR-8.7.

Endpoints:
- POST /budgets
- GET /budgets (active by default; ?include_inactive=true)
- GET /budgets/{id}
- PATCH /budgets/{id}?scope=current_and_future|future_only
- DELETE /budgets/{id}?scope=instance|current_and_future|future_only

Edit semantics:
- future_only: clone budget at next recurrence boundary; old gets end_date
- current_and_future: edit in place

Delete semantics:
- instance: modified instance with amount=0
- future_only: end recurrence at next boundary
- current_and_future: soft delete

Ad-hoc: scope ignored.

Tests: every scope path.
```

### Task 5.4: Transaction-Budget Linking

```prompt
Context: FR-6.6, FR-7.11.

PATCH /transactions/{id} accepts budget_ids (full replacement).
POST /transactions accepts budget_ids.

GET /budgets/{id}/transactions — transactions linked to this instance, with date filter for the instance window.

Spent calc on dashboard: explicit links + category match auto-include. Response distinguishes mechanism per transaction.

Tests: link/unlink, spent recompute on add/edit/delete, auto-include by category match.
```

### Task 5.5: Frontend — Budgets

```prompt
Context: FR-8 UI.

Pages:
- pages/Budgets.tsx — list with progress bars (spent / amount)
- pages/BudgetDetail.tsx
- pages/BudgetForm.tsx — create/edit

Dialogs (recurring only):
- Edit dialog: checkbox "Also affect the current period?" (default checked)
- Delete dialog: three radio options

Ad-hoc: direct edit/delete.

Tests: dialog rendering by budget type, progress bar accuracy, scope param sent correctly.
```

---

## Milestone 6: Subscriptions & Piggy Banks

### Task 6.1: Subscriptions

```prompt
Context: FR-9.

Model: Subscription(id, user_id, name, amount, currency, billing_cycle, billing_day INT, last_billed_at NULL, account_id, payment_method_id NULL, category_id NULL, is_active, url, notes, timestamps, deleted_at).

services/subscription_dates.py:
- compute_next_billing_date(subscription, as_of=today) -> date
- status(subscription, as_of=today) -> "upcoming" | "due_soon" | "overdue"
  - due_soon: within 3 days; overdue: in the past

Endpoints: standard CRUD; POST /subscriptions/{id}/link-transaction; GET /subscriptions/{id}/history.

Transactions accept subscription_id on create/edit.

Tests: next-date for each cycle, status transitions, linking.
```

### Task 6.2: Piggy Banks

```prompt
Context: FR-10.

Models:
- PiggyBank(id, user_id, name, target_amount, currency, current_amount, target_date, notes, is_completed, timestamps, deleted_at)
- PiggyBankContribution(id, piggy_bank_id, transaction_id, contribution_type, amount, date, notes, created_at)

Endpoints: CRUD on piggy banks; POST/DELETE contributions; GET /piggy-banks/{id}/contributions.

current_amount = sum of contributions; updated transactionally. Auto-set is_completed when current_amount >= target_amount.

Tests: add/remove contribution updates total, auto-complete fires.
```

### Task 6.3: Frontend — Subscriptions & Piggy Banks

```prompt
Pages:
- pages/Subscriptions.tsx — list with status badges (green/amber/red)
- pages/SubscriptionForm.tsx
- pages/SubscriptionDetail.tsx — history
- pages/PiggyBanks.tsx — progress rings
- pages/PiggyBankForm.tsx
- pages/PiggyBankDetail.tsx — contributions + add

Tests: status badge colors, progress ring matches data, add contribution refetches.
```

---

## Milestone 7: Home Dashboard

### Task 7.1: Dashboard Endpoint

```prompt
Context: FR-14.

GET /api/v1/dashboard/home returns (one request, parallel sub-queries via asyncio.gather):
- month, total_spent_net, total_income
- budgets_summary: [{ budget, spent, percentage, status }]
- category_breakdown: [{ category, amount, percentage }]
- recent_transactions: last 10
- pending_splits_summary: { count, total_owed, by_payee }
- piggy_banks_summary: [{ piggy_bank, progress_percentage }]
- account_balances: [{ account, balance }]
- active_subscriptions: [{ subscription, next_date, status }]

Tests: structure complete, empty state safe, numbers cross-check vs individual endpoints.
```

### Task 7.2: Frontend — Dashboard

```prompt
Context: FR-14 UI.

pages/Dashboard.tsx with responsive grid:
- Hero stats row
- Budgets section
- Category breakdown chart (Recharts)
- Subscriptions section with status badges
- Pending splits card
- Piggy banks
- Recent transactions
- Account balances

Components:
- components/dashboard/BudgetProgressCard.tsx
- components/dashboard/CategoryBreakdownChart.tsx
- components/dashboard/SubscriptionStatusBadge.tsx
- components/dashboard/PiggyBankProgressRing.tsx

Mobile: single column. Desktop: 2-3 columns. Skeleton loaders during fetch.

Tests: each sub-component renders with sample data.
```

---

## Milestone 8: PDF Statement Import

### Task 8.1: Import Schema

```prompt
Context: FR-11.

Models:
- ImportBatch(id, user_id, source, filename, account_id NULL, status, total_parsed, total_confirmed, total_rejected, imported_at, completed_at NULL, verification_status enum NULL)
- RawImportRecord(id, batch_id, raw_text, parsed_json JSONB, status, transaction_id NULL, confidence, match_type, created_at)

Tests: CRUD via models, cascade behavior on batch deletion preserves confirmed records.
```

### Task 8.2: PDF Upload & Unlock

```prompt
Context: FR-11.1 / 11.2 first stages.

POST /api/v1/imports/pdf — multipart with file + optional password + account_id.

Backend:
1. Save to per-user temp dir
2. Create ImportBatch (status=pending)
3. Enqueue ARQ job process_pdf_import(batch_id)
4. Return batch immediately

Worker:
1. Load PDF
2. pikepdf unlock with password if supplied
3. On failure: batch.status=cancelled with error message
4. On success: continue to extraction

Tests: correct password unlocks, wrong fails gracefully, corrupted PDF fails gracefully.
```

### Task 8.3: HDFC PDF Parser

```prompt
Context: First bank parser. FR-11.2.

Create /backend/app/parsers/base.py:
class BaseBankParser(ABC):
    def can_parse(self, first_page_text: str) -> bool
    def parse(self, pdf_path: Path) -> ParsedStatement

ParsedStatement = { account_metadata, opening_balance, closing_balance, transactions: list[ParsedTransaction] }
ParsedTransaction = { date, value_date, description, debit, credit, balance }

Create /backend/app/parsers/banks/hdfc.py implementing the interface.

Use pdfplumber to extract tables. Write specifically for HDFC's layout.

Include 2-3 anonymized HDFC sample PDFs in /backend/tests/fixtures/parsers/hdfc/.

Create /backend/app/parsers/registry.py with detect_parser(pdf_path) iterating registered parsers.

Tests: parse sample → exact row count, balance equation holds; detection picks HDFC for HDFC samples; detection returns None for unrelated PDFs.
```

### Task 8.4: Balance Verification

```prompt
Context: FR-11.6.

services/balance_verifier.py:
- verify_statement(parsed) -> VerificationResult
  - opening + sum(credits) - sum(debits) == closing → "VERIFIED"
  - mismatch → "DISCREPANCY" with delta
  - missing balance fields → "INDETERMINATE"

Stored on ImportBatch.verification_status. If DISCREPANCY, batch flagged for manual review (but records still presented to user).

Tests: VERIFIED, DISCREPANCY with correct delta, INDETERMINATE.
```

### Task 8.5: Deduplication

```prompt
Context: FR-11.4.

services/dedup.py:
For each parsed record, find existing transactions on the same account where:
- abs(amount - parsed.amount) < 0.01
- transacted_at within ±3 days of parsed.date
- description similarity > 0.7 (rapidfuzz)

Matches → status=duplicate, match_type=fuzzy/exact, link to existing.
Non-matches → status=pending.

Tests: exact match detected, fuzzy match detected, different account isn't match, outside window isn't match.
```

### Task 8.6: Confirm / Reject Flow

```prompt
Context: FR-11.5.

Endpoints:
- GET /imports/{batch_id}/records — list with status grouping (new / duplicate / low-confidence)
- PATCH /imports/{batch_id}/records/{id} — edit parsed_json before confirming
- POST /imports/{batch_id}/confirm — body: { record_ids: [...] }
  - For each: create Transaction from parsed_json, link via raw_import_records.transaction_id
  - Atomic: all-or-nothing
  - Updates batch totals
- POST /imports/{batch_id}/reject — body: { record_ids: [...] }

Confirming a duplicate requires force=true flag.

Tests: confirm path, reject path, rollback on bad payload, duplicate-without-force rejected.
```

### Task 8.7: Frontend — Import Pages

```prompt
Pages:
- pages/Imports.tsx — list past batches with status
- pages/ImportUpload.tsx — file picker, password field, account selector
- pages/ImportReview.tsx — tabs (New | Duplicates | Low Confidence):
  - Per-row inline edit
  - Inline payee/category picker
  - Bulk select with Confirm/Reject buttons

Tests: upload triggers POST, review tabs group records, confirm/reject calls correct endpoints.
```

---

## Milestone 9: LLM Integration

### Task 9.1: LLMClient Interface

```prompt
Context: TDD section 4.8. Text-only interface for v1 (no vision).

Create /backend/app/llm/base.py:
class LLMClient(ABC):
    async def suggest_category(self, payee_name: str, description: str, available_categories: list[str]) -> str | None
    async def match_gpay_to_bank(self, gpay: list, bank: list) -> list[Match]

/backend/app/llm/factory.py:
def make_llm_client(settings) -> LLMClient
  - Returns OllamaClient or NullClient based on LLM_BACKEND env

NullClient returns None / empty results — for testing and "no LLM" mode.

Tests: factory dispatch, NullClient safety.
```

### Task 9.2: Ollama Implementation

```prompt
Context: LLM via local Ollama with qwen2.5:1.5b.

/backend/app/llm/ollama_client.py using the ollama Python package:

suggest_category:
- Build a structured prompt listing available_categories, payee, description
- Ask for single category name as plain text output
- Retry once on unrecognized output with stricter prompt
- Return None if still unrecognized

match_gpay_to_bank:
- Text-only fuzzy matcher; assists when amount+date doesn't yield a clean single match
- Asks LLM to pick best bank candidate per GPay record

Robust output parsing: handle markdown fences, retry on malformed.

Connects to OLLAMA_HOST. Uses LLM_MODEL env (default qwen2.5:1.5b).

Tests (mocked Ollama): category suggestion from a known list, malformed output retried, GPay matcher returns indices.
```

### Task 9.3: LLM Activity Log

```prompt
Context: NFR-2.4 transparency.

Model: LLMActivityLog(id, user_id, operation, payload_summary JSONB, backend, model, duration_ms, succeeded, created_at)

payload_summary holds a redacted view of what was sent:
- suggest_category: { payee, description_length, category_count }
- match_gpay_to_bank: { gpay_count, candidate_count }

Implement via a decorator wrapping LLMClient methods, or a middleware that intercepts calls.

Endpoint: GET /api/v1/settings/llm-activity?limit=50

Tests: every call logged, failures logged with succeeded=false.
```

### Task 9.4: Frontend — LLM Activity Page

```prompt
Add to Settings: pages/SettingsLLMActivity.tsx
- Table of recent LLM calls: timestamp, operation, backend, model, duration, success
- Expand row for payload_summary
- Filter by operation and backend

Tests: rendering, expansion shows summary, filters work.
```

---

## Milestone 10: GPay Takeout Enrichment

### Task 10.1: GPay Parser & Matcher

```prompt
Context: FR-12.

POST /api/v1/imports/gpay-takeout — accepts Takeout JSON.

services/gpay_matcher.py:
- parse_takeout(file) -> list[GPayRecord]
- match_records(gpay_records, user_id) -> list[MatchResult]
  - For each: find bank transactions within ±1 day, amount within 0.01
  - 1 candidate → exact match
  - 2+ → ambiguous
  - 0 → orphan
- For exact: auto-link, enrich bank transaction with merchant name (preserve original description; store enriched in a separate notes field or dedicated column)
- For ambiguous: persist as GPayMatch row for manual resolution

Model: GPayMatch(id, user_id, gpay_data JSONB, candidate_transaction_ids [UUID], chosen_transaction_id NULL, status enum, created_at).

When more than 2 candidates make a clean rule-based pick impossible, LLM may be invoked (LLMClient.match_gpay_to_bank) to suggest the best. Result is a suggestion, not auto-applied.

Tests: each match path, enrichment correctness, LLM only invoked when needed.
```

### Task 10.2: Frontend — GPay UI

```prompt
Pages:
- pages/GPayImport.tsx — upload Takeout
- pages/GPayResolve.tsx — ambiguous matches with side-by-side candidate selection
- pages/GPayOrphans.tsx — orphan records list

Resolution: GPay record on top, candidate options below with radio buttons + LLM suggestion if available, Confirm button.

Tests: resolution submits chosen_transaction_id, UI updates after.
```

---

## Milestone 11: Reports & Custom Dashboards

### Task 11.1: Read-Only Role & Query Endpoint

```prompt
Context: FR-15.3. Safe SQL execution.

Postgres setup:
- Create role app_readonly with SELECT on curated user-data tables (NOT users.password_hash, sessions, etc.)
- Backend maintains a separate SQLAlchemy engine using this role
- The role is provisioned in an Alembic migration

POST /api/v1/reports/query body: { sql, params? }
1. Parse SQL with sqlglot, enforce: SELECT only, must include user_id filter on top-level tables
2. Wrap in transaction: BEGIN; SET TRANSACTION READ ONLY; SET statement_timeout = '10s'; <sql>; ROLLBACK
3. Inject :user_id parameter
4. Limit result rows to 10K

Errors include actual PG error for debugging.

Tests: SELECT works, INSERT/UPDATE blocked (role), timeout enforced (pg_sleep(11)), missing user_id rejected, row limit enforced.
```

### Task 11.2: Schema Reference Endpoint

```prompt
Context: User-facing schema panel.

GET /api/v1/reports/schema returns:
{ tables: [{ name, description, columns: [{ name, type, description, foreign_key? }] }] }

Curated list — only user-data tables. Hand-written descriptions.

Tests: expected tables only, FKs populated.
```

### Task 11.3: Dashboards & Widgets CRUD

```prompt
Context: FR-15.1, 15.2.

Models:
- ReportDashboard(id, user_id, name, description, timestamps, deleted_at)
- ReportWidget(id, dashboard_id, title, query TEXT, viz_type, viz_config JSONB, position JSONB, timestamps)

position: { x, y, w, h } for 12-col grid.
viz_config: type-specific JSONB.

CRUD APIs for both.

Tests: CRUD, cascade on dashboard delete, access control.
```

### Task 11.4: Frontend — Reports

```prompt
Pages:
- pages/Reports.tsx — dashboard list
- pages/ReportDashboard.tsx — grid via react-grid-layout
- components/reports/QueryEditor.tsx — CodeMirror with SQL highlighting
- components/reports/SchemaReferencePanel.tsx — collapsible sidebar, clickable
- components/reports/StarterQueryLibrary.tsx — hardcoded templates:
  - Spending by category this month
  - Top 10 payees this year
  - Pending splits totals
  - Budget vs actual
  - Income vs expenses by month
  - Account balance history
- components/reports/WidgetRenderer.tsx — given { viz_type, viz_config, data }, renders
- components/reports/WidgetEditor.tsx — modal with query + viz_type + viz_config

Tests: grid persistence, widget rendering, schema panel click inserts at cursor.
```

---

## Milestone 12: Data Portability

### Task 12.1: JSON Archive Export

```prompt
Context: FR-16.1.

POST /api/v1/export creates a tar.gz:
- manifest.json: { schema_version, exported_at, user_id, table_list, record_counts }
- one JSON file per user-data table

UUIDs preserved as-is.

Run as ARQ job; return job_id. Status: GET /export/{job_id}. Download: GET /export/{job_id}/download.

Tests: round trip — export, unpack, verify all data; archive contains only authed user's data.
```

### Task 12.2: JSON Archive Import

```prompt
Context: FR-16.2.

POST /api/v1/import-archive accepts tar.gz. Worker:
1. Validate manifest schema_version
2. Load tables in dependency order
3. UUID conflict → fail with clear error
4. Atomic single DB transaction

Restricted to fresh user with no existing transactions (returns 409 otherwise).

Tests: round trip identical, conflict detection, malformed manifest fails gracefully.
```

### Task 12.3: CLI & Backup Scripts

```prompt
Context: Native backups + CLI tooling.

/infra/scripts/:
- backup.sh — pg_dump to timestamped file in BACKUP_DIR
- restore.sh — pg_restore from a dump file

Backend CLI (python -m app.cli):
- create-user --email X --password $(cat secret)
- export-archive --user-email X --output ./archive.tar.gz
- import-archive --user-email X --input ./archive.tar.gz

Tests: backup script produces non-empty dump, restore loads it, CLI commands work end-to-end.
```

### Task 12.4: Frontend — Export/Import UI

```prompt
Add to Settings:
- pages/SettingsDataExport.tsx — trigger export, poll for completion, present download
- pages/SettingsDataImport.tsx — file upload with safety warning if user has data

Tests: full flows with mocked API.
```

---

## Milestone 13: PWA & Polish

### Task 13.1: PWA Setup

```prompt
Context: NFR-3.2.

Configure vite-plugin-pwa:
- Manifest: name "Kanakku", short_name, theme_color, icons 192/512, display=standalone
- Service worker: precache static, network-first for API GETs
- Generate icons (commit to /frontend/public/icons/)

Verify: Chrome DevTools → Application → Manifest no errors; Lighthouse PWA ≥ 90; install prompt appears.
```

### Task 13.2: Mobile Audit

```prompt
Context: NFR-3.1.

Audit every page at 360px viewport:
- No horizontal scroll
- Tap targets ≥ 44x44 px
- Readable without zoom

Add components/MobileNav.tsx (bottom tab bar): Dashboard, Transactions, Add (FAB), Budgets, More.

Playwright snapshot test per page at 360px.
```

### Task 13.3: Soft Delete Recovery UI

```prompt
Context: NFR-4.2.

pages/RecentlyDeleted.tsx — tabbed view (Accounts | Payees | Categories | Tags | Transactions | Budgets | Subscriptions | Piggy Banks) showing items deleted within 30 days.

Restore button per item → calls POST /{entity}/{id}/restore.

ARQ scheduled task: daily purge items where deleted_at < now() - 30 days.

Tests: appearance within window, purge after, restore works.
```

---

## Milestone 14: Production Deployment

### Task 14.1: Caddyfile & Production Compose

```prompt
Context: NFR-1.1, NFR-6.4.

/infra/Caddyfile — two profiles:
- localhost: serves frontend static + reverse-proxies /api → backend, no TLS
- production: Let's Encrypt for ${PUBLIC_DOMAIN}

Update /infra/docker-compose.yml:
- Caddy as front-facing service (80/443)
- Frontend container produces static files only in prod (no dev server)
- Backend: uvicorn with multiple workers (2-3 on Pi 5)
- Healthchecks per service
- Resource limits sensible for Pi 5

Verify: docker compose up → working app at http://<pi-ip>/

Document Tailscale or other VPN approach for accessing the Pi 5 from outside the home network (recommended over public exposure).
```

### Task 14.2: Backup Automation

```prompt
Context: NFR-8.

/infra/scripts/auto-backup.sh:
- Nightly via cron or systemd timer
- pg_dump → compressed → BACKUP_DIR
- Rotate: keep 7 daily, 4 weekly, 12 monthly

Document cron entry in docs/operations.md.

Tests: script produces backup, rotation removes old files correctly.
```

### Task 14.3: Documentation

```prompt
README.md (root):
- Kanakku description
- Architecture overview (link to docs/tdd.md)
- Quick start: clone, copy env, docker compose up, init Ollama
- Deployment notes: Pi 5 setup, optional VPS
- Backup/restore commands
- Adding a new bank parser
- Contributing

docs/operations.md: operational runbook (backups, monitoring, log paths, common issues, Tailscale setup).

docs/api.md: links to /api/v1/docs (FastAPI's OpenAPI UI).

Lint markdown.
```

### Task 14.4: End-to-End Tests

```prompt
/frontend/e2e/ Playwright tests:

1. First-run setup → empty dashboard
2. Create account → payee → transaction → see in list + dashboard
3. Upload HDFC PDF → review → confirm → transactions appear
4. Create budget → link transaction → see spend on dashboard
5. Upfront split → settle one → forgive another → verify net expense
6. Retroactively bundle existing
7. Create custom dashboard widget
8. Export archive → import to fresh instance → identical data
9. Mobile full transaction flow at 360px viewport

CI runs against docker-compose stack.

All must pass before v1.0.0 tag.
```

---

## Integration & Final Testing

```prompt
Once all milestones complete:

1. Run `make test` (backend + frontend + e2e) — all green
2. Lighthouse: PWA ≥ 90, Performance ≥ 80
3. Deploy to a real Raspberry Pi 5; smoke-test all flows
4. Verify backups run, restore works
5. Verify JSON archive roundtrip across two instances
6. Audit LLM activity log: every call captured
7. Security audit:
   - All endpoints behind auth except setup/login/invite/health
   - argon2 confirmed
   - JWT secret env-only
   - Read-only role enforced
   - SQL injection blocked on query endpoint
8. axe-core accessibility audit — critical issues addressed
9. Document known limitations in docs/known-issues.md

Cut v1.0.0 tag. Publish ARM64 + AMD64 images to GHCR.
```