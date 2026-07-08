# Ad-hoc Feature Sprint (2026-07-08) — Credit Card Remodel

## Completed Tasks
- Removed `credit_card` from `PaymentMethodType` (payment methods now debit_card/netbanking/upi only); credit cards are modeled solely via `AccountType.credit_card`. Migration 0029 drops the enum value (deletes any such payment_methods rows, nulls referencing transactions.payment_method_id first). Frontend hides the "Add payment method" credit_card option and hides the whole payment-methods panel for credit_card accounts. Dashboard `_cashflow_by_account` now excludes credit_card accounts from the cash flow chart (still shown in account_balances/net worth). — DONE

## Pending
- (none)

# Milestone 9: LLM Integration — In Progress

## Completed Tasks
- 9.1 LLMClient Interface (llm/base.py, llm/null_client.py, llm/factory.py, 8 tests) — DONE
- 9.2 Ollama Implementation (llm/ollama_client.py, 9 mocked tests) — DONE
- 9.3 LLM Activity Log (model, migration, LoggingLLMClient decorator, GET /settings/llm-activity, 7 tests) — DONE
- 9.4 Frontend — LLM Activity Page (SettingsLLMActivity.tsx, route, MSW fixture, 8 tests) — DONE

## Milestone 9: LLM Integration — COMPLETE

# Milestone 10: GPay Takeout Enrichment — In Progress

## Completed Tasks
- 10.1 GPay Parser & Matcher (gpay_matcher.py, GPayMatch model, migration, 4 endpoints, 11 tests) — DONE
- 10.2 Frontend — GPay UI (GPayImport.tsx, GPayResolve.tsx, GPayOrphans.tsx, 17 tests) — DONE

## Milestone 10: GPay Takeout Enrichment — COMPLETE

# Milestone 11: Reports & Custom Dashboards — In Progress

## Completed Tasks
- 11.1 Read-Only Role & Query Endpoint (sqlglot validation, readonly engine, migration, 8 tests) — DONE
- 11.2 Schema Reference Endpoint (GET /reports/schema, 19 curated tables, 4 tests) — DONE
- 11.3 Dashboards & Widgets CRUD (ReportDashboard/ReportWidget models, migration, CRUD endpoints, tests) — DONE

- 11.4 Frontend — Reports (pages/Reports.tsx, pages/ReportDashboard.tsx, components/reports/*, react-grid-layout, @uiw/react-codemirror, 37 tests) — DONE

## Milestone 11: Reports & Custom Dashboards — COMPLETE

# Milestone 12: Data Portability — In Progress

## Completed Tasks
- 12.1 JSON Archive Export (ExportJob model, migration, export_archive ARQ job, 3 endpoints, 8 tests) — DONE
- 12.2 JSON Archive Import (POST /import-archive, fresh-user guard, UUID conflict detection, 5 tests) — DONE

- 12.3 CLI & Backup Scripts (backup.sh, restore.sh, python -m app.cli, 6 tests) — DONE

- 12.4 Frontend — Export/Import UI (SettingsDataExport.tsx, SettingsDataImport.tsx, 12 tests) — DONE

## Milestone 12: Data Portability — COMPLETE

# Milestone 13: PWA & Polish — In Progress

## Completed Tasks
- 13.1 PWA Setup (vite-plugin-pwa configured, manifest.webmanifest, sw.js + workbox, icons 192/512) — DONE

- 13.2 Mobile Audit (AppLayout wrapper, MobileNav bottom tab bar, Playwright config + e2e/mobile.spec.ts, 5 tests) — DONE

- 13.3 Soft Delete Recovery UI (RecentlyDeleted page, budget restore endpoint, daily purge ARQ cron, 9 backend tests, 7 frontend tests) — DONE

## Milestone 13: PWA & Polish — COMPLETE

# Ad-hoc Feature Sprint (2026-06-21) — Edit Split & TransactionPicker

## Completed Tasks
- TransactionPicker feature: reusable income/expense picker with 3-tier search (3-month pool → year-scoped backend search → all-time). Replaces 50-row capped native selects in SplitDrawer, BundleAsSplitModal, CreateSplitDrawer. Adds `q` (ilike) param to backend GET /transactions. 8 commits (b3f506b..6239662). — DONE
- Edit Split functionality: Added `PUT /splits/{split_id}` endpoint in backend for transactional/atomic updates. Extracted split form to `SplitForm.tsx` to share between Create and Edit modes. Integrated Edit flow in `SplitDrawer.tsx` via header action. Verified with Vitest tests and frontend build typechecks. — DONE

## Pending
- (none)

# Ad-hoc Feature Sprint (2026-06-15)

## Completed Tasks
- Transaction form enrichment: SpendingClassification dropdown, Piggy Bank selector, Category→single-select with dropdown, Tags inline-create — DONE (2026-06-15)
- Categories management page restyled (kk-* design system) + added to SideNav — DONE (2026-06-15)
- Tags management page restyled (kk-* design system) + added to SideNav — DONE (2026-06-15)
- Import review: opening_balance in type dropdown + chip display — DONE (2026-06-15)
- PDF parser: emit synthetic opening_balance ParsedRecord from StatementHeader — DONE (2026-06-15)
- Import router: map "opening_balance" type correctly in _record_to_transaction — DONE (2026-06-15)
- Dedup: changed matching criteria to exact date + exact amount (removed fuzzy description + date window) — DONE (2026-06-15)

## Pending
- Split bug: blank payee → label "Unknown Payee"; allow editing OG transaction from split drawer; link/delink transactions inside split details

# Milestone 14: Production Deployment — In Progress

## Completed Tasks
- 14.1 Caddyfile & Production Compose (docker-compose.yml production-ready, override.yml for dev, resource limits, healthchecks, PUBLIC_DOMAIN) — DONE
- 14.2 Backup Automation (auto-backup.sh with rotation, operations.md runbook, 7 tests) — DONE
- 14.3 Documentation (README full rewrite, docs/api.md, docs/operations.md) — DONE
- 14.4 End-to-End Tests (9 critical-path Playwright tests, playwright.config.ts update, e2e scripts) — DONE

## Milestone 14: Production Deployment — COMPLETE

# UI Polish Sprint — COMPLETE

All tasks finished:
- Splits shimmer fix + page redesign (Unsettled + All sections, period filter, view-all pages)
- EmptyState shared component wired everywhere
- Page centering (mx-auto) on all content pages
- Icon-only edit/delete buttons (lucide-react Pencil/Trash2/Plus/ChevronDown/ChevronRight)
- Drawer system: 7 drawer components + wired into all 6 list pages

# Ad-hoc Fixes Sprint

## Completed Tasks
- Bulk PDF importer pages (Imports, ImportUpload, ImportReview) + sidebar nav item
- Split inline panel in Transactions page (proportional bars per share + stacked bar footer)
- Opening balance transaction type (backend enum, migration, liability-account guard, frontend form/drawer/display)
- Budget spending on list page (`current_spent` in BudgetResponse; later rewritten to two date-windowed batched queries to match drawer logic)
- Global dropdown/form dark-theme baseline (base.css overrides browser defaults)
- Dashboard opening_balance display: type includes `opening_balance`, shows `+` prefix with positive color
- Recurrence rule display: select dropdown in create/edit forms (Daily/Weekly/Monthly/Quarterly/Yearly), human-readable label in list and drawer
- payment_method `label` → `name` rename (migration 0021, schema + model + router + seed)
- Generic table parser replacing HDFC-specific parser (dual-column / Dr-Cr / headerless layouts)
- CLI diagnostic scripts: `backend/scripts/parse_statement.py` + `diagnose_statement.py`
- Account active toggle in drawer + `rrule.ts` shared lib + Transactions table design-token styling
- PDF import auth fix: `useUploadPdf` now uses `getAccessToken()` (not localStorage); added `r.ok` check to prevent navigation to `/imports/undefined` on error
- Dev mode auth bypass: `get_current_user` returns dev seed user when `DEV_MODE=true` and no token is present
- Budgets page: removed local period filter chips; now consumes `usePeriod()` from global period context (navbar calendar controls all time-based filtering)
- BudgetDrawer redesign: circular SVG progress ring, hero spend panel, Period/Created 2-col grid; MSW handler now filters transactions by date; backend UTC datetime fix for TIMESTAMPTZ comparisons
- Transaction details drawer: full details — payment method name, budgets, split shares, external_ref (UTR/ref), currency, import record, time-of-day; new `external_ref` field on model + migration 0023
- Splits UI revamp: removed SplitInlinePanel; uniform rows with Split/Split Share badges; Linked Split section in TransactionDrawer shows expense title; MSW fixtures updated with settlement transactions + split_id wiring
- Password eye toggle on all auth/import fields + sticky transaction CTAs (Bundle as Split)
- Duplicate resolution modal on PDF import review
- PiggyBank date_started field + Savings Goals in SideNav
- Remove GPay features + decouple Ollama from docker-compose
- Split multi-expense + payee uniqueness: `split_expenses` join table, DB trigger update, all-expense multi-select bundle, full frontend migration to `expense_transaction_ids[]` — DONE (2026-06-02)
- Bug-review frontend cosmetic fixes: CI disabled (workflow_dispatch), Vite proxy port 8000→8765 (M4), TransactionForm + Autocomplete dark-theme tokens (M5), payee default-category auto-overwrite guard (M7) — DONE (2026-06-03)
- C2/FR-7.9/FR-7.10 net-expense dashboard: migration 0027 fixes SQL view for partial forgiveness; _monthly_totals uses net_amount view for expenses and excludes settlement income; _category_breakdown uses net_amount; new _pending_splits_from_others_total + pending_splits_from_others field in DashboardResponse; 7 new integration tests — DONE (2026-06-03)

# Create Split Drawer — COMPLETE

Spec: docs/specs/create-split-drawer.md

## Tasks
- Task A — Backend: atomic POST /splits with inline settlements + forgiveness (schema fields + create_split logic + 11 tests, no migration) — DONE (2026-06-06)
- Task B — Frontend: Create Split drawer (+Create Split button, CreateSplitDrawer + LinkTransactionPanel, inline payee creation, settlement linking, forgiveness, balance check, submit gating, useCreateSplit + 6 tests) — DONE (2026-06-06)
