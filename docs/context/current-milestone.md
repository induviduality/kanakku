# Credit Cards Sprint (2026-07-24) — Fable Review 2026-07-12 (05-credit-cards) — COMPLETE

User scope (via clarifying Q&A): implement §4 (readable liability balances), §3.3 (bill-payment import fix, minimum + matching hint), and §5 (seed existing card debt, approach (a) — allow opening_balance on liability as a debit, scoped to credit_card/loan). Enforcement-hole cleanup (#5/#14) intentionally NOT taken — approach (a) legitimizes opening_balance on cards instead of banning it. §6.1 statement-cycle metadata skipped.

## Completed Tasks
- §4 Readable liability balances: shared `lib/balance.ts` formatter (`₹X due` / `cleared` / `credit`); wired into AccountDrawer, Accounts list, dashboard account cards; dashboard hero split into Net Worth / Cash / Owed. UI-only, build + tests green — DONE
- §3.3 Bill-payment import fix: `_record_to_transaction` supports `transfer` + validated `to_account_id`; new `GET /imports/{batch_id}/transfer-suggestions` matching hint; `ImportReview` type dropdown + destination picker + one-click hint. Build clean; backend syntax/import-checked (no local Postgres to run pytest) — DONE
- §5 Seed existing card debt (approach a, confirmed positive-outstanding): removed the app guard blocking opening_balance on liabilities; `compute_balances` counts it as a debit; account form "Current outstanding"; dev-seed scenario; spec updated. Code-only, no migration. Build + Accounts tests green; backend syntax/import-checked — DONE

## Not taken (per user scope)
- Enforcement-hole cleanup (#5/#14) — superseded by §5 approach (a), which legitimizes opening_balance on cards.
- §6.1 statement-cycle metadata (statement_day/payment_due_day) — skipped.

## Deferred / caveats
- §3.3 hint double-count: if a card statement's "payment received" line was separately imported as income on the card, accepting the transfer hint double-credits the card; the income line should be rejected. Auto-resolution not built (out of "hint only" scope); suggestion carries `matched_transaction_id` for a future enhancement.
- Backend tests for all three workstreams were syntax/import-checked only — no local Postgres this session. Worth a real pytest run against a test DB before considering fully verified.

# Ad-hoc Fix Sprint (2026-07-23, cont. 2) — Fable Review 2026-07-12: Bug #10 (logout) — COMPLETE

## Completed Tasks
- #10 No logout control anywhere: new shared `useLogout()` hook; desktop `ProfileMenu` (profile icon → Popover → "Log out") in `TopNav`; mobile "Log out" tile in `MobileNav`'s More sheet — DONE, browser-verified (opened menu, logged out, landed on /login)
- Found + fixed a real outage while re-testing: `accounts`/`transactions`/`splits`/8 other tables have no actual DB-level FK to `users` (only declared in the ORM, never migrated in) — `dev_seed.py`'s reset silently failed to cascade, leaving orphaned rows that crashed the API. Restored the app, cleaned up the orphans by hand (verified zero impact on real user data), logged the missing-FK gap in `docs/todo.md` as a deferred follow-up per user's explicit choice

## Pending
- (none — bug #10 fixed and validated; the missing-FK issue is intentionally deferred, tracked in docs/todo.md's new "Known Issues" section)

# Ad-hoc Fix Sprint (2026-07-23, cont.) — Fable Review 2026-07-12: Bugs #6, #7, #8, #9 — COMPLETE

## Completed Tasks
- #6 Import confirm silently skipped unparseable records: new `RecordStatus.failed` + migration 0030, `_record_to_transaction` returns a reason, `ImportReview.tsx` gained a "Failed" tab with edit-to-requeue — DONE, browser-verified end to end (broken record surfaced with exact parse error → edited → requeued to pending → confirmed successfully)
- #7/#8 Split period-scoping: unsettled splits now show in every period until settled; settled splits match every linked expense transaction's month (not just the earliest) — new `expense_dates` field on `SplitResponse`, `Splits.tsx` + `SplitsAll.tsx` rewritten to the user's exact specified semantics — DONE, browser-verified with two constructed scenarios (Jan pending split visible in Jul; Jan+Feb settled bundle visible in both those months and nowhere else)
- #9 Idle auto-logout (20 min) + mounted the previously-dead `AuthGuard` — DONE, code-reviewed and build-verified; the 20-minute wait itself wasn't exercised in real time
- Found + fixed while validating in the browser (not one of the numbered review bugs): `frontend/Dockerfile` had no `.dockerignore`, baking the developer's local `.env.local` (`VITE_MOCK_API=true`) into built Docker images — added `frontend/.dockerignore`

## Pending
- (none — all four bugs fixed and validated)

# Ad-hoc Fix Sprint (2026-07-23) — Fable Review 2026-07-12: Bugs #3 & #4 — COMPLETE

## Completed Tasks
- #3 Split edit (PUT) data loss: preserved partial-settlement amounts and forgiveness across the delete-and-recreate — backend captures pre-existing settlement amounts up front and reuses them; `SplitForm.tsx` now carries/submits `forgiven_amount` per share with a new edit-mode input — DONE
- #4 Savings-goal progress never moved when linked from the transaction form: `PiggyBank.current_amount` replaced as a live-computed value (`services/piggy_bank_balance.py`, same pattern as the account-balance D-002 fix) instead of an imperative cache only some code paths updated — DONE

## Pending
- (none — both bugs fixed; no local DB to run the split/piggy-bank test suites against, syntax-checked only)

# Ad-hoc Fix Sprint (2026-07-11) — Create/Edit Split Drawer Revamp

## Completed Tasks
- Fixed linked-transaction amount resolution (₹0 bug for picks outside the 3-month pool): per-id `useQueries` in SplitForm + query-cache priming in TransactionPicker — DONE
- SplitForm UI revamp: unified selected-expense list with total footer, collapsible picker, resolved settlement rows, touched-gated validation errors, allocation hint — DONE
- Amount-owed auto-fill from linked payments (reads query cache, not stale local txnMap, to avoid a one-render lag) — DONE
- Standalone "Done" button next to the expense picker (was relabeling "Add expense") — DONE
- "I'm not part of this split" checkbox to hide/zero Your share — DONE

## Pending
- Visual browser verification (user confirmed docker redeploy picked up the code; no explicit visual sign-off received yet)

# Ad-hoc Fix Sprint (2026-07-11, cont.) — Transaction Edit Correctness

## Completed Tasks
- Fixed timezone shift on transaction date edits: `TransactionForm`'s datetime-local field now formats/parses via local `Date` components instead of slicing the raw UTC ISO string (`toDatetimeLocalValue` helper) — DONE
- Fixed stale per-transaction cache: `usePatchTransaction`/`useDeleteTransaction` now invalidate `['transaction', id]` (singular) in addition to `['transactions']` (plural list) — the edit page, SplitForm, SplitDrawer, and SplitDetail all read the singular key directly — DONE
- Confirmed (via Explore-agent audit) this mismatched-noun cache-invalidation bug is unique to transactions.ts; no other api/ file needs the same fix — DONE
- 3 new regression tests (timezone round-trip in TransactionForm, cache invalidation for both mutations in transactions.test.tsx)

## Next
- (see cont. 2 below)

# Ad-hoc Fix Sprint (2026-07-11, cont. 2) — Dashboard Period Balances + Pagination Move

## Completed Tasks
- Account Balances section now shows each account's balance as of the end of the selected period (or "today" for the current, still-open period) instead of the live current_balance — new `_balance_delta_since` helper in `routers/dashboard.py`, renamed `AccountBalanceItem.current_balance` → `.balance` throughout (schema, frontend type, Dashboard.tsx, MSW fixture) — DONE
- Total Balance hero stat now sums the same period-scoped balances, consistent with the section below it — DONE
- Added "Account Balances — as of {date}" label to make the period scoping visible — DONE
- Refactored `_cashflow_by_account`'s duplicated opening-balance calc to reuse the new shared helper — DONE
- **Bug found + fixed**: `SUM(Transaction.to_amount)` for transfer-in credit silently dropped every same-currency transfer (to_amount is NULL unless cross-currency; frontend never sends it) in both the new helper and `_cashflow_by_account`'s per-bucket query — fixed with `COALESCE(to_amount, amount)`, matching the live-balance code path's existing fallback. This is very likely the cause of the cash flow chart looking "completely wrong" — a single dropped transfer-in permanently offsets every later bucket in a running-balance chart — DONE
- 3 backend tests added/updated (period-end scoping, transfer-credit regression); no local test DB, syntax-checked only — flagged to user
- Moved the transactions page "Rows per page" selector from the pagination footer into the header row, left of the Filters button; kept its existing visibility gating (`showPagination`) — DONE
- Discovered (not fixed, out of scope): 64 pre-existing frontend test failures across Categories/Tags/ImportReview/PiggyBankDrawer/BudgetForm/Transactions/Splits, traced to commit 734cb94 (predates this session) adding Toast/Period context usage without updating the shared test render helper. Confirmed via git-stash isolation that nothing touched today caused or worsened this.

## Pending
- User to confirm cash flow chart now reads correctly after the transfer-in fix (needs a docker redeploy + visual check)
- Backend tests for the dashboard changes couldn't be executed locally (no DATABASE_URL configured) — worth a real run against a test DB before considering this fully verified
- Separately: the ToastProvider/PeriodProvider test-infra gap above is a good follow-up task on its own

# Ad-hoc Fix Sprint (2026-07-11, cont. 3) — Live current_balance drift investigation → account_balance.py rewrite (Phase 1)

## Completed Tasks
- Investigated a reported production balance mismatch (Union Bank account showing a real drift vs. bank statement). Read-only DB queries (with user's own psql commands, run by them against their prod server) recomputed each account's balance from its actual transaction history and compared it to the stored `current_balance` column — all 5 real accounts showed drift, in inconsistent directions.
- Ruled out: the transfer to_amount bug (already fixed, verified clean by hand); a restore-after-edit bug (impossible — `patch_transaction` requires the txn to be active); a logic bug in the reverse/reapply pattern in `transactions.py` (mathematically sound for Decimal arithmetic, confirmed by re-reading).
- **Root cause found**: `routers/imports.py`'s `confirm_records` inserted `Transaction` rows via `session.add()` directly, bypassing the `apply_balance` logic entirely — imported transactions never touched `Account.current_balance` at all. `replace_existing` was worse: it soft-deleted the old transaction and added the new one without touching balance on *either* side, so it only stayed correct when the replaced amount happened to match the original exactly (explains why some accounts drifted more than others — Axis ACE Credit Card, a brand-new account fully populated via import, was frozen at ₹0 despite real history; older accounts only drifted where a "replace duplicate" resolution used a different amount than the original).
- Rather than patch the two missing call sites and leave the "any code path can forget to call apply_balance" design intact, decided (with user) on a structural fix: **`Account.current_balance` becomes a computed value (SUM over the ledger), not an imperatively-maintained cached column.** At this app's real volume (~200-300 txns/month per user's own estimate), a SUM over an indexed `(user_id, account_id)` prefix costs low single-digit milliseconds — there was never a real performance case for caching it.
- **Phase 1 (this task, staged rollout)**: new `app/services/account_balance.py` with `compute_balance`/`compute_balances` (batched, `as_of`-bounded for historical/period queries). Removed all `apply_balance` call sites from `transactions.py` and `imports.py` — nothing to maintain, so nothing to forget. `accounts.py`'s 5 response-building endpoints now attach the computed value. `dashboard.py`'s `_account_balances` and `_cashflow_by_account`'s opening-balance step now call `compute_balances(as_of=...)` directly, replacing the old `_balance_delta_since` "live value minus delta" indirection with a direct bounded sum.
- **Kept `accounts.current_balance` column in the DB, unused/frozen** (stopped writing to it via the mutation call sites; still set once at account creation as a snapshot) — lets the user manually compare the frozen legacy value against the newly computed one before a follow-up migration drops the column (Phase 2, not done yet).
- **Necessary correctness fix bundled in**: `create_account` used to set `current_balance = opening_balance` directly with no corresponding ledger transaction. Since balance is now computed from the ledger, that would have made every newly created account show ₹0 despite a nonzero opening balance — a regression introduced by this refactor if left alone. Fixed by having `create_account` insert a real `opening_balance`-type Transaction when `opening_balance != 0`. This also closes the systemic "two sources of truth for a starting balance" gap that caused the very first confusion in this session (an account's `opening_balance` field vs. a separately, sometimes retroactively, created `opening_balance` transaction).
- Updated `test_dashboard_account_balances_as_of_period_end` (written earlier today, before this refactor) — it assumed the opening balance was timeless; now it's dated at account-creation time, so the test's "period entirely before account creation" fixture design no longer applied. Rewrote it anchored on "today" instead of "last month."
- Added 2 new regression tests in `test_imports.py` for the exact bug found (`test_confirm_updates_account_balance`, `test_replace_existing_updates_account_balance`) — there was previously zero balance-correctness coverage on either import-confirmation endpoint, which is exactly why this went undetected for weeks.
- Validation: no local test DB, so `python -m py_compile` on every touched file, plus a real import-resolution check (`python -c "import app.routers.X"` with dummy env vars) to catch circular imports/missing names beyond what syntax-checking alone would show. Not executed against a real database.

## Pending
- **Phase 2** (separate task, later): once the user has spot-checked computed balances against the frozen legacy column values and their real bank statements, drop the now-unused `accounts.current_balance` column in a follow-up migration.
- User's existing production drift (the numbers found during investigation) resolves itself automatically the moment this deploys — no manual `UPDATE` needed, since balance is no longer a stored value to fix.

# Ad-hoc Fix Sprint (2026-07-11, cont. 4) — Transactions Summary: Transfer Credit/Debit + Opening/Closing Balance — COMPLETE

## Completed Tasks
- Fixed `list_transactions`'s inflow/outflow summary excluding transfers even when the view is filtered to a specific account (where a transfer in/out of that account is a real credit/debit) — added direction-aware transfer legs to `total_inflow`/`total_outflow` when `account_id` filters the view — DONE
- Added `opening_balance`/`closing_balance` to `TransactionListResponse` and the Transactions page header, summed across the filtered (or all) accounts — DONE
- Ran the real backend test suite against a running local Docker Postgres for the first time this session (previously blocked, no DATABASE_URL) — fixed 4 pre-existing test regressions from last session's Phase 1 balance refactor that had never actually executed against a DB — DONE
- `test_transactions.py` (28 tests, incl. 2 new), `test_imports.py`, `test_accounts.py` all pass against the real DB — DONE
- **Follow-up fix, same task**: user caught "Opening: 0.00" on a real account whose opening_balance transaction was dated exactly at the queried period's `from_date` — `compute_balances`'s `as_of` bound used strict `<` uniformly across income/expense/opening_balance, silently excluding an opening_balance transaction landing exactly on the boundary (the normal case for PDF imports, always dated at midnight). Fixed in the shared `account_balance.py` helper: opening_balance uses `<=`, income/expense keep `<`. Fixes the same latent bug in `dashboard.py`'s `_account_balances`/`_cashflow_by_account` for free. New regression test; 56 tests pass — DONE
- **Second follow-up fix, deeper root cause**: still wrong — a Jan 1 (IST) transaction was leaking into the "Dec 2025" view. `Transactions.tsx`/`Disputes.tsx` built `from`/`to` by reattaching a literal `'T00:00:00.000Z'`/`'T23:59:59.999Z'` to a bare date string, treating the user's local calendar date as UTC (confirmed user is IST, UTC+5:30 — off by up to 5.5h at every boundary). New `toLocalStartOfDayISO`/`toLocalEndOfDayISO` in `period.ts` do the local→UTC conversion correctly via `.toISOString()` on the already-correct local Date objects; exposed as `rangeStart`/`rangeEnd` on `usePeriod()`; wired into both naive call sites. A separately-reported "still broken" turned out to be an unrelated data-entry mistake (editing a datetime-local input's month/day without the year, landing a txn a year off) — confirmed via direct SQL, unwound by re-editing. 2 new tests in `period.test.ts` (15 pass, real IST test-runner); `bun run build` clean — DONE

## Pending
- (none — task complete)

# Ad-hoc Fix Sprint (2026-07-11, cont. 5) — Timezone Consistency: dashboard.py, budgets.py, Splits Pages — COMPLETE

User's explicit ask: "timestamps timezone agnostic, converted right before it's returned from the API or converted to IST locally from the UI." Backend now never guesses a timezone from a bare date; the browser is the only place local-time conversion happens.

## Completed Tasks
- `dashboard.py::home_dashboard`'s `start_date`/`end_date` widened to `datetime`; `_period_window` custom branch no longer reconstructs a UTC instant from date components — DONE
- `budgets.py`: `list_budgets` gained `spent_from`/`spent_to: datetime` (kept `from_date: date` for the one genuinely date-only comparison, `Budget.end_date`); `list_budget_transactions`'s `from`/`to` changed to `datetime` — DONE
- `Splits.tsx`/`SplitsAll.tsx`: fixed client-side filters slicing a UTC timestamp's first 10 chars directly (extracts UTC date, not local) — now convert via `toIsoDate(new Date(...))` first — DONE
- New `toLocalExclusiveEndISO` in `period.ts`; `usePeriod()` exposes `rangeStart`/`rangeEnd`/`rangeEndExclusive`; wired into `Dashboard.tsx`, `Budgets.tsx`, `BudgetDrawer.tsx`, `BudgetDetail.tsx` — DONE
- Found + fixed while unblocking `test_dashboard.py`: `_cashflow_by_account`'s Step 2 never included `opening_balance`-type transactions, so an account created mid-period silently lost its opening balance from the per-account cashflow chart — DONE
- Fixed `db_tables` test fixture: `Base.metadata.create_all` skips raw-SQL Alembic objects, so `transaction_with_net_amount` (view, migration 0027) never existed in the test DB — blocked 23 dashboard tests outright. Recreated the view by hand in the fixture — DONE
- That fix surfaced 3 more pre-existing test bugs from last session's Phase 1 refactor (never caught, tests couldn't run before) — fixed all three — DONE
- Full backend: 486 passed, 8 failed (all pre-existing/unrelated). Full frontend: 466 passed, 64 failed (exact pre-existing ToastProvider/PeriodProvider baseline, confirmed via `git stash` — zero new failures). `bun run build` clean — DONE

## Pending
- (none — task complete)
- The ToastProvider/PeriodProvider frontend test-infra gap (64 failures, traced to commit 734cb94) remains a good follow-up task on its own.

# Ad-hoc Fix Sprint (2026-07-11, cont. 6) — Fixed the Remaining 8 Test Failures — COMPLETE

User pushed back on leaving these flagged as "pre-existing/out of scope" and asked to actually investigate. Found the export/import feature was completely broken in production, not just test staleness.

## Completed Tasks
- `export_worker.py::_EXPORT_TABLES` had a `llm_activity_logs`/`llm_activity_log` (plural/singular) table-name typo — every real export failed outright before producing anything. Fixed, including the duplicate in both import paths' remap sets — DONE
- Both import paths (`cli.py`, `routers/export.py`) called `session.begin()` after the session had already auto-begun a transaction from an earlier query — import failed unconditionally. Fixed by removing the redundant `begin()` and committing/rolling back explicitly — DONE
- Export flattens UUID/Decimal/date/datetime to strings for JSON; import never reversed it, so asyncpg rejected every such column. New `deserialize_row()` in `export_worker.py` uses each column's real ORM type (`Base.metadata`) to coerce correctly — DONE
- `user_settings` (one row per user, auto-created at signup) always collided on import for any existing target user — fixed by deleting the target's row first — DONE
- Restored `PaymentMethodCreate`'s "upi_app required when type is upi" validation, accidentally deleted in an unrelated commit (`467bc3b`) — confirmed via `git show` — DONE
- Updated `reports/query`'s missing-user_id test to assert the actual (better) behavior: automatic AST-level `user_id` injection, not rejection — DONE
- Fixed 2 tests calling `/auth/setup` twice (rejected by design, single-user app) — switched to the `register_second_user` invite-flow helper — DONE
- Made Redis-dependent tests deterministic with `_force_redis_unavailable()` instead of relying on the real environment lacking Redis (this sandbox has a live one) — DONE
- Fixed `test_roundtrip_export_import`'s remaining 409 — not a bug, the UUID-conflict guard correctly blocking re-import while source data is still live in the same DB; updated the test to delete source data first, matching the feature's real intended use (migrating to a fresh install) — DONE
- Full backend suite: **494 passed, 0 failed, 7 skipped** — every test passes — DONE

## Pending
- (none — task complete)

# Ad-hoc Fix Sprint (2026-07-12) — PDF Import Timezone Bug + Filter Persistence — COMPLETE

## Completed Tasks
- Root-caused "Opening: 0.00" still showing for ALL accounts on the Year view: `imports.py::_record_to_transaction` hardcoded `tzinfo=UTC` on a bank statement's date-only field, landing the opening_balance transaction 5.5h (IST) after the correct period boundary. Fixed using the user's own `UserSettings.timezone` via `ZoneInfo` — backend stays timezone-agnostic (uses the user's configured value, doesn't hardcode one), per the user's explicit principle. New regression test; 495 backend tests pass — DONE
- Fixed transaction filters resetting when editing a transaction and returning to the list: `TransactionFormPage` pushed a bare `/transactions` URL on Back/Save, discarding active filters. Switched to `router.history.back()` since that page is only ever entered from the Transactions list — restores the exact previous URL (filters/sort/pagination) automatically — DONE

## Pending
- (none — task complete)

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
