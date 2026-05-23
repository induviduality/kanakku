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
- [x] pytest, ruff, mypy all clean

### Task 0.3: Frontend Bootstrap
- [x] Vite + React 19 + TS scaffolded via Bun
- [x] Tailwind v4 configured (CSS-first via @tailwindcss/vite)
- [x] Radix UI primitives installed (dialog, dropdown, tabs, toast)
- [x] TanStack Query + Router installed
- [x] Recharts installed
- [x] vite-plugin-pwa installed (disabled initially)
- [x] Vitest + RTL configured
- [x] Standard directory structure
- [x] Dockerfile (ARM64-compatible)
- [x] App renders "Kanakku" + Radix dialog demo
- [x] bun run test passes, bun run build clean

### Task 0.4: Docker Compose Dev Setup
- [x] docker-compose.yml with postgres, redis, api, worker, frontend, ollama
- [x] env.example with all vars from TDD 4.10
- [x] Makefile with up/down/logs/shells
- [x] init-ollama.sh to pull qwen2.5:1.5b
- [ ] All services start cleanly (verify when Docker available)
- [ ] Ollama has qwen2.5:1.5b loaded (verify when Docker available)
- [ ] (Optional) verified on actual Pi 5 hardware

### Task 0.5: GitHub Actions CI
- [x] ci.yml with backend + frontend jobs
- [x] ci-arm.yml for ARM64 docker builds (QEMU)
- [ ] TODO (you): open a PR against main and confirm both ci.yml jobs go green
- [ ] TODO (you): confirm ci-arm.yml ARM64 builds pass on push to main

---

## Milestone 1: Authentication

### Task 1.1: Users + Sessions Schema
- [x] User, Session, InviteToken models
- [x] Migration generated and reviewed (UUID, TIMESTAMPTZ)
- [x] Tests: model creation, unique constraint, migration up/down

### Task 1.2: Password Hashing & JWT
- [x] security/passwords.py (argon2id)
- [x] security/tokens.py (JWT HS256, 24h/30d)
- [x] Tests: hashing, token roundtrip, expiry, tampering

### Task 1.3: First-Run Setup
- [x] POST /auth/setup endpoint
- [x] assert_no_users_exist dependency
- [x] Tests: first succeeds, subsequent 404, validation

### Task 1.4: Login, Logout, Me, Refresh
- [x] All four endpoints
- [x] get_current_user dependency
- [x] Tests for each path

### Task 1.5: Invite Token System
- [x] POST /auth/invites
- [x] POST /auth/accept-invite
- [x] GET /auth/invites/{token}/info
- [x] Tokens stored hashed
- [x] Tests: creation, redemption, expiry, single-use

### Task 1.6: Frontend Auth Pages
- [x] pages/Setup.tsx
- [x] pages/Login.tsx
- [x] pages/AcceptInvite.tsx
- [x] api/auth.ts hooks
- [x] lib/auth-storage.ts
- [x] components/AuthGuard.tsx
- [x] Routes configured
- [x] Tests with MSW

---

## Milestone 2: Settings & Core Entities

### Task 2.1: User Settings
- [x] UserSettings model
- [x] Auto-create on user signup
- [x] GET/PATCH /settings
- [x] Tests: defaults, scoping

### Task 2.2: Accounts CRUD
- [x] Account model
- [x] Full CRUD + soft delete + restore
- [x] Currency defaults from user settings
- [x] Tests: CRUD, access control, soft delete, 30-day purge rule

### Task 2.3: Payment Methods CRUD
- [x] PaymentMethod model
- [x] Nested endpoints
- [x] upi_app validation
- [x] Tests

### Task 2.4: Payees CRUD
- [x] Payee model (default_categories join deferred to Task 2.5 when categories exist)
- [x] CRUD with search + type filter
- [x] Tests

### Task 2.5: Categories CRUD
- [x] Category model with optional applicability
- [x] CRUD + seed-defaults endpoint
- [x] Tests

### Task 2.6: Tags CRUD
- [x] Tag model with partial unique index
- [x] CRUD
- [x] Tests: duplicate 409, soft-delete frees name

### Task 2.7: Frontend — Settings Page
- [x] pages/Settings.tsx
- [x] components/forms/SettingsForm.tsx
- [x] api/settings.ts
- [x] Tests

### Task 2.8: Frontend — Entity Pages
- [x] components/DataTable.tsx (mobile fallback)
- [x] components/EntityModal.tsx
- [x] components/ConfirmDialog.tsx
- [x] Accounts page with inline payment methods
- [x] Payees page
- [x] Categories page
- [x] Tags page
- [x] Tests per page

---

## Milestone 3: Transactions

### Task 3.1: Transactions Schema
- [x] Transaction model with all fields
- [x] Join tables (categories, tags, budgets)
- [x] Indexes
- [x] Constraints (transfer requires to_account_id)
- [x] Tests

### Task 3.2: Transactions CRUD
- [x] All endpoints (POST/GET/PATCH/DELETE/restore)
- [x] Filters + cursor pagination
- [x] Currency override
- [x] Balance recompute transactional
- [x] Tests: all paths, balance correctness, all filters

### Task 3.3: Frontend — Transaction Form
- [x] pages/TransactionForm.tsx
- [x] components/Autocomplete.tsx with inline-create
- [x] Type toggle behavior
- [x] Payee selection populates categories
- [x] Tests

### Task 3.4: Frontend — Transaction List
- [x] pages/Transactions.tsx
- [x] Filters synced to URL
- [x] Desktop table / mobile cards
- [x] Infinite scroll
- [x] Bulk select UI (action button comes in M4)
- [x] Tests

---

## Milestone 4: Splits

### Task 4.1: Splits Schema + Invariant
- [x] Split + SplitShare models
- [x] Application validator
- [x] DB trigger enforcing invariant
- [x] Tests: invariant on insert/update/delete

### Task 4.2: Upfront Split Creation
- [x] POST /splits with bundled payload
- [x] Atomic creation
- [x] Tests: happy path, sum mismatch, type mismatch, rollback

### Task 4.3: Retroactive Bundling
- [x] POST /splits/bundle
- [x] Computes user share as remainder
- [x] Conflict detection
- [x] Tests: all paths

### Task 4.4: Settle / Forgive Endpoints
- [x] settle, forgive, unsettle
- [x] Tests: all transitions

### Task 4.5: Net Expense Calculation
- [x] services/expense_calculator.py
- [x] SQL view transaction_with_net_amount
- [x] Tests: all split combinations

### Task 4.6: Frontend — Split UIs
- [x] components/SplitSharesEditor.tsx (upfront)
- [x] Split toggle in TransactionForm
- [x] components/BundleAsSplitModal.tsx (retroactive)
- [x] "Bundle as Split" bulk action in transaction list
- [x] pages/SplitDetail.tsx
- [x] Settle modal, Forgive confirm
- [x] Tests per component

---

## Milestone 5: Budgets

### Task 5.1: Budgets Schema
- [x] Budget model with RRULE
- [x] budget_categories join
- [x] Tests

### Task 5.2: Recurrence Expansion
- [x] services/budget_expander.py
- [x] All expansion scenarios
- [x] Modified instance override
- [x] Tests

### Task 5.3: Budgets CRUD with Scope Semantics
- [x] All endpoints with scope params
- [x] Edit/delete scope handling
- [x] Tests: every scope combination

### Task 5.4: Transaction-Budget Linking
- [x] Transactions accept budget_ids
- [x] GET /budgets/{id}/transactions
- [x] Spent calc (explicit + category match)
- [x] Tests

### Task 5.5: Frontend — Budgets
- [x] pages/Budgets.tsx with progress bars
- [x] pages/BudgetDetail.tsx
- [x] pages/BudgetForm.tsx
- [x] Edit dialog (recurring): "also current period?" checkbox
- [x] Delete dialog (recurring): three radio options
- [x] Tests

---

## Milestone 6: Subscriptions & Piggy Banks

### Task 6.1: Subscriptions
- [x] Subscription model
- [x] services/subscription_dates.py
- [x] CRUD + link-transaction + history
- [x] Transaction PATCH accepts subscription_id
- [x] Tests

### Task 6.2: Piggy Banks
- [x] PiggyBank + PiggyBankContribution models
- [x] CRUD + contributions endpoints
- [x] current_amount transactional update
- [x] Auto-complete at threshold
- [x] Tests

### Task 6.3: Frontend — Subs & Piggy Banks
- [x] Subscriptions list/form/detail
- [x] Status badges color-coded
- [x] Piggy banks list/form/detail
- [x] Progress rings
- [x] Tests

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

## Diagrams Backlog

- [ ] UML / Mermaid ER diagram — all DB models and their relationships
- [ ] Backend architecture diagram — routers, services, models, Alembic, ARQ worker dependency map
- [ ] Frontend component tree — page hierarchy, shared components, API hooks
- [ ] System interaction diagram — FE ↔ BE ↔ DB ↔ Redis ↔ Ollama ↔ Caddy (infra overview showing all services and how data flows between them)

## Setup & Docs Backlog

- [ ] Verify docs/SETUP.md prereq steps on actual Pi 5 hardware
- [ ] Verify docs/SETUP.md prereq steps on a real cloud VPS (Ubuntu 22.04)
- [ ] Add `docs/SETUP.md` smoke-test checklist: after prerequisites, confirm docker/git/openssl versions
- [ ] `docs/running.md` — add note on minimum storage requirements (Pi SD card size, VPS disk)

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