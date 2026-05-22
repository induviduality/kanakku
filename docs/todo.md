# Development Checklist — Kanakku

> Companion to `prompt_plan.md` and `docs/tdd.md`.
> Check items off as you progress. TDD — write tests before implementing.

---

## Setup & Prerequisites

- [ ] Install Python 3.12+, Bun, Docker + Docker Compose on dev machine
- [ ] Raspberry Pi 5 (8GB) provisioned with Raspberry Pi OS 64-bit
- [ ] Pi 5 has Docker installed and running
- [ ] Pi 5 reachable on LAN (note its IP)
- [ ] Clone repo skeleton
- [ ] Copy `infra/env.example` → `.env` and fill values

---

## Milestone 0: Foundation

### Task 0.1: Monorepo Structure
- [x] Directory tree (backend, frontend, infra, docs, .github/workflows)
- [x] Root README with project stub
- [x] Comprehensive .gitignore
- [x] Non-Commercial LICENSE

### Task 0.2: Backend Bootstrap
- [x] pyproject.toml with deps + dev deps
- [x] app/main.py with /health
- [x] app/config.py with pydantic-settings
- [x] app/db/session.py + app/db/base.py
- [x] Alembic initialized
- [x] tests/conftest.py with fixtures
- [x] Dockerfile (ARM64-compatible)
- [x] Tests: /health, DB connect
- [ ] pytest, ruff, mypy all clean (run locally to verify)

### Task 0.3: Frontend Bootstrap
- [ ] Vite + React 19 + TS scaffolded via Bun
- [ ] Tailwind + PostCSS configured
- [ ] Radix UI primitives installed (dialog, dropdown, tabs, toast)
- [ ] TanStack Query + Router installed
- [ ] Recharts installed
- [ ] vite-plugin-pwa installed (disabled initially)
- [ ] Vitest + RTL configured
- [ ] Standard directory structure
- [ ] Dockerfile (ARM64-compatible)
- [ ] App renders "Kanakku" + Radix dialog demo
- [ ] bun test passes, bun run build clean

### Task 0.4: Docker Compose Dev Setup
- [ ] docker-compose.yml with postgres, redis, api, worker, frontend, ollama
- [ ] env.example with all vars from TDD 4.10
- [ ] Makefile with up/down/logs/shells
- [ ] init-ollama.sh to pull qwen2.5:1.5b
- [ ] All services start cleanly
- [ ] Ollama has qwen2.5:1.5b loaded
- [ ] (Optional) verified on actual Pi 5 hardware

### Task 0.5: GitHub Actions CI
- [ ] ci.yml with backend + frontend jobs
- [ ] ci-arm.yml for ARM64 docker builds (QEMU)
- [ ] Dummy PR runs all jobs green

---

## Milestone 1: Authentication

### Task 1.1: Users + Sessions Schema
- [ ] User, Session, InviteToken models
- [ ] Migration generated and reviewed (UUID, TIMESTAMPTZ)
- [ ] Tests: model creation, unique constraint, migration up/down

### Task 1.2: Password Hashing & JWT
- [ ] security/passwords.py (argon2id)
- [ ] security/tokens.py (JWT HS256, 24h/30d)
- [ ] Tests: hashing, token roundtrip, expiry, tampering

### Task 1.3: First-Run Setup
- [ ] POST /auth/setup endpoint
- [ ] assert_no_users_exist dependency
- [ ] Tests: first succeeds, subsequent 404, validation

### Task 1.4: Login, Logout, Me, Refresh
- [ ] All four endpoints
- [ ] get_current_user dependency
- [ ] Tests for each path

### Task 1.5: Invite Token System
- [ ] POST /auth/invites
- [ ] POST /auth/accept-invite
- [ ] GET /auth/invites/{token}/info
- [ ] Tokens stored hashed
- [ ] Tests: creation, redemption, expiry, single-use

### Task 1.6: Frontend Auth Pages
- [ ] pages/Setup.tsx
- [ ] pages/Login.tsx
- [ ] pages/AcceptInvite.tsx
- [ ] api/auth.ts hooks
- [ ] lib/auth-storage.ts
- [ ] components/AuthGuard.tsx
- [ ] Routes configured
- [ ] Tests with MSW

---

## Milestone 2: Settings & Core Entities

### Task 2.1: User Settings
- [ ] UserSettings model
- [ ] Auto-create on user signup
- [ ] GET/PATCH /settings
- [ ] Tests: defaults, scoping

### Task 2.2: Accounts CRUD
- [ ] Account model
- [ ] Full CRUD + soft delete + restore
- [ ] Currency defaults from user settings
- [ ] Tests: CRUD, access control, soft delete, 30-day purge rule

### Task 2.3: Payment Methods CRUD
- [ ] PaymentMethod model
- [ ] Nested endpoints
- [ ] upi_app validation
- [ ] Tests

### Task 2.4: Payees CRUD
- [ ] Payee model + default_categories join
- [ ] CRUD with search + type filter
- [ ] Tests

### Task 2.5: Categories CRUD
- [ ] Category model with optional applicability
- [ ] CRUD + seed-defaults endpoint
- [ ] Tests

### Task 2.6: Tags CRUD
- [ ] Tag model with partial unique index
- [ ] CRUD
- [ ] Tests: duplicate 409, soft-delete frees name

### Task 2.7: Frontend — Settings Page
- [ ] pages/Settings.tsx
- [ ] components/forms/SettingsForm.tsx
- [ ] api/settings.ts
- [ ] Tests

### Task 2.8: Frontend — Entity Pages
- [ ] components/DataTable.tsx (mobile fallback)
- [ ] components/EntityModal.tsx
- [ ] components/ConfirmDialog.tsx
- [ ] Accounts page with inline payment methods
- [ ] Payees page
- [ ] Categories page
- [ ] Tags page
- [ ] Tests per page

---

## Milestone 3: Transactions

### Task 3.1: Transactions Schema
- [ ] Transaction model with all fields
- [ ] Join tables (categories, tags, budgets)
- [ ] Indexes
- [ ] Constraints (transfer requires to_account_id)
- [ ] Tests

### Task 3.2: Transactions CRUD
- [ ] All endpoints (POST/GET/PATCH/DELETE/restore)
- [ ] Filters + cursor pagination
- [ ] Currency override
- [ ] Balance recompute transactional
- [ ] Tests: all paths, balance correctness, all filters

### Task 3.3: Frontend — Transaction Form
- [ ] pages/TransactionForm.tsx
- [ ] components/Autocomplete.tsx with inline-create
- [ ] Type toggle behavior
- [ ] Payee selection populates categories
- [ ] Tests

### Task 3.4: Frontend — Transaction List
- [ ] pages/Transactions.tsx
- [ ] Filters synced to URL
- [ ] Desktop table / mobile cards
- [ ] Infinite scroll
- [ ] Bulk select UI (action button comes in M4)
- [ ] Tests

---

## Milestone 4: Splits

### Task 4.1: Splits Schema + Invariant
- [ ] Split + SplitShare models
- [ ] Application validator
- [ ] DB trigger enforcing invariant
- [ ] Tests: invariant on insert/update/delete

### Task 4.2: Upfront Split Creation
- [ ] POST /splits with bundled payload
- [ ] Atomic creation
- [ ] Tests: happy path, sum mismatch, type mismatch, rollback

### Task 4.3: Retroactive Bundling
- [ ] POST /splits/bundle
- [ ] Computes user share as remainder
- [ ] Conflict detection
- [ ] Tests: all paths

### Task 4.4: Settle / Forgive Endpoints
- [ ] settle, forgive, unsettle
- [ ] Tests: all transitions

### Task 4.5: Net Expense Calculation
- [ ] services/expense_calculator.py
- [ ] SQL view transaction_with_net_amount
- [ ] Tests: all split combinations

### Task 4.6: Frontend — Split UIs
- [ ] components/SplitSharesEditor.tsx (upfront)
- [ ] Split toggle in TransactionForm
- [ ] components/BundleAsSplitModal.tsx (retroactive)
- [ ] "Bundle as Split" bulk action in transaction list
- [ ] pages/SplitDetail.tsx
- [ ] Settle modal, Forgive confirm
- [ ] Tests per component

---

## Milestone 5: Budgets

### Task 5.1: Budgets Schema
- [ ] Budget model with RRULE
- [ ] budget_categories join
- [ ] Tests

### Task 5.2: Recurrence Expansion
- [ ] services/budget_expander.py
- [ ] All expansion scenarios
- [ ] Modified instance override
- [ ] Tests

### Task 5.3: Budgets CRUD with Scope Semantics
- [ ] All endpoints with scope params
- [ ] Edit/delete scope handling
- [ ] Tests: every scope combination

### Task 5.4: Transaction-Budget Linking
- [ ] Transactions accept budget_ids
- [ ] GET /budgets/{id}/transactions
- [ ] Spent calc (explicit + category match)
- [ ] Tests

### Task 5.5: Frontend — Budgets
- [ ] pages/Budgets.tsx with progress bars
- [ ] pages/BudgetDetail.tsx
- [ ] pages/BudgetForm.tsx
- [ ] Edit dialog (recurring): "also current period?" checkbox
- [ ] Delete dialog (recurring): three radio options
- [ ] Tests

---

## Milestone 6: Subscriptions & Piggy Banks

### Task 6.1: Subscriptions
- [ ] Subscription model
- [ ] services/subscription_dates.py
- [ ] CRUD + link-transaction + history
- [ ] Transaction PATCH accepts subscription_id
- [ ] Tests

### Task 6.2: Piggy Banks
- [ ] PiggyBank + PiggyBankContribution models
- [ ] CRUD + contributions endpoints
- [ ] current_amount transactional update
- [ ] Auto-complete at threshold
- [ ] Tests

### Task 6.3: Frontend — Subs & Piggy Banks
- [ ] Subscriptions list/form/detail
- [ ] Status badges color-coded
- [ ] Piggy banks list/form/detail
- [ ] Progress rings
- [ ] Tests

---

## Milestone 7: Home Dashboard

### Task 7.1: Dashboard Endpoint
- [ ] GET /dashboard/home with parallel sub-queries
- [ ] Tests: structure, empty state, cross-check

### Task 7.2: Frontend — Dashboard
- [ ] pages/Dashboard.tsx responsive grid
- [ ] components/dashboard/BudgetProgressCard.tsx
- [ ] components/dashboard/CategoryBreakdownChart.tsx
- [ ] components/dashboard/SubscriptionStatusBadge.tsx
- [ ] components/dashboard/PiggyBankProgressRing.tsx
- [ ] Skeleton loaders
- [ ] Tests

---

## Milestone 8: PDF Statement Import

### Task 8.1: Import Schema
- [ ] ImportBatch + RawImportRecord models
- [ ] Cascade behavior on batch deletion
- [ ] Tests

### Task 8.2: PDF Upload & Unlock
- [ ] POST /imports/pdf multipart endpoint
- [ ] Per-user temp storage
- [ ] ARQ job process_pdf_import
- [ ] pikepdf unlock
- [ ] Tests: correct/wrong password, corrupted PDF

### Task 8.3: HDFC PDF Parser
- [ ] parsers/base.py interface
- [ ] parsers/banks/hdfc.py
- [ ] parsers/registry.py with detect_parser
- [ ] Fixture PDFs (anonymized)
- [ ] Tests: parse correctness, detection logic

### Task 8.4: Balance Verification
- [ ] services/balance_verifier.py
- [ ] verification_status stored on batch
- [ ] Tests: VERIFIED, DISCREPANCY, INDETERMINATE

### Task 8.5: Deduplication
- [ ] services/dedup.py with rapidfuzz
- [ ] Tests: exact, fuzzy, cross-account negative, date window

### Task 8.6: Confirm / Reject Flow
- [ ] All endpoints
- [ ] Atomic confirm
- [ ] force flag for duplicate confirm
- [ ] Tests

### Task 8.7: Frontend — Import Pages
- [ ] pages/Imports.tsx list
- [ ] pages/ImportUpload.tsx
- [ ] pages/ImportReview.tsx with tabbed groups
- [ ] Inline editing per record
- [ ] Bulk confirm/reject
- [ ] Tests

---

## Milestone 9: LLM Integration

### Task 9.1: LLMClient Interface
- [ ] llm/base.py ABC (text-only methods)
- [ ] llm/factory.py
- [ ] NullClient
- [ ] Tests

### Task 9.2: Ollama Implementation
- [ ] llm/ollama_client.py
- [ ] suggest_category with retry
- [ ] match_gpay_to_bank
- [ ] Robust output parsing
- [ ] Tests (mocked)

### Task 9.3: LLM Activity Log
- [ ] LLMActivityLog model
- [ ] Logging via decorator/middleware
- [ ] GET /settings/llm-activity endpoint
- [ ] Tests: every call logged

### Task 9.4: Frontend — LLM Activity Page
- [ ] pages/SettingsLLMActivity.tsx
- [ ] Filter by operation/backend
- [ ] Expand for payload summary
- [ ] Tests

---

## Milestone 10: GPay Takeout

### Task 10.1: GPay Parser & Matcher
- [ ] POST /imports/gpay-takeout
- [ ] services/gpay_matcher.py
- [ ] GPayMatch model
- [ ] All match paths
- [ ] LLM invoked only when needed for ambiguous resolution
- [ ] Tests

### Task 10.2: Frontend — GPay UI
- [ ] pages/GPayImport.tsx
- [ ] pages/GPayResolve.tsx
- [ ] pages/GPayOrphans.tsx
- [ ] Tests

---

## Milestone 11: Reports

### Task 11.1: Read-Only Role & Query Endpoint
- [ ] Postgres app_readonly role (migration)
- [ ] Separate engine
- [ ] POST /reports/query with safety wrappers
- [ ] User-id filter enforcement
- [ ] Row limit + timeout
- [ ] Tests

### Task 11.2: Schema Reference Endpoint
- [ ] GET /reports/schema with curated tables
- [ ] FK metadata
- [ ] Tests

### Task 11.3: Dashboards & Widgets
- [ ] ReportDashboard + ReportWidget models
- [ ] CRUD APIs
- [ ] Tests

### Task 11.4: Frontend — Reports
- [ ] pages/Reports.tsx list
- [ ] pages/ReportDashboard.tsx with react-grid-layout
- [ ] components/reports/QueryEditor.tsx (CodeMirror)
- [ ] components/reports/SchemaReferencePanel.tsx
- [ ] components/reports/StarterQueryLibrary.tsx (6 starter queries)
- [ ] components/reports/WidgetRenderer.tsx
- [ ] components/reports/WidgetEditor.tsx
- [ ] Tests

---

## Milestone 12: Data Portability

### Task 12.1: JSON Archive Export
- [ ] POST /export triggers ARQ job
- [ ] tar.gz with manifest + per-table JSON
- [ ] GET /export/{job_id} status
- [ ] GET /export/{job_id}/download
- [ ] Tests

### Task 12.2: JSON Archive Import
- [ ] POST /import-archive
- [ ] Schema version validation
- [ ] UUID conflict detection
- [ ] Atomic load
- [ ] Restricted to fresh user
- [ ] Tests

### Task 12.3: CLI & Backup Scripts
- [ ] infra/scripts/backup.sh
- [ ] infra/scripts/restore.sh
- [ ] CLI: create-user, export-archive, import-archive
- [ ] Tests

### Task 12.4: Frontend — Export/Import UI
- [ ] pages/SettingsDataExport.tsx with polling
- [ ] pages/SettingsDataImport.tsx with safety warning
- [ ] Tests

---

## Milestone 13: PWA & Polish

### Task 13.1: PWA Setup
- [ ] vite-plugin-pwa configured
- [ ] Manifest with icons (192, 512)
- [ ] Service worker
- [ ] Installable verified
- [ ] Lighthouse PWA ≥ 90

### Task 13.2: Mobile Audit
- [ ] Every page verified at 360px
- [ ] No horizontal scroll
- [ ] Tap targets ≥ 44x44
- [ ] components/MobileNav.tsx bottom tab bar
- [ ] Playwright snapshots at 360px

### Task 13.3: Soft Delete Recovery UI
- [ ] pages/RecentlyDeleted.tsx
- [ ] Restore endpoints on all entities (audit)
- [ ] Daily purge job
- [ ] Tests

---

## Milestone 14: Production Deployment

### Task 14.1: Caddyfile & Production Compose
- [ ] Caddyfile (localhost + production)
- [ ] Production docker-compose.yml
- [ ] Caddy front-facing
- [ ] Healthchecks
- [ ] Resource limits for Pi 5
- [ ] Verified on actual Pi 5

### Task 14.2: Backup Automation
- [ ] auto-backup.sh with rotation
- [ ] Cron entry documented
- [ ] Tests

### Task 14.3: Documentation
- [ ] README with quick start
- [ ] docs/operations.md runbook
- [ ] docs/tdd.md (already there)
- [ ] docs/api.md
- [ ] Tailscale or VPN approach documented
- [ ] Markdown lint clean

### Task 14.4: End-to-End Tests
- [ ] Playwright e2e suite (9 critical paths)
- [ ] All passing in CI

---

## Final Integration & Release

### Pre-Release
- [ ] Full test suite passes
- [ ] Lighthouse PWA ≥ 90, Performance ≥ 80
- [ ] Deployed to real Pi 5
- [ ] All flows smoke-tested on Pi 5
- [ ] Backup cron verified, restore tested
- [ ] JSON archive roundtrip across two instances
- [ ] LLM activity log captures every call

### Security Audit
- [ ] All endpoints behind auth (except setup/login/invite/health)
- [ ] argon2id verified
- [ ] JWT secret env-only
- [ ] Read-only role enforced
- [ ] SQL injection on query endpoint blocked
- [ ] CORS limited to PUBLIC_BASE_URL
- [ ] Rate limiting verified

### Accessibility Audit
- [ ] axe-core run on every page
- [ ] Critical issues addressed
- [ ] Keyboard navigation works end-to-end

### Documentation Final
- [ ] README instructions verified on fresh machine
- [ ] docs/known-issues.md filled
- [ ] Sample env files committed

### Release
- [ ] Cut v1.0.0 tag
- [ ] Publish ARM64 + AMD64 images to GHCR
- [ ] Release notes

---

## Post-v1 Backlog (Reference Only)

See TDD section 5:

- [ ] Notifications
- [ ] Transaction attachments
- [ ] Native mobile app
- [ ] Investments module
- [ ] Multi-user households
- [ ] Row-level security for query endpoint
- [ ] Cloud LLM backends (Anthropic, OpenAI clients)
- [ ] Vision-model PDF fallback (if needed)
- [ ] Additional bank parsers (ICICI, SBI, Axis, Kotak, etc.)
- [ ] History-based local classifier (auto-categorization)