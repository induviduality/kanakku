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
