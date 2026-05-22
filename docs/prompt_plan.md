# Implementation Prompts for Personal Finance Tracker

> **Source of truth:** `personal-finance-tracker-tdd.md` (v2). Every prompt below assumes the implementing agent has read it.
> **Approach:** Test-Driven Development. Every task lists the tests to write *before* implementation.
> **Stack:** Python 3.12 + FastAPI + SQLAlchemy 2 + Postgres 16 (backend); Bun + Vite + React 19 + Tailwind + Radix (frontend); Docker Compose for orchestration.
> **Assumptions:** Monorepo (`/backend`, `/frontend`, `/infra`); GitHub Actions for CI; first PDF parser targets HDFC.

---

## Milestone 0: Foundation

### Task 0.1: Monorepo Structure

```prompt
Initialize a monorepo for the Personal Finance Tracker with the following layout:

/
├── backend/              # FastAPI app
├── frontend/             # React + Vite app
├── infra/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── env.example
├── docs/
│   └── tdd.md            # copy the v2 TDD here
├── .github/workflows/
├── .gitignore
├── README.md
└── LICENSE (MIT)

Create empty placeholder files where needed. Add a top-level README with a brief project description, link to docs/tdd.md, and a "Quick Start" stub that will be filled out later.

Add .gitignore entries for: Python (.venv, __pycache__, *.pyc, .pytest_cache), Node (node_modules, dist, .vite), env files (.env, .env.local), OS (.DS_Store), IDE (.idea, .vscode/settings.json), and Docker volumes.

No tests required for this task — it's pure scaffolding. Verify by running `tree -L 2` and confirming the structure matches.
```

### Task 0.2: Backend Bootstrap

```prompt
Context: We are setting up the FastAPI backend with SQLAlchemy 2 (async), Alembic migrations, pytest, and argon2 password hashing.

In /backend, create:
- pyproject.toml with dependencies: fastapi, uvicorn[standard], sqlalchemy[asyncio]>=2.0, asyncpg, alembic, pydantic, pydantic-settings, python-jose[cryptography], argon2-cffi, arq, redis, httpx
- Dev dependencies: pytest, pytest-asyncio, pytest-cov, httpx, factory-boy, ruff, mypy
- /backend/app/__init__.py
- /backend/app/main.py — FastAPI app with /health endpoint
- /backend/app/config.py — pydantic-settings BaseSettings loading from env vars
- /backend/app/db/session.py — async SQLAlchemy engine + session factory
- /backend/app/db/base.py — DeclarativeBase with type-annotated columns
- /backend/alembic.ini and /backend/alembic/ initialized
- /backend/tests/conftest.py — pytest fixtures (async test client, test DB)
- /backend/Dockerfile — multi-stage, Python 3.12-slim base

Tests to include:
- test_health.py: GET /health returns {"status": "ok"}
- test_db.py: DB connection fixture works, can execute SELECT 1

Run `pytest` and confirm all pass. Run `ruff check` and `mypy app` clean.
```

### Task 0.3: Frontend Bootstrap

```prompt
Context: Frontend uses Bun + Vite + React 19 + Tailwind + Radix UI. No Next.js — this is a pure SPA.

In /frontend, run `bun create vite . --template react-ts` then add:
- Tailwind CSS with PostCSS config
- Radix UI primitives (start with @radix-ui/react-dialog, react-dropdown-menu, react-tabs, react-toast)
- TanStack Query
- TanStack Router (file-based or code-based, your choice — note in code)
- Recharts
- vite-plugin-pwa
- Vitest + React Testing Library for tests

Structure:
/frontend
├── src/
│   ├── api/              # TanStack Query hooks
│   ├── components/       # reusable Radix+Tailwind components
│   ├── pages/            # route-level views
│   ├── lib/              # utilities
│   ├── styles/           # tailwind.css globals
│   ├── App.tsx
│   └── main.tsx
├── public/
├── vite.config.ts        # configure PWA plugin (disabled by default)
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── Dockerfile            # multi-stage, builds static assets served by nginx/caddy
└── index.html

Build a minimal App that:
- Renders "Personal Finance Tracker" heading
- Has a button using Radix Dialog primitive (just to confirm Radix works)
- Tailwind classes apply correctly

Tests to write:
- App.test.tsx: renders heading
- Button.test.tsx: clicking button opens dialog

Run `bun test`, confirm pass. Run `bun run build`, confirm clean build.
```

### Task 0.4: Docker Compose Dev Setup

```prompt
Context: We need a single docker-compose.yml in /infra that starts backend, frontend (dev mode), postgres, and redis. Same compose file will later be extended for production.

Create /infra/docker-compose.yml with services:
- postgres:16 with named volume pgdata, env from .env
- redis:7
- api: builds /backend, mounts source for hot reload, depends_on postgres + redis, exposes 8000
- frontend: builds /frontend, runs `bun run dev`, exposes 5173
- (Optional later: ollama, caddy)

Create /infra/env.example with all required vars from TDD section 4.9. Reference it in the README.

Tests:
- Manual: `docker compose -f infra/docker-compose.yml up` brings up all services
- Backend /health reachable at http://localhost:8000/health
- Frontend reachable at http://localhost:5173
- Postgres connection works from api container

Add a /infra/Makefile (or scripts/) with shortcuts: `make up`, `make down`, `make logs`, `make backend-shell`, `make psql`.
```

### Task 0.5: GitHub Actions CI

```prompt
Context: CI must run on every PR. Backend and frontend test suites run in parallel.

Create .github/workflows/ci.yml with two jobs:

backend:
- Sets up Python 3.12
- Installs deps via `pip install -e ./backend[dev]`
- Spins up postgres + redis services
- Runs: `ruff check`, `mypy`, `pytest --cov`
- Uploads coverage to artifact

frontend:
- Sets up Bun
- Runs `bun install`
- Runs `bun run lint` (configure eslint or biome)
- Runs `bun test`
- Runs `bun run build`

Trigger on: push to main, pull_request to main.

Confirm a dummy PR runs both jobs green.
```

---

## Milestone 1: Authentication & User Management

### Task 1.1: Users + Sessions Schema

```prompt
Context: Implementing FR-1 (authentication). Schema per TDD section 4.4.

Add SQLAlchemy models in /backend/app/models/:
- user.py: User(id UUID PK, email UNIQUE, password_hash, created_at)
- session.py: Session(id UUID PK, user_id FK, token_hash, expires_at, created_at)
- invite.py: InviteToken(id, created_by_user_id FK, token_hash, email nullable, expires_at, used_at, created_at)

Generate Alembic migration: `alembic revision --autogenerate -m "users_sessions_invites"`. Review the migration, ensure UUID columns use PostgreSQL UUID type, and timestamps use TIMESTAMPTZ.

Tests:
- test_models_users.py: can create user, email is unique, all timestamps default correctly
- test_migration.py: alembic upgrade head and downgrade base both succeed against a clean DB

Run pytest, confirm pass.
```

### Task 1.2: Password Hashing & JWT Utilities

```prompt
Context: argon2id for passwords (NFR-6.1), JWT for sessions (NFR-6.2).

Create /backend/app/security/:
- passwords.py: hash_password(plain) -> str, verify_password(plain, hash) -> bool — using argon2-cffi
- tokens.py: create_access_token(user_id, expires_in) -> str, create_refresh_token(user_id) -> str, decode_token(token) -> TokenPayload

Use HS256 with JWT_SECRET from config. Access token expires in 24h, refresh in 30d.

Tests:
- test_passwords.py: hash differs each call (salting), verify returns True for correct/False for wrong
- test_tokens.py: round-trip create+decode preserves user_id, expired token raises, tampered token raises
```

### Task 1.3: First-Run Setup Endpoint

```prompt
Context: FR-1.3 — when DB has zero users, expose POST /api/v1/auth/setup to create the first user. After first user exists, the endpoint returns 404.

Add /backend/app/api/v1/auth.py with:
- POST /auth/setup — body: {email, password}. If users exist, return 404. Otherwise create user, return user object + access token + refresh token.
- A dependency `assert_no_users_exist` that returns 404 when users exist.

Tests:
- test_setup.py: 
  - first call succeeds, returns tokens
  - second call returns 404
  - invalid email format returns 422
  - weak password (<8 chars) returns 422
```

### Task 1.4: Login & Session Endpoints

```prompt
Context: Standard login, logout, and "current user" endpoints.

Add to /backend/app/api/v1/auth.py:
- POST /auth/login — body: {email, password} -> {access_token, refresh_token, user}
- POST /auth/logout — invalidates refresh token (delete session row), returns 204
- GET /auth/me — returns current authenticated user
- POST /auth/refresh — body: {refresh_token} -> new access_token

Implement an auth dependency `get_current_user` that decodes the access token from Authorization: Bearer header.

Tests:
- test_login.py: valid creds return tokens, wrong password 401, nonexistent email 401
- test_logout.py: requires auth, invalidates refresh token
- test_me.py: returns logged-in user
- test_refresh.py: valid refresh returns new access token, invalid refresh 401
```

### Task 1.5: Invite Token System

```prompt
Context: FR-1.4 — additional users only via invite tokens.

Add endpoints:
- POST /auth/invites (auth required) — body: {email?, expires_in_days?=7} -> {invite_url, expires_at}
- POST /auth/accept-invite — body: {token, password} -> creates user, returns tokens
- GET /auth/invites/{token}/info — public endpoint to preview an invite (returns inviter email + email recipient if specified)

Tokens stored hashed in DB (don't store the plain token). The URL contains the plain token; only the hash is in DB.

Tests:
- test_invite.py:
  - creates invite, can be redeemed
  - expired invite returns 410
  - already-used invite returns 410
  - invalid token returns 404
  - new user created via invite gets a session
```

### Task 1.6: Frontend Auth Pages

```prompt
Context: Setup wizard + Login + Session management on the React frontend.

Create:
- /frontend/src/pages/Setup.tsx — first-run wizard. Checks GET /auth/setup-status (add this endpoint if helpful) or attempts setup directly. If 404, redirects to login.
- /frontend/src/pages/Login.tsx — email + password form
- /frontend/src/pages/AcceptInvite.tsx — reads ?token= from URL, shows password setup form
- /frontend/src/api/auth.ts — TanStack Query hooks: useLogin, useLogout, useMe, useSetup, useAcceptInvite
- /frontend/src/lib/auth-storage.ts — store tokens in memory + refresh token in HttpOnly cookie (if backend can set) or localStorage with documented caveat
- /frontend/src/components/AuthGuard.tsx — wraps protected routes, redirects to /login if not authed

Routing:
- /setup (only accessible when no user exists)
- /login (public)
- /accept-invite (public)
- All other routes wrapped in AuthGuard

Tests:
- Login.test.tsx: renders form, submits credentials, calls login mutation
- AuthGuard.test.tsx: redirects unauthenticated users
- Mock the API layer in tests with MSW or similar
```

---

## Milestone 2: User Settings & Core Entities

### Task 2.1: User Settings

```prompt
Context: FR-2 — user settings (primary currency, timezone, etc.).

Model: UserSettings(user_id PK FK→users, primary_currency, timezone, date_format, number_format, llm_backend_preference NULL, updated_at)

On user creation (in setup + accept-invite), automatically create a default UserSettings row with primary_currency="INR", timezone="Asia/Kolkata", sensible defaults.

API:
- GET /api/v1/settings — returns current user's settings
- PATCH /api/v1/settings — partial update

Tests:
- test_settings.py: default settings created on user signup, GET returns them, PATCH updates them, only the authed user's settings are accessible
```

### Task 2.2: Accounts CRUD

```prompt
Context: FR-3. Schema per TDD 4.4.

Model: Account(id, user_id FK, name, type enum, currency, opening_balance, current_balance, is_active, timestamps, deleted_at)

Type enum: bank, cash, credit_card, loan.

API:
- POST /accounts — create
- GET /accounts — list (excludes soft-deleted by default; ?include_deleted=true to include)
- GET /accounts/{id}
- PATCH /accounts/{id}
- DELETE /accounts/{id} — soft delete (sets deleted_at)
- POST /accounts/{id}/restore — clears deleted_at (within 30 days)

current_balance starts at opening_balance on creation. Will be updated by transaction creation later — for now keep as a stored field.

All endpoints scoped to authed user (filter by user_id).

Tests:
- CRUD happy path
- Cannot access another user's accounts (returns 404)
- Soft delete + restore work
- Currency defaults to user's primary_currency if not specified
- After 30 days, deleted accounts cannot be restored (write a test that backdates deleted_at)
```

### Task 2.3: Payment Methods CRUD

```prompt
Context: FR-3.3 / FR-3.4. Payment methods attached to accounts.

Model: PaymentMethod(id, account_id FK, type enum, label, upi_app NULL, is_active, timestamps, deleted_at)

Type enum: debit_card, credit_card, netbanking, upi. upi_app only allowed when type=upi (validate this).

API: nested under accounts:
- GET /accounts/{account_id}/payment-methods
- POST /accounts/{account_id}/payment-methods
- PATCH /payment-methods/{id}
- DELETE /payment-methods/{id}

Validate: cannot create a payment method on an account belonging to another user.

Tests:
- type=upi requires upi_app to be valid (or omitted)
- type=debit_card with upi_app set → 422
- access control: other user's account → 404
```

### Task 2.4: Payees CRUD

```prompt
Context: FR-4.

Model: Payee(id, user_id, name, type enum, notes, is_active, timestamps, deleted_at).
Join table: payee_default_categories(payee_id, category_id) — composite PK.

Type enum: merchant, person, business, other. No UPI ID field (per user feedback).

API: standard CRUD plus a list endpoint with optional filter by type and search by name (substring).

Default categories: when fetching a payee, eager-load default categories. PATCH supports updating the default categories list (full replacement semantics).

Tests:
- Create payee with default categories — round trip
- Search by name (case-insensitive substring) returns matches
- Filter by type
- Cannot reference another user's categories as defaults (return 422)
```

### Task 2.5: Categories CRUD

```prompt
Context: FR-5.1, FR-5.2.

Model: Category(id, user_id, name, icon, color, applicability NULL enum, timestamps, deleted_at).
Applicability enum: expense, income, both. Nullable — when null, allowed on any transaction.

API: standard CRUD.

Optionally seed a default set of categories on first user creation (food, transport, entertainment, salary, etc.) — make this a separate optional endpoint POST /categories/seed-defaults that the frontend can call.

Tests:
- CRUD
- Seed defaults creates expected categories
- Soft delete + restore
```

### Task 2.6: Tags CRUD

```prompt
Context: FR-5.3.

Model: Tag(id, user_id, name, color, timestamps, deleted_at). Name unique per user.

API: standard CRUD. Name uniqueness enforced via unique constraint (user_id, name).

Tests:
- CRUD
- Duplicate name returns 409
- Soft delete frees the name for reuse (test: delete, create same name, succeeds)
```

### Task 2.7: Frontend — Settings Page

```prompt
Context: Build the Settings page for FR-2.

Create /frontend/src/pages/Settings.tsx with:
- A form bound to GET /settings, PATCH /settings via TanStack Query
- Fields: primary currency (dropdown with common currencies + custom), timezone (dropdown), date format, number format, LLM backend preference (advanced section)
- Save button with optimistic update and toast on success/failure

Component breakdown:
- /frontend/src/components/forms/SettingsForm.tsx — the form
- /frontend/src/api/settings.ts — TanStack Query hooks

Style with Tailwind. Use Radix Select for dropdowns.

Tests:
- SettingsForm renders with default values
- Saving calls PATCH with the modified fields only
- Toast appears on success
```

### Task 2.8: Frontend — Accounts, Payees, Categories, Tags Pages

```prompt
Context: Build management pages for these core entities.

For each entity (Account, Payee, Category, Tag):
- Create /frontend/src/pages/{Entity}List.tsx — list view with create button, edit/delete actions
- Create /frontend/src/components/forms/{Entity}Form.tsx — used in both create and edit modals
- Create /frontend/src/api/{entity}.ts — TanStack Query hooks

For Accounts, also show payment methods inline (expand row to show + add).

All pages must be mobile-responsive — tables become cards on small screens.

Reusable components to create:
- /frontend/src/components/DataTable.tsx — table with mobile fallback
- /frontend/src/components/EntityModal.tsx — generic create/edit modal using Radix Dialog
- /frontend/src/components/ConfirmDialog.tsx — for delete confirmations

Tests:
- DataTable renders rows; renders cards under viewport breakpoint
- Each entity page renders the list, opens the modal, and submits forms correctly (mock API)
```

---

## Milestone 3: Transactions (Core)

### Task 3.1: Transactions Schema

```prompt
Context: FR-6.

Model: Transaction(
  id, user_id,
  type enum(expense/income/transfer),
  transacted_at TIMESTAMPTZ NOT NULL,
  amount Numeric(15, 2), currency,
  description, notes,
  account_id FK→accounts,
  payment_method_id FK→payment_methods NULL,
  payee_id FK→payees NULL,
  to_account_id FK→accounts NULL,
  to_amount NULL, to_currency NULL,
  subscription_id FK→subscriptions NULL  -- will be added later, leave nullable for now
  import_record_id FK→raw_import_records NULL,  -- same
  timestamps, deleted_at
)

Join tables:
- transaction_categories(transaction_id, category_id)
- transaction_tags(transaction_id, tag_id)
- transaction_budgets(transaction_id, budget_id)  -- will populate later, just create table

Indexes: (user_id, transacted_at DESC), (user_id, account_id, transacted_at DESC), (user_id, deleted_at).

Tests:
- test_transaction_model.py: create transaction with categories and tags via the join tables; eager loading works
- Constraints: type=transfer requires to_account_id; type≠transfer requires to_account_id IS NULL
```

### Task 3.2: Transactions CRUD

```prompt
Context: FR-6 API.

Endpoints:
- POST /transactions — create. Validates type-specific rules.
- GET /transactions — list with filters: ?type=, ?account_id=, ?payee_id=, ?category_id=, ?tag_id=, ?from=&to=, ?budget_id=, ?cursor=&limit= (default 50)
- GET /transactions/{id}
- PATCH /transactions/{id}
- DELETE /transactions/{id} — soft delete
- POST /transactions/{id}/restore

Currency:
- Defaults to account's currency if omitted
- Can be overridden per FR-6.4
- For transfers, source currency = source account currency by default, to_currency = destination account currency by default; both can be overridden

Cursor pagination by (transacted_at DESC, id DESC). Encode cursor as base64 of "transacted_at:id".

When a transaction is created/edited/deleted, recompute the account's current_balance (and to_account_id's balance for transfers) within the same DB transaction.

Tests:
- Comprehensive: create each type, list with each filter combination, edit, delete, restore
- Balance correctness: create + delete + restore round-trip leaves balance unchanged
- Currency override works
- Filters and cursor pagination work as expected
- Multi-category and multi-tag handling
```

### Task 3.3: Frontend — Transaction Form

```prompt
Context: FR-13. Structured form, no LLM, no compact text syntax.

Create /frontend/src/pages/TransactionForm.tsx (handles both create and edit modes via route param).

Fields:
- Type toggle (expense / income / transfer)
- Date + time (transacted_at) — default to "now" using user's timezone
- Amount + currency selector (defaults from settings, overrideable)
- Account select (autocomplete) — for transfers, both source and destination
- Payment method select (filtered by selected account)
- Payee autocomplete with "create new" inline
- Categories multi-select (pre-filled by payee's defaults when payee selected)
- Tags multi-select
- Description (single line) and Notes (textarea)
- Save / Cancel buttons

When payee is selected, auto-populate categories (overrideable).

Components:
- /frontend/src/components/forms/TransactionForm.tsx
- /frontend/src/components/Autocomplete.tsx — reusable, supports inline creation

Tests:
- All fields render
- Type=transfer shows to_account_id picker; other types hide it
- Selecting a payee with defaults pre-populates categories
- Submitting calls POST or PATCH appropriately
- Validation: amount > 0, account required, etc.
```

### Task 3.4: Frontend — Transaction List

```prompt
Context: FR-6 list UI.

Create /frontend/src/pages/Transactions.tsx with:
- Filters panel: date range, account, type, category, tag, payee, search by description
- Transaction list / table:
  - Desktop: dense table with columns date, payee, amount, account, categories, tags, actions
  - Mobile: card per transaction
- Infinite scroll using TanStack Query's useInfiniteQuery with cursor pagination
- Row click → edit
- Bulk select with checkboxes (needed for retroactive split bundling in next milestone) — add the UI now but bundle action button is added later
- Filter state synced to URL search params

Tests:
- Filters update URL and refetch
- Infinite scroll loads next page
- Mobile card layout under breakpoint
```

---

## Milestone 4: Splits

### Task 4.1: Splits Schema + Invariant

```prompt
Context: FR-7. Splits as a separate entity, not a transaction type.

Models:
- Split(id, user_id, expense_transaction_id FK UNIQUE, notes, timestamps, deleted_at)
- SplitShare(id, split_id FK, payee_id NULL FK, amount, status enum, settled_at NULL, settlement_transaction_id NULL FK, forgiven_at NULL, notes, timestamps)

Status enum: pending, settled, forgiven.

INVARIANT: sum(SplitShare.amount where split_id=X) MUST equal Split.expense_transaction.amount.

Enforce in two places:
1. Application: a service-layer function `validate_split_invariant(split_id)` raises on violation.
2. Database: a deferred CHECK constraint OR a trigger. Implement whichever is cleaner with SQLAlchemy/Postgres — a trigger function `check_split_invariant()` fired after INSERT/UPDATE/DELETE on split_shares.

Tests:
- Create split with shares summing to expense → succeeds
- Create split with shares summing to ≠ expense → raises
- Update a share amount such that sum ≠ expense → raises
- Delete a share leaving sum < expense → raises
```

### Task 4.2: Upfront Split Creation API

```prompt
Context: FR-7.4. Atomically create an expense transaction + its split + shares.

POST /api/v1/splits with body:
{
  "transaction": { ... full transaction payload ... },
  "shares": [
    { "payee_id": "...", "amount": 500 },
    { "payee_id": null, "amount": 500 },        # user's own share
    ...
  ],
  "notes": "..."
}

Server:
1. Validates the transaction is type=expense
2. Validates sum(shares) == transaction.amount
3. Creates the transaction
4. Creates the split + shares
5. Returns the full split with nested transaction and shares

All in one DB transaction; rollback on any failure.

Tests:
- Happy path: full round trip
- Sum mismatch returns 422
- Transaction type != expense returns 422
- Failure mid-flow rolls back (test: include a deliberately bad share)
```

### Task 4.3: Retroactive Bundling API

```prompt
Context: FR-7.5 / 7.6. User selects existing transactions and bundles them.

POST /api/v1/splits/bundle with body:
{
  "expense_transaction_id": "...",
  "income_transaction_ids": ["...", "..."],
  "forgiven_shares": [
    { "payee_id": "...", "amount": 500 }
  ],
  "notes": "..."
}

Server:
1. Validates expense exists, is type=expense, not already in a split
2. Validates each income transaction exists, is type=income, not already a settlement_transaction_id elsewhere
3. Computes user's own share = expense.amount - sum(income amounts) - sum(forgiven amounts)
4. Validates user share >= 0
5. Creates the split
6. Creates shares:
   - One per income transaction, status=settled, settlement_transaction_id set, payee_id derived from the income transaction's payee
   - One per forgiven entry, status=forgiven, forgiven_at=now
   - One for user's own share, payee_id=NULL, status=settled (it's not really "settled" but the model treats user's share as inherently accounted for — alternatively introduce a distinct status; document this choice)

Tests:
- Happy path with mix of settled and forgiven shares
- User share would be negative → 422
- Reusing an income transaction already used elsewhere → 409
- Bundling an already-split expense → 409
```

### Task 4.4: Settlement & Forgiveness Endpoints

```prompt
Context: FR-7.7, FR-7.8.

Endpoints:
- PATCH /api/v1/split-shares/{id}/settle
  - Body: { "settlement_transaction_id": "..." }  OR  { "create_income_transaction": { ... transaction payload ... } }
  - If existing: link it. If new: create the income transaction first, then link.
  - Validates the share is currently pending.
  - Validates settlement transaction is type=income, amount matches share amount.
  - Sets status=settled, settled_at=now.

- PATCH /api/v1/split-shares/{id}/forgive
  - No body.
  - Validates share is pending.
  - Sets status=forgiven, forgiven_at=now.

- PATCH /api/v1/split-shares/{id}/unsettle  (escape hatch)
  - Returns share to pending, clears settlement.

Tests:
- Settle with existing transaction
- Settle with newly-created transaction
- Cannot settle already-settled share
- Forgive pending share works
- Amount mismatch on settlement returns 422
```

### Task 4.5: Net Expense Calculation Utility

```prompt
Context: FR-7.9. Reports and dashboard need net expense, not gross.

Create /backend/app/services/expense_calculator.py with:
- compute_net_expense(transaction) -> Decimal
  - If transaction is not in a split: returns transaction.amount
  - If in a split: returns user_own_share + sum(forgiven_shares)
- compute_net_expenses_bulk(transactions) -> dict[transaction_id, Decimal]
  - Single query optimization

Also: a helper to identify reimbursement income (income transactions referenced as settlement_transaction_id in any split_share).

Add a SQL view `transaction_with_net_amount` that exposes (transaction_id, gross_amount, net_amount, is_reimbursement) for use by report queries.

Tests:
- Non-split transaction: net == gross
- Split with all settled: net == user share
- Split with all forgiven: net == gross
- Split with mix: net == user share + forgiven
- Reimbursement income identification works
```

### Task 4.6: Frontend — Split UIs

```prompt
Context: FR-7 user interface.

Three UIs needed:

1. Upfront split toggle in TransactionForm:
   - "This is a split" checkbox
   - When toggled, shows a shares editor: rows of (payee, amount), with an "Add row" button
   - User's own share is auto-computed and shown as a non-editable row labeled "Your share"
   - Submit calls POST /splits with the bundled payload

2. Retroactive bundling on TransactionList:
   - When 2+ transactions are selected with at least one expense and one income, show a "Bundle as Split" action button
   - Opens a modal showing the selected transactions, lets user add forgiven shares, computes user share live
   - Submit calls POST /splits/bundle

3. Split detail view:
   - Shows the parent expense, all shares, statuses
   - Per pending share: "Settle" and "Forgive" buttons
   - Settle opens a sub-modal: link existing income transaction OR create new
   - Forgive opens a confirm dialog

Components:
- /frontend/src/components/SplitSharesEditor.tsx
- /frontend/src/components/BundleAsSplitModal.tsx
- /frontend/src/pages/SplitDetail.tsx

Tests:
- SplitSharesEditor: adding rows updates user share live, sum validation
- BundleAsSplitModal: validates sum constraint before allowing submit
- Settle/forgive actions trigger correct API calls
```

---

## Milestone 5: Budgets

### Task 5.1: Budgets Schema

```prompt
Context: FR-8. Recurring with RRULE + ad-hoc with optional dates.

Model: Budget(
  id, user_id, name, amount, currency,
  period enum(week/month/quarter/year/custom) NULL,
  start_date NULL, end_date NULL,
  type enum(recurring/adhoc),
  recurrence_rule TEXT NULL,    -- iCalendar RRULE string
  parent_budget_id FK→budgets NULL,
  is_modified_instance BOOL DEFAULT false,
  is_active BOOL DEFAULT true,   -- used when no time period
  notes, timestamps, deleted_at
)

Join: budget_categories(budget_id, category_id).

Tests:
- Create recurring budget with RRULE
- Create ad-hoc budget with dates
- Create ad-hoc budget without dates (uses is_active)
- Modified instance has parent_budget_id set
```

### Task 5.2: Recurrence Expansion

```prompt
Context: FR-8.5. Compute budget instances for any date range.

Service: /backend/app/services/budget_expander.py with:
- expand_budget(budget, window_start, window_end) -> list[BudgetInstance]
  - If type=adhoc: returns a single instance based on dates (or [if active and no dates] one open-ended instance)
  - If type=recurring: parses RRULE via python-dateutil, returns one instance per occurrence within window
- BudgetInstance dataclass: (budget_id, start_date, end_date, amount, is_modified, modified_budget_id NULL, categories[])

When expanding, if a modified instance exists for a given start_date, use the modified amount/categories instead of the template.

Tests:
- Monthly recurring budget for 12 months → 12 instances
- Weekly recurring budget within a month → ~4-5 instances
- Modified instance overrides template
- Ad-hoc with dates returns one instance
- Ad-hoc without dates active → one open-ended instance
- Ad-hoc inactive → no instances
```

### Task 5.3: Budgets CRUD with Scope Semantics

```prompt
Context: FR-8.6, FR-8.7. Edit and delete have scope choices.

API:
- POST /budgets — create
- GET /budgets — list active (default), with ?include_inactive=true
- GET /budgets/{id} — detail
- PATCH /budgets/{id}?scope=current_and_future|future_only — edit
- DELETE /budgets/{id}?scope=instance|current_and_future|future_only

Scope semantics for edit:
- future_only: clones the budget at the next recurrence boundary; old budget gets an end_date at that boundary. New budget has the new fields.
- current_and_future: edits the budget in place. The currently-active instance reflects the change.

Scope semantics for delete:
- instance: creates a modified instance with amount=0 (effectively suppressing this period)
- future_only: sets the budget's recurrence end at the next boundary
- current_and_future: soft deletes the budget

For ad-hoc budgets: scope is ignored (no recurrence).
For modified instances: scope is "this instance only".

Tests:
- Edit recurring budget future_only: query at current date returns old amount, at next period returns new
- Edit recurring budget current_and_future: query at current date returns new amount
- Delete instance: that instance shows amount=0
- Delete future_only: instances past boundary disappear
- Delete current_and_future: budget gone from active list
```

### Task 5.4: Linking Transactions to Budgets

```prompt
Context: FR-6.6, FR-7.11.

API addition:
- PATCH /transactions/{id} now accepts a `budget_ids` array; full replacement semantics.
- POST /transactions also accepts `budget_ids`.

Add convenience endpoint:
- GET /budgets/{id}/transactions — list transactions linked to this budget instance (with date filtering based on the instance window)

Also: when listing budgets in /dashboard/home, compute spent vs amount per budget using the net expense calculation.

Tests:
- Link/unlink transactions
- Spent calculation: a transaction with categories matching the budget's category scope counts even without explicit linking? Decide policy here: explicit linking only (per TDD), OR auto-include by category match (more user-friendly).
  - Recommend: auto-include by category match + explicit linking. Make this clear in the API response (which transactions counted via which mechanism).
- Recompute spent values when transactions are added/edited/deleted
```

### Task 5.5: Frontend — Budgets

```prompt
Context: FR-8 UI.

Pages:
- /frontend/src/pages/Budgets.tsx — list of active budgets with progress bars (spent / amount)
- /frontend/src/pages/BudgetDetail.tsx — single budget view with linked transactions
- /frontend/src/pages/BudgetForm.tsx — create/edit

Edit/delete dialogs:
- On edit of a recurring budget, show a Radix Dialog with checkbox "Also affect the current period?" (default checked). Submit hits PATCH with scope param accordingly.
- On delete of a recurring budget, show a Radix Dialog with three radio options matching the API scope values.
- For ad-hoc budgets, skip the dialogs and edit/delete directly.

Show different UI affordances based on budget type and active state.

Tests:
- Edit dialog renders for recurring budgets, hidden for ad-hoc
- Delete dialog with three options renders for recurring
- Progress bar reflects spent / amount
```

---

## Milestone 6: Subscriptions & Piggy Banks

### Task 6.1: Subscriptions

```prompt
Context: FR-9.

Model: Subscription(
  id, user_id, name, amount, currency,
  billing_cycle enum,
  billing_day INT,             -- day of month for monthly, day of week for weekly, etc.
  last_billed_at TIMESTAMPTZ NULL,
  account_id FK, payment_method_id FK NULL, category_id FK NULL,
  is_active, url, notes,
  timestamps, deleted_at
)

Service: /backend/app/services/subscription_dates.py
- compute_next_billing_date(subscription, as_of=today) -> date
  - If last_billed_at: next = last_billed_at + cycle, advancing if past
  - Else: based on billing_day relative to today
- status(subscription, as_of=today) -> "upcoming" | "due_soon" | "overdue"
  - upcoming: next_date > today + 3 days
  - due_soon: next_date within 3 days
  - overdue: next_date < today

API:
- Standard CRUD
- POST /subscriptions/{id}/link-transaction { transaction_id } — back-link existing transactions
- GET /subscriptions/{id}/history — transactions linked to this subscription

Update transactions endpoint to accept subscription_id on create/edit.

Tests:
- Next date calculation for each cycle
- Status transitions
- Linking transactions
```

### Task 6.2: Piggy Banks

```prompt
Context: FR-10.

Models:
- PiggyBank(id, user_id, name, target_amount, currency, current_amount, target_date, notes, is_completed, timestamps, deleted_at)
- PiggyBankContribution(id, piggy_bank_id, transaction_id, contribution_type enum(transfer/expense), amount, date, notes, created_at)

API:
- Standard CRUD on piggy_banks
- POST /piggy-banks/{id}/contributions { transaction_id, contribution_type, notes }
- DELETE /piggy-banks/{id}/contributions/{contribution_id}
- GET /piggy-banks/{id}/contributions

current_amount = sum of all contribution amounts; update transactionally on contribution add/remove.

Mark is_completed=true automatically when current_amount >= target_amount; the user can override.

Tests:
- Add transfer contribution → current_amount updates
- Add expense contribution → current_amount updates
- Remove contribution → current_amount decreases
- Auto-completion fires at threshold
```

### Task 6.3: Frontend — Subscriptions & Piggy Banks

```prompt
Context: UI for FR-9 and FR-10.

Pages:
- /frontend/src/pages/Subscriptions.tsx — list with next-date and status badges
- /frontend/src/pages/SubscriptionForm.tsx
- /frontend/src/pages/SubscriptionDetail.tsx — history of linked transactions
- /frontend/src/pages/PiggyBanks.tsx — list with progress rings
- /frontend/src/pages/PiggyBankForm.tsx
- /frontend/src/pages/PiggyBankDetail.tsx — contributions list, add contribution flow

Status badges color-coded: green=upcoming, amber=due_soon, red=overdue.

Tests:
- Status badge renders correct color
- Progress ring matches current/target
- Adding contribution refetches piggy bank
```

---

## Milestone 7: Home Dashboard

### Task 7.1: Dashboard Aggregation Endpoint

```prompt
Context: FR-14.

GET /api/v1/dashboard/home returns (in a single request):
{
  "month": "2026-05",
  "total_spent_net": ...,
  "total_income": ...,
  "budgets_summary": [{ budget, spent, percentage, status }, ...],
  "category_breakdown": [{ category, amount, percentage }, ...],
  "recent_transactions": [...last 10...],
  "pending_splits_summary": { count, total_owed_to_user, by_payee: [...] },
  "piggy_banks_summary": [{ piggy_bank, progress_percentage }, ...],
  "account_balances": [{ account, balance }, ...],
  "active_subscriptions": [{ subscription, next_date, status }, ...]
}

Implementation: parallelize the sub-queries server-side (asyncio.gather).

Tests:
- Returns full structure
- Empty state (new user with no data) doesn't error
- Numbers match individual endpoint queries (cross-check)
```

### Task 7.2: Frontend — Dashboard

```prompt
Context: FR-14 UI.

Create /frontend/src/pages/Dashboard.tsx with a responsive grid:
- Hero stats row: total spent (net), income, savings rate
- Budgets section: each active budget with progress bar
- Category breakdown chart (Recharts pie or bar)
- Subscriptions section: list with status badges and next-date
- Pending splits card
- Piggy banks progress
- Recent transactions list
- Account balances

Mobile: single column, stacked. Desktop: 2-3 column responsive grid.

Components:
- /frontend/src/components/dashboard/BudgetProgressCard.tsx
- /frontend/src/components/dashboard/CategoryBreakdownChart.tsx
- /frontend/src/components/dashboard/SubscriptionStatusBadge.tsx
- /frontend/src/components/dashboard/PiggyBankProgressRing.tsx

Tests:
- All sub-components render with sample data
- Skeleton loaders during fetch
```

---

## Milestone 8: PDF Statement Import

### Task 8.1: Import Schema

```prompt
Context: FR-11.

Models:
- ImportBatch(id, user_id, source enum, filename, account_id NULL, status enum, total_parsed, total_confirmed, total_rejected, imported_at, completed_at NULL)
- RawImportRecord(id, batch_id, raw_text, parsed_json JSONB, status enum, transaction_id NULL, confidence enum, match_type enum, created_at)

Tests:
- CRUD via models
- Cascade behavior on batch deletion (RawImportRecords cascade-deleted unless they have transaction_id → in that case preserve the link)
```

### Task 8.2: PDF Upload & Unlock

```prompt
Context: FR-11.1, FR-11.2 first stages.

POST /api/v1/imports/pdf — multipart form with `file` (PDF) and optional `password` and `account_id`.

Backend:
1. Saves file to a per-user temp directory
2. Creates an ImportBatch row with status=pending
3. Enqueues an ARQ job: process_pdf_import(batch_id)
4. Returns the batch immediately

Worker:
1. Loads the PDF, unlocks with pikepdf if password provided
2. If unlock fails, mark batch status=cancelled with error message
3. Saves unlocked PDF; updates batch

Tests:
- Upload with correct password unlocks
- Upload with wrong password fails gracefully
- Upload of corrupted PDF fails gracefully
- Batch status transitions correctly
```

### Task 8.3: HDFC PDF Parser

```prompt
Context: First bank parser. FR-11.2.

Create /backend/app/parsers/banks/hdfc.py implementing:
class HDFCParser(BaseBankParser):
    def can_parse(self, pdf_text_first_page: str) -> bool
    def parse(self, pdf_path: Path) -> ParsedStatement

ParsedStatement = { account_metadata, opening_balance, closing_balance, transactions: [ParsedTransaction] }
ParsedTransaction = { date, value_date, description, debit, credit, balance }

Use pdfplumber to extract tables. HDFC statement layout follows a known pattern — write the parser specifically for that. Include sample anonymized PDFs in /backend/tests/fixtures/parsers/hdfc/ for testing.

Also create /backend/app/parsers/registry.py with a function `detect_parser(pdf_path) -> BaseBankParser` that loops through registered parsers calling can_parse on each.

Tests:
- Parse sample HDFC statement → exact row count, balance equation holds
- Detection picks HDFC parser for HDFC samples
- Detection returns None for unrelated PDFs
```

### Task 8.4: Balance Verification

```prompt
Context: FR-11.6.

Create /backend/app/services/balance_verifier.py with:
- verify_statement(parsed_statement) -> VerificationResult
  - opening + sum(credits) - sum(debits) == closing → "VERIFIED"
  - mismatch → "DISCREPANCY" with the actual delta
  - missing balance fields → "INDETERMINATE"

Verification result is stored on the ImportBatch (add a verification_status column).

Tests:
- Sample with correct balance returns VERIFIED
- Tamper with one row's amount → returns DISCREPANCY with correct delta
```

### Task 8.5: Deduplication

```prompt
Context: FR-11.4.

For each parsed transaction in a batch, check for existing transactions on the same account where:
- abs(amount - parsed.amount) < 0.01
- transacted_at within ±3 days of parsed.date
- description similarity > 0.7 (use rapidfuzz)

If a match: mark RawImportRecord as status=duplicate with match_type=fuzzy and link to the matched transaction.
If no match: status=pending, awaiting user review.

Service: /backend/app/services/dedup.py

Tests:
- Exact match detected
- Near match (fuzzy description) detected
- Different account → not a duplicate
- Outside date window → not a duplicate
```

### Task 8.6: Confirm/Reject Flow

```prompt
Context: FR-11.5.

Endpoints:
- GET /imports/{batch_id}/records — list with status grouping
- PATCH /imports/{batch_id}/records/{id} — edit the parsed_json before confirming
- POST /imports/{batch_id}/confirm — body: { record_ids: [...] }
  - For each record_id: create a Transaction from parsed_json, link via raw_import_records.transaction_id, set status=confirmed
  - Atomic: all or nothing
  - Updates batch totals
- POST /imports/{batch_id}/reject — body: { record_ids: [...] }
  - Set status=rejected

Tests:
- Confirm transitions records to confirmed and creates transactions
- Reject keeps records but flags rejected
- Confirm with bad payload rolls back all
- Cannot confirm a duplicate without explicit force flag
```

### Task 8.7: Frontend — Import Pages

```prompt
Context: User-facing FR-11.

Pages:
- /frontend/src/pages/Imports.tsx — list of past batches with status
- /frontend/src/pages/ImportUpload.tsx — file picker, password field, account selector
- /frontend/src/pages/ImportReview.tsx — table of parsed records:
  - Grouped tabs: New | Suspected Duplicates | Low Confidence
  - Per row: editable fields, status indicator
  - Bulk select with "Confirm Selected" / "Reject Selected" actions
  - Inline payee/category picker per row

Tests:
- Upload triggers POST and shows status
- Review groups records correctly
- Confirm bulk action calls the right endpoint
```

---

## Milestone 9: LLM Integration

### Task 9.1: LLMClient Interface

```prompt
Context: TDD section 4.2 LLM Integration.

Create /backend/app/llm/base.py with abstract class:
class LLMClient(ABC):
    async def extract_transactions_from_pdf_page(self, image_bytes: bytes) -> list[ParsedTransaction]
    async def suggest_category(self, payee_name: str, description: str) -> str | None
    async def match_gpay_to_bank(self, gpay: list, bank: list) -> list[Match]

Plus /backend/app/llm/factory.py:
def make_llm_client(settings) -> LLMClient
  - Returns OllamaClient, AnthropicClient, OpenAIClient, or NullClient based on LLM_BACKEND env var

Also: a NullClient that returns empty/no-op results — used when LLM_BACKEND=none.

Tests:
- factory returns correct implementation per env
- NullClient does not raise
```

### Task 9.2: Ollama Implementation

```prompt
Context: Local LLM via Ollama.

/backend/app/llm/ollama_client.py implementing LLMClient using the ollama Python package:
- extract_transactions_from_pdf_page: uses LLM_VISION_MODEL (e.g. moondream2 or minicpm-v) with a prompt that asks for JSON extraction
- suggest_category: uses LLM_MODEL (e.g. llama3.2:3b or phi3:mini), prompted with categories list and transaction context
- match_gpay_to_bank: text-only matching helper

Robust JSON parsing: handle markdown code fences, retry on parse failure once with a stricter prompt.

Tests (mocked):
- Vision extraction returns parsed transactions
- Category suggestion returns a string from a known set
- Handles malformed JSON gracefully
```

### Task 9.3: Anthropic Implementation

```prompt
Context: Cloud LLM with zero-retention.

/backend/app/llm/anthropic_client.py using anthropic SDK:
- Sets `anthropic-beta: zero-retention-...` header (verify the current valid value from Anthropic docs at implementation time) when ANTHROPIC_ZERO_RETENTION=true
- Otherwise same interface as Ollama
- Vision: uses Claude's vision input

Mock tests; an opt-in real-API integration test gated by env var ANTHROPIC_REAL_API_TEST=1.

Tests:
- Header is set when configured
- Methods produce expected output shapes
```

### Task 9.4: Vision Fallback Integration

```prompt
Context: FR-11.2 — when deterministic parsing fails, fall back to vision LLM.

Update the PDF import worker:
1. Try deterministic parser first.
2. If balance verification fails OR no parser matches, fall back to vision LLM.
3. Vision LLM extraction goes page-by-page; results are merged.
4. Vision-extracted records get confidence=low; deterministic records get confidence=high.

Add a verify-after-vision step so we can detect when vision also fails.

Tests:
- Deterministic-good path: vision is never called
- Deterministic-fails path: vision is called
- Vision-also-fails: batch marked needs-manual-review
```

### Task 9.5: LLM Activity Log

```prompt
Context: NFR-2.4 transparency.

Model: LLMActivityLog(id, user_id, operation, payload_summary JSONB, backend, model, duration_ms, succeeded, created_at)

payload_summary contains a redacted/summarized version of what was sent (not the full prompt) — e.g. for category suggestion: { "payee": "...", "description_length": 42 }. For vision: { "page_count": 1, "file_size": 12345 }.

All LLMClient implementations log to this table via a decorator or middleware.

API:
- GET /api/v1/settings/llm-activity?limit=50 — paginated log

Tests:
- Every LLM call produces a log entry
- Failed calls also log with succeeded=false
```

### Task 9.6: Frontend — LLM Activity Page

```prompt
Context: Transparency UI.

Add to settings: /frontend/src/pages/SettingsLLMActivity.tsx
- Table of recent LLM calls: timestamp, operation, backend, model, duration, success
- Expand to see payload_summary
- Filter by operation and backend

Tests:
- Renders log entries
- Expand reveals summary
```

---

## Milestone 10: GPay Takeout Enrichment

### Task 10.1: GPay Takeout Parser & Matcher

```prompt
Context: FR-12.

POST /api/v1/imports/gpay-takeout — accepts the Takeout JSON file.

Service: /backend/app/services/gpay_matcher.py
- parse_takeout(file) -> list[GPayRecord]
- match_records(gpay_records, user_id) -> list[MatchResult]
  - For each GPay record: find bank transactions within ±1 day and exact amount match (or amount within 0.01)
  - exact match (1 candidate): auto-link, enrich
  - ambiguous (2+ candidates): create a pending match record
  - none: orphan

Model: GPayMatch(id, user_id, gpay_data JSONB, candidate_transaction_ids [UUID], chosen_transaction_id NULL, status enum(exact/ambiguous/orphan/resolved), created_at)

Tests:
- Exact match path
- Ambiguous match path
- No match path
- Enrichment writes merchant_name to the bank transaction's description (preserve original via a column? or notes?)
```

### Task 10.2: Frontend — GPay Resolution UI

```prompt
Context: FR-12.4.

Pages:
- /frontend/src/pages/GPayImport.tsx — upload Takeout
- /frontend/src/pages/GPayResolve.tsx — list of ambiguous matches with side-by-side candidate selection
- /frontend/src/pages/GPayOrphans.tsx — orphan records list

Resolution UI: GPay record on top, candidates below with radio selection, "Confirm" button.

Tests:
- Resolution submits correct chosen_transaction_id
- UI updates after resolution
```

---

## Milestone 11: Reports & Custom Dashboards

### Task 11.1: Read-Only DB Role & Query Endpoint

```prompt
Context: FR-15.3. Safe SQL execution.

Postgres setup:
- Create role `app_readonly` with SELECT permission on a curated set of tables (user-data tables, exclude users.password_hash, sessions, etc.)
- Backend maintains a separate SQLAlchemy engine using this role

POST /api/v1/reports/query body: { sql, params? }
1. Wrap the SQL in: BEGIN; SET TRANSACTION READ ONLY; SET statement_timeout = '10s'; <sql>; ROLLBACK;
2. Inject user_id constraint: parse the SQL, ensure it includes `user_id = :user_id` filter on top-level tables. (Implementation choice: use a simple AST check via sqlglot.)
3. Return rows up to a row limit (e.g. 10,000 rows max).

Error responses include the actual SQL error for debugging.

Tests:
- SELECT works
- INSERT/UPDATE/DELETE fails (read-only role)
- Statement timeout enforced (test with pg_sleep(11))
- Missing user_id filter is rejected
- Row limit enforced
```

### Task 11.2: Schema Reference Endpoint

```prompt
Context: User-facing schema reference panel.

GET /api/v1/reports/schema returns:
{
  "tables": [
    {
      "name": "transactions",
      "description": "All financial transactions",
      "columns": [
        { "name": "id", "type": "uuid", "description": "..." },
        { "name": "amount", "type": "numeric", ... },
        { "name": "account_id", "type": "uuid", "foreign_key": "accounts.id" },
        ...
      ]
    },
    ...
  ]
}

Curate the table list: only user-data tables (no sessions, password_hash, etc.). Hand-write descriptions for clarity.

Tests:
- Returns expected tables only
- Foreign keys are populated correctly
```

### Task 11.3: Dashboards & Widgets

```prompt
Context: FR-15.1, 15.2.

Models:
- ReportDashboard(id, user_id, name, description, timestamps, deleted_at)
- ReportWidget(id, dashboard_id, title, query TEXT, viz_type enum, viz_config JSONB, position JSONB, timestamps)

CRUD APIs for both.

position JSONB schema: { x, y, w, h } for grid placement (e.g. 12-col grid).
viz_config JSONB schema: type-specific — for bar: { x_field, y_field, color }; for pie: { value_field, label_field }; etc.

Tests:
- CRUD
- Cascade on dashboard delete
- Cannot reference another user's dashboard
```

### Task 11.4: Frontend — Reports Section

```prompt
Context: FR-15 full UI.

Pages:
- /frontend/src/pages/Reports.tsx — list of dashboards, create button
- /frontend/src/pages/ReportDashboard.tsx — single dashboard with grid layout (use react-grid-layout)
- /frontend/src/components/reports/QueryEditor.tsx — Monaco editor (or CodeMirror) with SQL syntax highlighting
- /frontend/src/components/reports/SchemaReferencePanel.tsx — collapsible sidebar listing tables/columns, click to insert
- /frontend/src/components/reports/StarterQueryLibrary.tsx — pre-canned queries the user can copy
- /frontend/src/components/reports/WidgetRenderer.tsx — given { viz_type, viz_config, data }, renders the visualization
- /frontend/src/components/reports/WidgetEditor.tsx — modal to create/edit a widget (query editor + viz_type selector + viz_config form)

Starter library (hardcoded for v1):
- Spending by category this month
- Top 10 payees this year
- Pending splits with totals owed
- Budget vs actual
- Income vs expenses by month
- Account balance history

Tests:
- Grid layout drag/drop persists position
- Widget renders with sample data
- Query editor inserts table/column names from schema panel clicks
```

---

## Milestone 12: Data Portability

### Task 12.1: JSON Archive Export

```prompt
Context: FR-16.1, NFR-8.1.

POST /api/v1/export creates a tar.gz archive with:
- manifest.json: { schema_version, exported_at, user_id, table_list, record_counts }
- One JSON file per table containing all rows for the authed user

For tables with FKs to other user-scoped tables, UUIDs are preserved as-is (no remapping).

Run as a background ARQ job; return a job ID immediately. Status endpoint: GET /export/{job_id}.
Final download endpoint: GET /export/{job_id}/download.

Tests:
- Full round trip: export → unpack → verify all data present
- Archive contains only the authed user's data, not other users'
```

### Task 12.2: JSON Archive Import

```prompt
Context: FR-16.2.

POST /api/v1/import-archive accepts a tar.gz file. Worker:
1. Validates manifest.json (schema_version compatible)
2. Loads tables in dependency order (users last in destination, since destination already has a user)
3. UUID conflict handling: if a UUID exists in the destination, fail with clear error.
4. Atomic: all-or-nothing using a single DB transaction.

Restriction: only allowed on a fresh user with minimal data (no existing transactions). This prevents accidental data overwrite.

Tests:
- Import a freshly-exported archive into a fresh DB → identical state
- Conflict detection works
- Tamper with manifest schema_version → fails gracefully
```

### Task 12.3: pg_dump Scripts & CLI

```prompt
Context: Native backup option.

Create /infra/scripts/:
- backup.sh: runs pg_dump to a timestamped file in a configured backup directory
- restore.sh: takes a dump file and a target DB, restores
- (Optionally) cron-friendly variants

Also a CLI inside the backend:
- python -m app.cli export-archive --user-email x@y --output ./archive.tar.gz
- python -m app.cli import-archive --user-email x@y --input ./archive.tar.gz
- python -m app.cli create-user --email x@y --password $(cat secret) — for bootstrapping the first user without UI

Tests:
- backup.sh produces a valid dump (assert non-empty)
- restore.sh restores into a test DB
- CLI commands work end-to-end
```

### Task 12.4: Frontend — Export/Import UI

```prompt
Context: Self-service export and import.

Add to Settings:
- /frontend/src/pages/SettingsDataExport.tsx — button to trigger export, polls for completion, presents download link
- /frontend/src/pages/SettingsDataImport.tsx — file upload (restricted to "fresh user" — show warning if user has existing data)

Tests:
- Export flow: trigger → poll → download URL appears
- Import flow: file picker, warning displayed when data exists
```

---

## Milestone 13: PWA & Polish

### Task 13.1: PWA Setup

```prompt
Context: NFR-3.2.

Configure vite-plugin-pwa in /frontend/vite.config.ts:
- Manifest: name, short_name, theme_color, icons (192, 512), display=standalone, start_url=/
- Service worker: precache static assets, runtime-cache API GETs with a network-first strategy
- Generate icons in multiple sizes (use a build script or pre-built icons committed to /frontend/public/icons/)

Test installability:
- Open Chrome DevTools → Application → Manifest → no errors
- Lighthouse PWA score ≥ 90
- "Install app" prompt appears
```

### Task 13.2: Mobile Responsiveness Audit

```prompt
Context: NFR-3.1.

For every page in /frontend/src/pages/:
1. Open in browser at 360px viewport.
2. Verify no horizontal scroll.
3. Verify all interactive elements are tap-friendly (min 44x44 px).
4. Verify text is readable without zoom.
5. Verify the bottom tab bar appears and works.

Add /frontend/src/components/MobileNav.tsx (bottom tab bar) with the main sections: Dashboard, Transactions, Add (FAB), Budgets, More.

Add a snapshot test per page at 360px width using a Playwright fixture.
```

### Task 13.3: Soft Delete Recovery UI

```prompt
Context: NFR-4.2.

Each entity needs a "Recently Deleted" view:
- /frontend/src/pages/RecentlyDeleted.tsx — tabbed view across entity types showing items soft-deleted within the last 30 days
- Restore button per item → calls POST /{entity}/{id}/restore

Backend: add restore endpoints to all entities (most already done; audit and complete).

A daily cron job (separate ARQ scheduled task) permanently deletes items where deleted_at < now() - 30 days.

Tests:
- Items appear in Recently Deleted within 30 days
- Items past 30 days are purged
- Restore moves item back to active state
```

---

## Milestone 14: Production Deployment

### Task 14.1: Caddyfile & Production Compose

```prompt
Context: NFR-1.1, NFR-6.4.

Create /infra/Caddyfile with two profiles:
- localhost: serves frontend static files + reverse-proxies /api/ to backend, no TLS
- production: same routing + automatic Let's Encrypt for ${PUBLIC_DOMAIN}

Update /infra/docker-compose.yml:
- Use Caddy as the front-facing service (port 80/443)
- Frontend container produces static files only (no dev server in prod)
- Backend runs uvicorn with multiple workers
- Worker container runs ARQ
- All resource limits set sensibly
- Healthchecks on each service

Add /infra/docker-compose.local-llm.yml as a compose override that adds the Ollama service.

Verify:
- `docker compose up` works for cloud-LLM deployment
- `docker compose -f docker-compose.yml -f docker-compose.local-llm.yml up` works for local-LLM deployment
- Both produce a working app
```

### Task 14.2: Backup Automation

```prompt
Context: NFR-8.

Create /infra/scripts/auto-backup.sh:
- Runs nightly via cron (or a systemd timer)
- Calls pg_dump
- Compresses + uploads to a configured destination (local directory; optionally S3-compatible via rclone)
- Rotates old backups (keep last 7 daily, 4 weekly, 12 monthly)

Document the cron entry in /docs/operations.md.

Tests: 
- Run the script manually, verify backup file produced
- Mock S3 upload (or test with a local minio)
```

### Task 14.3: Documentation & README

```prompt
Context: Make this self-hostable by someone other than the author.

/README.md should cover:
- Project description (1-2 paragraphs)
- Architecture overview (link to docs/tdd.md)
- Quick start: clone, copy env.example, set env vars, docker compose up
- Two deployment modes (home / cloud) with example env files
- Backup and restore commands
- How to add a new bank parser
- Contributing guidelines (basic)

/docs/operations.md: detailed operational runbook (backups, monitoring, log paths, common issues).

/docs/tdd.md: the v2 TDD copied here.

/docs/api.md: auto-generated OpenAPI docs, served at /api/v1/docs by FastAPI; this file links there.

Tests: lint markdown with markdownlint.
```

### Task 14.4: End-to-End Test Pass

```prompt
Context: Final integration verification.

Add /frontend/e2e/ Playwright tests covering critical paths:
1. First-run setup → create initial user → land on empty dashboard
2. Create account → create payee → create transaction → see in list and dashboard
3. Upload PDF statement → review → confirm → transactions appear
4. Create budget → link transaction → see spend on dashboard
5. Create split (upfront) → settle one share → forgive another → verify net expense
6. Retroactively bundle existing transactions
7. Create custom dashboard with a widget
8. Export archive → import into fresh instance → identical data
9. Mobile: full transaction creation flow on 360px viewport

CI runs these against the docker-compose stack.

Tests must all pass before declaring v1 ready.
```

---

## Integration & Final Testing

```prompt
Once all milestones are complete:

1. Run the full test suite: `make test` (backend + frontend + e2e).
2. Run Lighthouse against the production build; verify PWA score ≥ 90, performance ≥ 80.
3. Deploy to a staging VPS using the production compose; smoke-test all flows.
4. Verify backups run nightly and can be restored.
5. Verify the JSON archive export → import works end-to-end across two instances.
6. Verify LLM activity log captures every LLM call with no surprises.
7. Audit security:
   - All endpoints behind auth except setup/login/invite-accept/health
   - argon2 used for passwords
   - JWT signing key rotated and stored in env only
   - Read-only role enforced for the query endpoint
   - SQL injection attempts on /reports/query blocked
8. Accessibility audit using axe-core; address all critical issues.
9. Document any known limitations in a /docs/known-issues.md.

Cut v1.0.0 release tag.
```
