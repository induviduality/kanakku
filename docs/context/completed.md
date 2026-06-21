# Completed Milestones

## Edit Split functionality (2026-06-21)

Implemented full "Edit Split" functionality allowing users to modify an existing split (adding/removing payees, updating notes, and adjusting payee/user shares) in a unified, atomic editor:
- **Backend**: Added `PUT /splits/{split_id}` endpoint in `backend/app/routers/splits.py`. It atomically deletes child rows (expenses, settlements, shares), validates new inputs/invariants under a single transaction, and recreates the split structure.
- **API Client**: Added `apiPut` helper in `api-client.ts` and `useUpdateSplit` mutation hook in `splits.ts`.
- **Form Refactoring**: Extracted shared split form logic from `CreateSplitDrawer.tsx` into a reusable `SplitForm.tsx` component. Updated `SplitForm` to support editing when pre-populated with `initialSplit`.
- **Drawer Integration**: Integrated Edit mode in `SplitDrawer.tsx` with an edit button in the header actions, rendering the `SplitForm` directly inside the drawer when active.
- **Verification**: Verified via Vitest unit tests in `SplitDrawer.test.tsx` and a full frontend build check (`tsc -b`).

## TransactionPicker feature (2026-06-21)

Replaced the 50-row capped native `<select>` / checkbox pickers in split settlement flows with a reusable `TransactionPicker` component:
- `TransactionRow` (pure display: date + description + amount + source→destination)
- `TransactionPicker` (three-tier search: 3-month pool → auto-triggered year-scoped backend search → manual all-time search)
- Backend: `q` (description ILIKE) param added to `GET /transactions`
- Wired into `SplitDrawer` (settle picker + `useTransaction` amount pre-fill), `BundleAsSplitModal` (multi-select; removed buggy client-side `incomeTotal`/M3), `CreateSplitDrawer` (both expense and per-share income pickers)
- 8 commits: b3f506b (backend q param), 4a0d49e (frontend API), d7ebcca (MSW handler), b31a6c9 (TransactionRow), 2666b57 (TransactionPicker), 6507d0d (SplitDrawer), 0f761f7 (BundleAsSplitModal), 6239662 (CreateSplitDrawer)
- Minor finding noted for future cleanup: `txnMap` in SplitDrawer still uses the default limit=50 (pre-existing behaviour, accepted per spec)

## Transaction form enrichment + Category/Tag management pages (2026-06-15)

**Spending Classification**
- New `SpendingClassification` StrEnum on `Transaction` model (5 values: `routine`, `planned_essential`, `planned_discretionary`, `unplanned_essential`, `unplanned_discretionary`). Nullable — historical transactions are unclassified by default.
- Migration `0028_spending_classification.py` adds the column + PG enum type.
- `TransactionCreate`, `TransactionPatch`, `TransactionResponse` updated.
- `TransactionForm` shows a `<select>` dropdown for expense/income types; hidden for transfer/opening_balance.

**Piggy Bank Linking**
- `piggy_bank_id` added to `TransactionCreate`/`TransactionPatch`/`TransactionResponse` as a virtual field backed by `piggy_bank_contributions`.
- `_sync_piggy_bank()` helper in transactions router: delete-then-insert contribution atomically when `piggy_bank_id` is set in create or patch.
- `TransactionForm` shows active (non-completed, non-deleted) piggy banks as chip buttons for expense/income types.

**Budget Tagging** — already present; no changes needed.

**Categories → single-select**
- `TransactionForm` categories changed from multi-select chips to a `<select>` dropdown. API still accepts `category_ids[]`; form wraps/unwraps the single id.
- Payee default-category auto-populates `selectedCategoryId` (first id) when no category is selected.

**Tags → multi-select with inline create**
- Tags in `TransactionForm` retain chip multi-select. Added a text input below the chips: typing a name and pressing Enter either selects an existing tag (case-insensitive match) or calls `POST /tags` and immediately selects the new tag.

**Categories page** — restyled `Categories.tsx` to use design-system `kk-*` classes; card grid layout with color swatch, icon, applicability label; inline create/edit modals. Added to `SideNav` (after Payees, tag icon).

**Tags page** — restyled `Tags.tsx` to use design-system `kk-*` classes; pill-card layout with color dot; inline create/edit modals. Added to `SideNav` (after Categories, hash-lines icon).

- See decision log 2026-06-15 for SpendingClassification enum design, piggy bank FK choice, and category/tag select rationale.

## Infra fix (2026-06-06) — entrypoint honors compose command; worker actually runs arq

- `backend/entrypoint.sh`: `exec "$@"` instead of a hardcoded uvicorn line. The Dockerfile ENTRYPOINT was swallowing each service's compose `command:`, so the API ignored `--workers 3`/`--reload` and the worker ran uvicorn instead of `python -m arq …` (background jobs never ran)
- `infra/docker-compose.yml`: worker now `depends_on api: service_healthy` so the API applies migrations first; the worker's `alembic upgrade head` then runs against an up-to-date schema as a no-op (avoids concurrent migration race + ensures schema is ready)
- Verified via `docker compose config`: prod api → `--workers 3`, worker → arq, dev api → `--reload`
- See decision log 2026-06-06

## Create Split Drawer — Task B (2026-06-06) — Frontend drawer

- Spec: `docs/specs/create-split-drawer.md`
- `api/splits.ts`: re-added `SplitShareCreate` (now with `settlement_transaction_ids` + `forgiven_amount`) + `SplitCreate` types and a `useCreateSplit` hook (invalidates splits + transactions)
- `components/drawers/CreateSplitDrawer.tsx` (new): single-file drawer with internal `LinkTransactionPanel`. Sections: expense multi-select (search, grays out already-split via `is_split`), My share (+"Use remainder"), payee cards (Autocomplete with inline payee create, amount +"Use remainder", collapsible forgive with "All", settlement linking that credits each income txn at full amount — no manual amounts), live balance check (FR-7.9 net expense), notes. Submit is gated on full validity (`canSubmit`), builds the atomic `POST /splits` body (omits the null-payee share when my-share is 0), and reports the new id via `onCreated`
- Already-linked income excluded in the Link panel: derived client-side from existing splits' settlements (settlement income carries no `split_id` flag) + ids staged elsewhere in the form
- `pages/Splits.tsx`: "Create Split" header button opens the drawer; on create, opens the SplitDrawer for the new split
- `components/drawers/CreateSplitDrawer.test.tsx` (new): 6 tests (render, submit gating, already-split disabled, atomic payload with my+payee share, forgive-overflow inline error). All pass; Splits page tests still green; `bun run build` shows zero new TS errors in touched files (pre-existing errors elsewhere remain)
- Feature complete (Task A backend + Task B frontend)

## Create Split Drawer — Task A (2026-06-06) — Atomic create with inline settlements + forgiveness

- Spec: `docs/specs/create-split-drawer.md`
- `schemas/split.py`: `SplitShareCreate` gains `settlement_transaction_ids: list[UUID]` and `forgiven_amount: Decimal`; validators reject negative forgiveness and forbid settlements/forgiveness on the null-payee (own) share; `SplitCreate` gains a cross-share duplicate-settlement guard
- `routers/splits.py` `create_split`: within the single existing transaction, each share now validates + inserts its settlements (income-only, not-already-linked → 409, each credited at full amount), enforces `Σ(settlements) + forgiven ≤ share.amount` (422), and derives status via `_derive_status`. Any failure raises before commit → full rollback (no partial split). No migration (columns/tables already existed)
- `tests/test_splits.py`: +11 tests (settlement, forgiveness, partial both, paid+forgiven overflow, already-linked 409, own-share settlement/forgiveness rejection, cross-share duplicate, settlement-must-be-income, rollback). 25 pass; other split suites (44) still green
- Next: Task B — frontend Create Split drawer

## Review fix M6 (2026-06-06) — Remove split creation from TransactionForm

- `components/forms/TransactionForm.tsx`: removed `isSplit` state, `splitShares` state, `createSplit` mutation, share-sum validation, post-submit split API call, and the "Split this expense" toggle + `SplitSharesEditor` render
- `api/splits.ts`: removed `useCreateSplit` hook, `SplitCreate` interface, `SplitShareCreate` interface
- `components/SplitSharesEditor.tsx`: deleted (only consumer was TransactionForm)
- `components/SplitSharesEditor.test.tsx`: deleted
- Splits are now created exclusively via BundleAsSplitModal from the Transactions page (POST /splits/bundle — already atomic)

## Review fix M2 (2026-06-06) — SQL query endpoint user_id injection

- `routers/reports.py`: replaced string-scan `has_user_id` guard with `_inject_user_id_filter()` — uses sqlglot AST transform to inject `table.user_id = :user_id` for every user-owned table into every SELECT (including CTEs and subqueries). Existing WHERE wrapped in parens to block OR-bypass. `.sql()` (no dialect) used so named params stay as `:user_id` for SQLAlchemy. Users no longer need to write the user_id filter themselves.

## Ad-hoc Fixes (2026-06-03) — C2 Net-expense dashboard (FR-7.9 / FR-7.10)

- `alembic/versions/0027_fix_net_amount_view_partial_forgiveness.py`: fixes `transaction_with_net_amount` view to include `forgiven_amount` for partial forgiveness (previously only counted fully-forgiven shares)
- `routers/dashboard.py`: `_monthly_totals` now sums `net_amount` from view for expenses; income excludes transactions linked in `split_share_settlements` (FR-7.10); new `_pending_splits_from_others_total` helper returns period-scoped outstanding balances (amount − forgiven − settled)
- `routers/dashboard.py`: `_category_breakdown` now sums `net_amount` instead of raw `amount`
- `schemas/dashboard.py`: `DashboardResponse` gains `pending_splits_from_others: Decimal`
- `tests/test_dashboard_net_expense.py`: 7 new integration tests covering net share, partial forgiveness, settlement exclusion, period scoping, and category net amounts

## Ad-hoc Fixes (2026-06-03) — Frontend cosmetic bug-review fixes

- `.github/workflows/frontend.yml` + `backend.yml`: disabled automatic CI triggers (workflow_dispatch only)
- `frontend/vite.config.ts`: corrected proxy target port 8000 → 8765 (M4)
- `frontend/src/components/forms/TransactionForm.tsx`: migrated all classes to dark-theme design tokens (kk-input, text-fg-muted, bg-surface-2, bg-accent-dim, border-border-strong); payee default-category no longer overwrites a manual selection (M5, M7)
- `frontend/src/components/Autocomplete.tsx`: migrated dropdown classes to design tokens (M5)

## Ad-hoc Fixes (2026-06-02) — Split multi-expense + payee uniqueness

- `alembic/versions/0026_split_multi_expense_payee_uniqueness.py`: creates `split_expenses` join table (UNIQUE on `transaction_id`), migrates existing data, drops `splits.expense_transaction_id`, updates DB trigger to sum via join, adds partial unique index on `split_shares(split_id, payee_id)` for non-null payees
- `models/split.py`: removed `expense_transaction_id`; added `SplitExpense` model
- `schemas/split.py`: `SplitCreate`/`BundleCreate`/`SplitResponse` all use `expense_transaction_ids: list[UUID]`; `SplitCreate` has `no_duplicate_payees` validator (null + non-null)
- `services/split_service.py`: `validate_invariant` queries via `split_expenses`; checks duplicate non-null payees
- `routers/splits.py`: `create_split` validates list of expense IDs + per-share ≤ total + null-payee uniqueness; `bundle_split` groups income txns by payee into one share per payee; `_load_expense_ids()` helper; `_build_response()` loads list
- `routers/transactions.py`: `_fetch_split_id` uses `split_expenses` join
- `dev_seed.py`: migrated to `SplitExpense` rows; added user's own share to all 3 seed splits (was missing — caused UI invariant bug)
- `tests/test_splits.py`, `test_splits_bundle.py`, `test_splits_settle.py`, `test_splits_schema.py`: all updated/rewritten for list syntax + new scenarios
- `frontend/src/api/splits.ts`: `Split`, `SplitCreate`, `BundleCreate` use `expense_transaction_ids: string[]`
- `frontend/src/components/BundleAsSplitModal.tsx`: accepts `expenseTransactionIds: string[]`
- `frontend/src/pages/Transactions.tsx`: bundle action enabled for any all-expense selection (not just single); passes array of IDs + total amount
- `frontend/src/components/drawers/SplitDrawer.tsx`, `pages/SplitDetail.tsx`, `components/forms/TransactionForm.tsx`: updated to use `expense_transaction_ids` array
- `frontend/src/test/handlers.ts`: all SPLIT_* fixtures updated to `expense_transaction_ids: [...]`

## Ad-hoc Fixes (2026-05-31) — UI Polish

### Password eye toggle + Transaction selection CTAs
- `frontend/src/components/PasswordInput.tsx`: new shared component wrapping `<input type=password>` with a `lucide-react` Eye/EyeOff toggle button; `tabIndex=-1` so it doesn't interrupt tab flow
- Login, Setup, AcceptInvite, ImportUpload: all password fields replaced with `<PasswordInput>`
- `frontend/src/pages/Transactions.tsx`: bulk action bar replaced with a sticky bottom bar (`fixed bottom-0`) that appears on any selection; shows count, a prominent "Bundle as Split" button (indigo) when exactly one expense is selected, and a helpful hint otherwise; page gets `pb-20` padding when bar is active to avoid overlap

## Ad-hoc Fixes (2026-05-31)

### Backend pytest: all 461 tests passing
- `conftest.py`: `DROP SCHEMA public CASCADE` instead of `drop_all` (avoids view dep on `split_shares`); patched `_readonly_engine` to test DB
- `test_migration.py`: patch `settings.database_url` before alembic runs so `env.py` override points to test DB; `_reset_schema()` drops/recreates cleanly
- `0017_readonly_role.py`: catch `dependent_objects_still_exist` in `DROP ROLE` — cluster-level role has 22 grants in production DB
- `app/models/tag.py`: partial unique index `(user_id, name) WHERE deleted_at IS NULL` enforces dedup at DB level
- `app/routers/splits.py`: `session.refresh(share)` after each commit to avoid `MissingGreenlet` on `updated_at`
- `app/routers/imports.py` + `gpay.py`: replaced module-level `from app.db.session import async_session_factory` binding with shared `get_session`; test fixture patching now takes effect
- `app/main.py`: register `gpay_router` before `imports_router` so `/gpay-matches` static routes don't get shadowed by `/{batch_id}` UUID parameter
- Test fixes: invite flow for second users, `label`→`name` in payment_methods tests, dashboard limit (5 not 10), budget instance deletion uses today as `start_date`

## Ad-hoc Fixes (2026-05-27) — continued

### Split settlement UI: multi-payment + partial forgiveness frontend
- `frontend/src/api/splits.ts`: `SplitShareSettlement` type; `SplitShare` updated with `paid_amount`, `forgiven_amount`, `settlements[]`; `useSettleShare` body is `{shareId, body: SettleRequest}`; new `useForgiveShare`; `useUnlinkSettlement(splitId)` uses `apiDelete<SplitShare>`
- `frontend/src/lib/api-client.ts`: `apiDelete<T=void>` made generic to handle DELETE responses with body
- `frontend/src/test/handlers.ts`: `SPLIT_DINNER` fixture (4 shares: own, Rahul partial+settlement row, Priya forgiven, Neel pending); settle/forgive/unsettle/unlink handlers updated; new income txn `txn-settle-dinner-rahul`
- `frontend/src/components/drawers/SplitDrawer.tsx`: full rewrite — `SettlementRow` with unlink ×; `ShareRow` with paid/forgiven/remaining breakdown, settlements list, inline "Add payment" form (income txn select + capped amount), inline "Forgive" form with "All remaining" shortcut, Reset ConfirmDialog; parent builds `payeeMap` + `txnMap` + `incomeTransactions` once
- `frontend/src/pages/SplitDetail.tsx`: full rewrite — table layout with same settlement detail; `SettlementItem` unlink; inline settle/forgive modals; payees + income txns fetched in parent
- `frontend/src/pages/Splits.tsx`: `overallStatus` and `unsettled` filter now use `amount - paid_amount - forgiven_amount` remaining-balance logic
- `frontend/src/pages/Transactions.tsx`: settlement map now iterates `sh.settlements[]` array instead of removed `sh.settlement_transaction_id`
- `frontend/src/pages/SplitDetail.test.tsx`: updated to use `split-dinner` fixture; assertions match new shape

### Split settlement redesign: multi-payment + partial forgiveness
- `backend/alembic/versions/0024_split_settlements.py`: new `split_share_settlements` join table; `forgiven_amount` added to `split_shares`; `settlement_transaction_id`, `settled_at`, `forgiven_at` dropped
- `backend/app/models/split.py`: added `SplitShareSettlement` model; `SplitShare` updated (removed old fields, added `forgiven_amount`)
- `backend/app/schemas/split.py`: `SplitShareSettlementResponse`; `SplitShareResponse` now has `paid_amount` + `settlements` list; `SettleRequest` body is `{transaction_id, amount?}`; new `ForgiveRequest { amount }` (SET semantics)
- `backend/app/routers/splits.py`: `POST settle` links income txn to share via join table, accepts optional partial `amount`; `DELETE settlements/{id}` unlinks one payment; `POST forgive {amount}` sets `forgiven_amount`; `POST unsettle` clears everything; status derived by `_derive_status(amount, paid, forgiven)` helper
- `backend/app/dev_seed.py`: updated settled shares to use `SplitShareSettlement` rows; removed old `settled_at`/`settlement_transaction_id` kwargs
- Tests: `test_splits_settle.py` fully rewritten (15 tests); `test_splits_bundle.py` assertions updated; `test_splits.py` assertions updated

## Ad-hoc Fixes (2026-05-27)

### Splits UI revamp — uniform transaction rows with badges
- Removed `SplitInlinePanel` component entirely (was bundling split+shares in a non-standard layout)
- All transactions now render as uniform rows; split identity shown via badges:
  - **Split** badge (accent/indigo) when `t.is_split === true`
  - **Split Share** badge (green) for settlement income transactions identified via `splitsBySettlementTxnId` map
- `openDrawer()` helper resolves `drawerSplitId` + `drawerSplitTitle` before opening the drawer
- `TransactionDrawer` — simplified "Linked Split" section shows only the expense title; added `splitId` + `splitTitle` props
- `frontend/src/test/handlers.ts` — added `split_id` to 3 split expense transactions; added 3 settlement income transactions; wired `settlement_transaction_id` on settled shares; fixed `GET /splits/:splitId` to do a real lookup (was always returning `SPLIT_DINNER`)
- `backend/app/dev_seed.py` — added settlement income transactions + wired `settlement_transaction_id` on settled shares

### Transaction details drawer — full details + external_ref field
- `backend/alembic/versions/0023_transaction_external_ref.py`: migration adding `external_ref TEXT NULL` to transactions
- `backend/app/models/transaction.py`: added `external_ref` mapped column
- `backend/app/schemas/transaction.py`: added `external_ref` to Create/Patch/Response; added `payment_method_name: str | None` and `split_id: uuid.UUID | None` to Response (denormalized for display)
- `backend/app/routers/transactions.py`: added `_fetch_payment_method_name` and `_fetch_split_id` helpers; `_to_response` now populates both
- `frontend/src/api/transactions.ts`: added `external_ref`, `payment_method_name`, `split_id` to `Transaction`; `external_ref` to Create/Patch
- `frontend/src/components/drawers/TransactionDrawer.tsx`: shows all details — payment method, external ref (UTR), budget names, split shares with status badges, currency, import record, time-of-day, updated_at
- `frontend/src/components/forms/TransactionForm.tsx`: added Ref/UTR field (`external_ref`), state + payload
- `frontend/src/components/drawers/BudgetDrawer.tsx` + `frontend/src/pages/BudgetDetail.tsx`: `toTransaction()` adapter updated with new nullable fields
- `frontend/src/test/handlers.ts`: added `external_ref`, `payment_method_name`, `split_id` to `TXN_BASE`

## Ad-hoc Fixes (2026-05-26)

### BudgetDrawer redesign + period transaction filtering fix
- `frontend/src/components/drawers/BudgetDrawer.tsx`: full redesign — circular SVG progress ring (green/amber/red thresholds), hero spend panel, 2-col Period/Created grid, details rows, transactions list with empty state "No transactions in this period."
- `backend/app/routers/budgets.py`: `_compute_current_spent` and `list_budget_transactions` now use `tzinfo=UTC` in datetime comparisons to match asyncpg TIMESTAMPTZ columns
- `frontend/src/test/handlers.ts`: budget transactions MSW handler now parses `from`/`to` query params and filters by date range; previously returned January fixtures regardless of selected period

### Budget transaction period-bucket filtering
- `backend/app/routers/budgets.py` (`list_budget_transactions`): default window changed from `b.start_date/b.end_date` to `_current_period_window(b)` so the detail view always shows the current period by default
- `backend/app/schemas/transaction.py`: added `budget_ids: list[uuid.UUID]` to `TransactionResponse`
- `backend/app/routers/transactions.py`: added `_fetch_budget_ids` helper; `_to_response` now populates `budget_ids`
- `frontend/src/api/transactions.ts`: added `budget_ids: string[]` to `Transaction` interface
- `frontend/src/components/drawers/BudgetDrawer.tsx`: added `usePeriod()`, now passes `start_date`/`end_date` to `useGetBudgetTransactions`
- `frontend/src/pages/BudgetDetail.tsx`: added `usePeriod()`, passes period dates to `useGetBudgetTransactions`; `toTransaction()` adapter includes `budget_ids: []`
- `frontend/src/components/forms/TransactionForm.tsx`: added budget picker (expense-only chip toggle, single-select); sends `budget_ids` in create/patch payload
- `frontend/src/test/handlers.ts`: added `budget_ids: []` to transaction mock

### Budget NaN fix + current-period spending
- `frontend/src/test/handlers.ts`: added `current_spent: '500.00'` to `BUDGETS_RESPONSE` (was missing, causing `parseFloat(undefined)` = NaN in the Budgets list)
- `backend/app/routers/budgets.py`: replaced `_batch_spent` with `_current_period_window` + `_compute_current_spent`. Recurring budgets now use `expand_budget(b, today, today)` to find the current occurrence's date window, so `current_spent` shows only this period's spending rather than all-time.

### Budget activated_at + period filter + create form redesign
- Migration `0022`: adds `activated_at TIMESTAMPTZ` to `budgets` (server default = now)
- `models/budget.py`, `schemas/budget.py`: added `activated_at` field
- `routers/budgets.py`: `create_budget` sets `activated_at`; `list_budgets` gains `from_date`/`to_date` params and filters by `activated_at`/`end_date`; `_current_period_window` rewritten with `rrulestr.before/after` (handles mid-period days); `_compute_current_spent` accepts explicit period window
- `dev_seed.py`: budgets now have `activated_at` set to start of year
- Frontend: `useGetBudgets` accepts `fromDate`/`toDate`; `Budget` type includes `activated_at`
- `Budgets.tsx`: period filter bar (This month / Last month / This quarter / Custom); create form redesigned with Predefined schedule picker (Daily/Weekly/Monthly/Quarterly/Yearly) and Custom interval (every X days)

### Budgets page: global period context wiring
- Removed local period filter chips (This month / Last month / This quarter / Custom) from `Budgets.tsx`
- `Budgets.tsx` now reads `dashboardParams.start_date`/`end_date` from `usePeriod()` (global context driven by TopNav's `PeriodPicker`)
- The navbar calendar now controls all time-based filtering on the Budgets page

## Ad-hoc Fixes Sprint (post-M14)

### Import PDF 401/422 bug fixes + dev mode auth bypass
- `frontend/src/api/imports.ts`: fixed `useUploadPdf` to use `getAccessToken()` from auth-storage instead of `localStorage.getItem('access_token')` (access token is in-memory only, never in localStorage)
- `frontend/src/api/imports.ts`: added `if (!r.ok) throw r` check before parsing response JSON, preventing 401/5xx responses from being silently treated as a successful `ImportBatch` (which caused navigation to `/imports/undefined`)
- `backend/app/dependencies.py`: when `DEV_MODE=true` and no Authorization header is present, `get_current_user` falls back to the dev seed user (`11111111-...`); uses `HTTPBearer(auto_error=False)` so missing header is handled manually instead of auto-rejected



### payment_method label→name rename (migration 0021)
- `backend/alembic/versions/0021_payment_method_label_to_name.py`: renames the `label` column to `name` in the DB
- `backend/app/models/payment_method.py`, `schemas/payment_method.py`, `routers/payment_methods.py`, `dev_seed.py`: all updated to use `name`

### Generic table parser replaces HDFC-specific parser
- `backend/app/parsers/banks/generic.py`: new layout-agnostic parser handling dual-column (withdrawal/deposit), single-column Dr/Cr suffix, and headerless PDFs via flexible column-header matching
- `backend/app/parsers/banks/hdfc.py`: deleted; `backend/app/parsers/registry.py`: now routes all inputs to `GenericTableParser`
- `backend/tests/test_parser.py`: replaces deleted `test_hdfc_parser.py` with layout-agnostic tests

### CLI diagnostic scripts for local testing
- `backend/scripts/diagnose_statement.py`: prints parser detection + column layout without creating DB rows
- `backend/scripts/parse_statement.py`: runs full parse pipeline on a local PDF file

### Account active toggle + shared rrule.ts + Transactions table styling
- `frontend/src/components/drawers/AccountDrawer.tsx`: inline active/inactive toggle chip that PATCHes directly without opening the edit modal
- `frontend/src/lib/rrule.ts`: shared RRULE-to-human-readable parser replacing duplicated lookup tables in BudgetDrawer and Budgets; handles BYMONTHDAY, BYDAY, INTERVAL; unknown patterns → "Custom"
- `frontend/src/pages/Transactions.tsx`: replaced transparent/white table background with `bg-surface-1/60 + backdrop-blur-sm`; swapped hardcoded gray classes for design-system tokens

### Budget `current_spent` query rewrite
- `backend/app/routers/budgets.py`: rewrote `_batch_spent` to run two date-windowed batched queries — (1) explicit `transaction_budgets` links, (2) `transaction_categories` category matches — both JOINing `Budget` to apply `start_date / end_date` filter; fixes mismatch between list page and drawer spend figures

### Opening balance + recurrence rule + dropdown styling
- `opening_balance` transaction type: backend enum + migration (`0020_opening_balance_type.py`), liability-account guard in create/patch, dev seed fixtures, frontend form (filtered accounts, type pill, no payee/category/tags), drawer chip, Transactions page display
- Global form element dark-theme: `base.css` overrides browser-default white backgrounds on `select/input/textarea`
- Dashboard `opening_balance` display: `RecentTransaction.type` includes `'opening_balance'`, shows `+` prefix and `text-positive-dim` color
- Recurrence rule: replaced free-text RRULE inputs with `<select>` dropdowns in `Budgets.tsx` create modal and `BudgetForm.tsx` edit page; `BudgetDrawer.tsx` shows human-readable label

## Navigation & Dashboard Enhancement Sprint (post-M14, pre-UI-Polish)

### MSW mock API mode
- `frontend/src/test/handlers.ts` + Vite config: `VITE_DEV_MODE` flag enables MSW in-browser API mocking so frontend runs without a backend

### Design system tokens + typography
- `frontend/src/styles/base.css`: CSS custom properties for color tokens (bg, surface, fg, accent, border, positive, negative, warning); Inter + JetBrains Mono fonts via Google Fonts

### Dashboard period selector + savings rate
- `frontend/src/pages/Dashboard.tsx`: period selector (week/month/quarter/year/custom) wired to dashboard endpoint `from/to` params; savings rate = (income − expense) / income with prev-period comparison delta

### Global top navbar with period picker
- `frontend/src/components/TopNav.tsx`: sticky navbar with period picker dropdown (tabs → dropdown on narrow viewports); transparent background on scroll

### Breadcrumb navigation
- `frontend/src/components/Breadcrumbs.tsx`: route-aware breadcrumbs in topnav

### Side navigation bar
- `frontend/src/components/SideNav.tsx`: collapsible side nav for desktop (transactions, accounts, payees, budgets, splits)

### Tamil brand mark + dashboard in sidenav
- `frontend/src/components/TopNav.tsx`: கணக்கு logotype; dashboard link added to side nav

## UI Polish Sprint (post-M14)

### Drawer system — drawer components + page wiring
- `frontend/src/components/Drawer.tsx`: base drawer primitive using Radix Dialog, slides from right, `DrawerSection` + `DrawerRow` sub-components
- `frontend/src/components/drawers/SplitDrawer.tsx`: summary (total + net expense), per-share settle/forgive/unsettle actions inline, ConfirmDialog for forgive
- `frontend/src/components/drawers/TransactionDrawer.tsx`: hero amount, type chip, account/payee/category/tag lookups via cached hooks
- `frontend/src/components/drawers/BudgetDrawer.tsx`: progress bar with color-coded fill, details, linked transactions list
- `frontend/src/components/drawers/PiggyBankDrawer.tsx`: ProgressRing SVG, details, contributions list with remove action
- `frontend/src/components/drawers/PayeeDrawer.tsx`: avatar initial + type chip, details panel
- `frontend/src/components/drawers/AccountDrawer.tsx`: balance hero, details, payment methods list
- Wired into: Splits.tsx, SplitsAll.tsx (cards → onClick + SplitDrawer), Transactions.tsx (row click → TransactionDrawer), Budgets.tsx (card click → BudgetDrawer), PiggyBanks.tsx (card click → PiggyBankDrawer), Payees.tsx (Eye icon → PayeeDrawer), Accounts.tsx (name area click → AccountDrawer)

### Splits page redesign + shimmer fix
- Added MSW handler for `GET /api/v1/splits` (root cause of infinite shimmer)
- Splits.tsx rewritten: "Unsettled" + "All Splits — {period}" sections, top-5 each, "View all →" links
- SplitsAll.tsx: full list page with mode='pending'|'all', period filtering client-side
- Router: `/splits/pending` and `/splits/history` static routes added before dynamic `$splitId`

### EmptyState component
- `frontend/src/components/EmptyState.tsx`: shared empty state with title/description/action, used across Transactions, Accounts, Budgets, PiggyBanks, Subscriptions, Imports, Splits

### Page centering
- Added `mx-auto` to `max-w-*` containers on Accounts, Payees, Budgets, BudgetDetail, BudgetForm, Categories, Tags, Settings, SettingsLLMActivity, GPayImport, GPayOrphans, GPayResolve

### Icon-only edit/delete buttons
- Replaced text buttons with Pencil/Trash2 lucide icons on Payees, Categories, Tags, Accounts, Budgets, Subscriptions, PiggyBanks, PiggyBankDetail, SubscriptionDetail
- Added ChevronDown/ChevronRight for payment methods expand toggle; Plus for add button



## Milestone 14: Production Deployment — In Progress

### Task 14.4: End-to-End Tests
- frontend/e2e/critical-paths.spec.ts: 9 critical-path Playwright tests (first-run setup, account/payee/transaction flow, PDF import UI, budget creation, split toggle, retroactive bundle, reports/dashboard, data export, mobile 360px flow)
- frontend/playwright.config.ts: updated — liveStack detection skips preview server when E2E_BASE_URL set; chromium project now includes critical-paths tests
- frontend/package.json: added `e2e` and `e2e:ui` scripts
- infra/Makefile: added `test-backend`, `test-frontend`, `e2e` targets

### Task 14.3: Documentation
- README.md: full rewrite — quick start (5-step clone-to-running), architecture diagram, Pi 5 and VPS deployment sections, backup/restore commands, adding a new bank parser guide, docs table, contributing section
- docs/api.md: new — OpenAPI UI URLs, authentication requirements, all endpoint groups, pagination, soft-delete recovery, reports/query constraints
- docs/operations.md: already created in Task 14.2 (backup, logs, health checks, updates, Tailscale)

### Task 14.2: Backup Automation
- infra/scripts/auto-backup.sh: nightly script with 7/4/12 daily/weekly/monthly rotation; DRY_RUN=1 and DOW/DOM env var overrides for deterministic testing; cron entry documented
- docs/operations.md: new runbook — manual backup/restore, auto-backup cron entry, Docker log access, health checks, update procedure, common issues, Tailscale setup
- backend/tests/test_auto_backup.py: 7 pytest tests covering file creation, Monday/1st-of-month special cases, and rotation keeps-N-most-recent for all three tiers

### Task 14.1: Caddyfile & Production Compose
- infra/docker-compose.yml: production-ready baseline — no code volume mounts, `--workers 3` uvicorn, resource limits (db 1g, redis 256m, api 512m, worker 512m, frontend 128m, ollama 4g, caddy 128m), healthcheck on api service, PUBLIC_DOMAIN env passed to caddy
- infra/docker-compose.override.yml: new dev override — code volume mounts on api/worker (hot reload), port exposures for db/redis/api/frontend/ollama; picked up automatically by `docker compose up` in dev, absent in production
- infra/env.example: DOMAIN → PUBLIC_DOMAIN with updated comments for localhost/LAN/Tailscale/VPS scenarios
- infra/Makefile: added prod-up/prod-down targets (skip override file)
- docs/running.md: documented dev vs. prod compose usage, `docker compose -f docker-compose.yml up -d` for production

## Milestone 11: Reports & Custom Dashboards — In Progress

### Task 11.1: Read-Only Role & Query Endpoint
- backend/alembic/versions/0017_readonly_role.py: creates app_readonly role with SELECT on 19 curated tables
- backend/app/config.py: added readonly_database_url (defaults to database_url), query_timeout_ms (10s), query_row_limit (10K)
- backend/app/db/session.py: lazy get_readonly_engine() using READONLY_DATABASE_URL
- backend/app/schemas/reports.py: QueryRequest, QueryResponse schemas
- backend/app/routers/reports.py: POST /reports/query — sqlglot SELECT-only + user_id check, SET TRANSACTION READ ONLY, 10s timeout, 10K row limit
- backend/app/main.py: registered reports router
- backend/pyproject.toml: added sqlglot>=25.0
- backend/tests/test_reports_query.py: 8 tests (select works, DML rejected, missing user_id, multiple statements, invalid SQL, unauthenticated, row limit)

### Task 11.3: Dashboards & Widgets CRUD
- backend/app/models/report_dashboard.py: ReportDashboard, ReportWidget models with VizType enum
- backend/alembic/versions/0018_report_dashboards.py: migration with readonly grants
- backend/app/routers/reports.py: full CRUD for dashboards + widgets (10 endpoints)
- backend/app/schemas/reports.py: Dashboard/Widget create/update/response schemas
- backend/tests/test_report_dashboards.py: 12 tests (CRUD, access control, cascade delete)

### Task 11.4: Frontend — Reports
- frontend/src/api/reports.ts: full API hooks (schema, query, dashboards CRUD, widgets CRUD)
- frontend/src/pages/Reports.tsx: dashboard list with create form
- frontend/src/pages/ReportDashboard.tsx: react-grid-layout grid with widget cards, widget data loading via useEffect
- frontend/src/components/reports/QueryEditor.tsx: CodeMirror SQL editor with run button
- frontend/src/components/reports/SchemaReferencePanel.tsx: collapsible table/column browser with search
- frontend/src/components/reports/StarterQueryLibrary.tsx: 6 hardcoded starter queries
- frontend/src/components/reports/WidgetRenderer.tsx: bar/line/pie/kpi/table viz via Recharts
- frontend/src/components/reports/WidgetEditor.tsx: modal with SQL editor + schema panel + viz config
- frontend/src/router.tsx: /reports and /reports/:dashboardId routes
- frontend/src/test/handlers.ts: MSW handlers for all reports endpoints
- 8 test files (Reports, ReportDashboard, QueryEditor, SchemaReferencePanel, StarterQueryLibrary, WidgetRenderer, WidgetEditor): 37 tests passing

## Milestone 11: Reports & Custom Dashboards — COMPLETE

## Milestone 12: Data Portability — In Progress

### Task 12.1: JSON Archive Export
- backend/app/models/export_job.py: ExportJob model (pending/running/done/failed status, file_path)
- backend/alembic/versions/0019_export_jobs.py: migration
- backend/app/schemas/export.py: ExportJobResponse schema
- backend/app/workers/export_worker.py: export_archive ARQ job — queries 24 tables in dependency order, writes tar.gz with manifest.json + per-table JSON arrays
- backend/app/routers/export.py: POST /export (enqueue/inline fallback), GET /export/{job_id}, GET /export/{job_id}/download
- backend/tests/test_export.py: 8 tests (trigger, status, download, data isolation, unauthenticated)

### Task 12.2: JSON Archive Import
- backend/app/routers/export.py: POST /import-archive — validates schema_version, fresh-user guard (409 if has transactions), UUID conflict detection, atomic INSERT in dependency order with user_id remapping
- backend/tests/test_import_archive.py: 5 tests (roundtrip, blocked with transactions, wrong version, malformed, unauthenticated)

### Task 12.3: CLI & Backup Scripts
- infra/scripts/backup.sh: pg_dump to timestamped file in BACKUP_DIR (strips asyncpg prefix)
- infra/scripts/restore.sh: pg_restore from dump file with schema drop/recreate
- backend/app/cli.py: python -m app.cli with create-user, export-archive, import-archive commands (argparse, async)
- backend/tests/test_cli.py: 6 tests (create-user, duplicate exit, export creates file, unknown user exit, roundtrip, wrong schema version)

### Task 12.4: Frontend — Export/Import UI
- frontend/src/api/portability.ts: useTriggerExport, useGetExportJob (polling), useImportArchive hooks
- frontend/src/pages/SettingsDataExport.tsx: trigger export, poll for done, download link
- frontend/src/pages/SettingsDataImport.tsx: file upload with safety warning, success with record counts
- frontend/src/router.tsx: /settings/export and /settings/import routes
- frontend/src/test/handlers.ts: MSW handlers for export/import-archive endpoints
- frontend/src/pages/SettingsDataExport.test.tsx + SettingsDataImport.test.tsx: 12 tests passing (249 total)

## Milestone 12: Data Portability — COMPLETE

## Milestone 13: PWA & Polish — In Progress

### Task 13.1: PWA Setup
- frontend/vite.config.ts: VitePWA configured with manifest (name=Kanakku, theme_color=#863bff, display=standalone, icons 192/512), workbox precache + NetworkFirst for /api/ GETs (10s timeout, 5min cache, skip /download paths)
- frontend/public/icons/icon-192x192.png + icon-512x512.png: generated PNG icons (purple #863bff brand color with K lettermark, rounded rectangle)
- frontend/index.html: title="Kanakku", theme-color meta, apple-mobile-web-app-* tags, apple-touch-icon link
- Build output: dist/manifest.webmanifest, dist/sw.js, dist/workbox-*.js generated; 12 assets precached; 249 tests passing

### Task 13.2: Mobile Audit
- frontend/src/components/MobileNav.tsx: bottom tab bar (Dashboard, Transactions, Add FAB, Budgets, More); More opens Radix Dialog sheet with 9 secondary links; active tab highlighted; all touch targets ≥ 44×44px; hidden on md+ screens
- frontend/src/components/AppLayout.tsx: root layout wrapper — renders Outlet + MobileNav; adds pb-14 on mobile for nav bar clearance; suppresses MobileNav on guest paths (/login, /setup, /accept-invite)
- frontend/src/router.tsx: rootRoute component updated to AppLayout
- frontend/playwright.config.ts: Playwright config with mobile-chrome project (360×780), webServer using vite preview, e2e/mobile.spec.ts testMatch
- frontend/e2e/mobile.spec.ts: 5 Playwright tests verifying no horizontal scroll at 360px and MobileNav presence
- frontend/vite.config.ts: e2e/ excluded from Vitest discovery
- 5 new Vitest tests for MobileNav; 254 total passing

### Task 13.3: Soft Delete Recovery UI
- backend/app/routers/recently_deleted.py: GET /recently-deleted — queries 8 entity tables, returns items soft-deleted within 30-day window sorted by deleted_at desc
- backend/app/routers/budgets.py: POST /budgets/{id}/restore endpoint added (was missing)
- backend/app/workers/purge_worker.py: purge_soft_deleted ARQ job + WorkerSettings with cron(hour=3) — deletes rows where deleted_at < now()-30d across all 8 entity tables
- backend/app/main.py: recently_deleted_router registered
- backend/tests/test_recently_deleted.py: 9 integration tests (empty list, shows deleted, excludes old, auth guard, cross-user, budget restore happy/not-found/not-deleted, purge job)
- frontend/src/api/recentlyDeleted.ts: useRecentlyDeleted + useRestoreItem hooks with RESTORE_PATHS mapping
- frontend/src/pages/RecentlyDeleted.tsx: tabbed view over 8 entity types with count badges, item rows with Restore buttons, 30-day expiry note
- frontend/src/router.tsx: /recently-deleted route added
- frontend/src/test/handlers.ts: recently-deleted GET + per-entity restore POST handlers
- 7 Vitest frontend tests; 261 total passing

## Milestone 13: PWA & Polish — COMPLETE

### Task 11.2: Schema Reference Endpoint
- backend/app/routers/reports.py: GET /reports/schema — hand-curated 19-table schema with column types, descriptions, FK metadata
- backend/app/schemas/reports.py: ColumnInfo, TableInfo, SchemaResponse schemas
- backend/tests/test_reports_schema.py: 4 tests (curated tables, auth tables excluded, FK metadata present, unauthenticated rejected)

## Milestone 9: LLM Integration — In Progress

### Task 9.1: LLMClient Interface
- backend/app/llm/base.py: LLMClient ABC with GPayRecord, BankCandidate, Match dataclasses; suggest_category + match_gpay_to_bank abstract methods
- backend/app/llm/null_client.py: NullClient — returns None/empty for testing and LLM_BACKEND=none
- backend/app/llm/factory.py: make_llm_client(settings) → OllamaClient or NullClient based on llm_backend env
- backend/pyproject.toml: added ollama>=0.4 dependency
- backend/tests/test_llm_interface.py: 8 tests — factory dispatch (none/unknown/ollama), NullClient safety (suggest/match/empty)

## Milestone 10: GPay Takeout Enrichment — In Progress

### Task 10.2: Frontend — GPay UI
- frontend/src/api/gpay.ts: GPayMatch, GPayUploadResponse types; useGetGPayMatches, useGetPendingGPayMatches, useGetOrphanGPayMatches, useUploadGPayTakeout, useResolveGPayMatch hooks
- frontend/src/pages/GPayImport.tsx: file picker (JSON only); upload + summary panel (parsed/auto-linked/pending/orphans); links to review and orphans pages
- frontend/src/pages/GPayResolve.tsx: list pending matches; per-match card showing GPay record + candidate radios + LLM suggestion; Confirm button resolves match and shows resolved state inline
- frontend/src/pages/GPayOrphans.tsx: list orphan records with merchant/date/amount and "orphan" badge
- frontend/src/router.tsx: /gpay/import, /gpay/resolve, /gpay/orphans routes added
- frontend/src/test/handlers.ts: GPAY_MATCHES_RESPONSE, GPAY_ORPHANS_RESPONSE, GPAY_UPLOAD_RESPONSE fixtures; MSW handlers for all 5 GPay endpoints
- Tests: GPayImport.test.tsx (5), GPayResolve.test.tsx (7), GPayOrphans.test.tsx (5) = 17 tests

### Task 10.1: GPay Parser & Matcher
- backend/app/models/gpay_match.py: GPayMatch model (id, user_id, gpay_data JSONB, candidate_transaction_ids UUID[], chosen_transaction_id, llm_suggestion_id, status enum, created_at); GPayMatchStatus enum (pending/resolved/orphan/auto_linked)
- backend/alembic/versions/0016_gpay_matches.py: migration creating gpay_matches table
- backend/app/services/gpay_matcher.py: parse_takeout() accepting JSON string/bytes/dict/list; _parse_record() with multi-format date parsing + currency symbol stripping; match_records() — ±1 day window, ±0.01 amount tolerance; persist_results() — auto-links exact matches, enriches bank txn notes with merchant name
- backend/app/schemas/gpay.py: GPayMatchResponse, GPayResolveRequest, GPayUploadResponse schemas
- backend/app/routers/gpay.py: POST /imports/gpay-takeout (upload + match + persist); GET /imports/gpay-matches; GET /imports/gpay-matches/pending; GET /imports/gpay-matches/orphans; POST /imports/gpay-matches/{id}/resolve (validates ownership, marks resolved, enriches txn)
- backend/app/models/__init__.py + main.py: GPayMatch registered, gpay_router mounted
- backend/tests/test_gpay_matcher.py: 6 unit tests (parse list, wrapped dict, rupee stripping, invalid skipping, date formats, empty); 5 integration tests (exact auto-link, orphan, ambiguous pending, invalid JSON 422, auth guard); 2 endpoint tests (list matches, resolve+cross-user 404) = 13 total

### Task 9.4: Frontend — LLM Activity Page
- frontend/src/api/settings.ts: LLMActivityLog interface; useGetLLMActivity hook with operation/backend/limit params
- frontend/src/pages/SettingsLLMActivity.tsx: table of recent LLM calls (timestamp, operation, backend, model, duration_ms, status badge); expand-row button for payload_summary JSON; filter dropdowns for operation and backend
- frontend/src/router.tsx: /settings/llm-activity route added
- frontend/src/test/handlers.ts: LLM_ACTIVITY_RESPONSE fixture (suggest_category/match_gpay_to_bank); MSW handler for GET /settings/llm-activity with operation+backend filter support
- frontend/src/pages/SettingsLLMActivity.test.tsx: 8 tests (title, rows after load, backend/model columns, badges, duration, expand payload, operation filter, backend filter)

### Task 9.3: LLM Activity Log
- backend/app/models/llm_activity_log.py: LLMActivityLog model (id, user_id, operation, payload_summary JSONB, backend, model, duration_ms, succeeded, created_at)
- backend/alembic/versions/0015_llm_activity_log.py: migration creating llm_activity_log table with user_id index
- backend/app/llm/logging.py: LoggingLLMClient wrapper — records every suggest_category and match_gpay_to_bank call with timing and payload summary; logs succeeded=False on exceptions
- backend/app/schemas/settings.py: LLMActivityLogResponse pydantic schema
- backend/app/routers/settings.py: GET /settings/llm-activity?limit&operation&backend — returns recent LLM calls scoped to current user
- backend/app/models/__init__.py: LLMActivityLog registered
- backend/tests/test_llm_activity_log.py: 7 integration tests (suggest logged, match logged, failure logged with succeeded=false, empty list, auth guard, filter by operation, filter by backend)

### Task 9.2: Ollama Implementation
- backend/app/llm/ollama_client.py: OllamaClient using ollama.AsyncClient; suggest_category with retry on bad output + fence stripping; match_gpay_to_bank per-record with int parsing from prose
- backend/tests/test_ollama_client.py: 9 tests — clean match, fence stripping, retry on bad output, two-fail returns None, empty categories, match returns index, no candidates, index from prose, out-of-range index

## Milestone 8: PDF Statement Import — COMPLETE

### Task 8.7: Frontend — Import Pages

### Task 7.1: Dashboard Backend Endpoint
- backend/app/schemas/dashboard.py: DashboardResponse + 7 sub-schemas (BudgetSummaryItem, CategoryBreakdownItem, PendingSplitsSummary, PiggyBankSummaryItem, AccountBalanceItem, ActiveSubscriptionItem, RecentTransaction)
- backend/app/routers/dashboard.py: GET /dashboard/home; _month_window(), _budget_status() helpers; 8 sub-query helpers (monthly_totals, budgets_summary, category_breakdown, recent_transactions, pending_splits_summary, piggy_banks_summary, account_balances, active_subscriptions)
- backend/app/main.py: dashboard router registered
- backend/tests/test_dashboard.py: 16 integration tests (structure, totals, transfers excluded, cross-user, category breakdown, budget summary, over_budget, piggy banks, subscriptions, pending splits, prev month excluded)

### Task 7.2: Frontend — Dashboard
- frontend/src/api/dashboard.ts: DashboardData and all sub-interfaces; useGetDashboard() hook
- frontend/src/pages/Dashboard.tsx: responsive grid with skeleton loaders; StatCard, hero stats (total_spent_net/total_income/net), budgets, category chart, subscriptions, piggy banks, pending splits, account balances, recent transactions; error state
- frontend/src/components/dashboard/BudgetProgressCard.tsx: status badge (on_track/warning/over_budget), progress bar, spent/amount display
- frontend/src/components/dashboard/CategoryBreakdownChart.tsx: Recharts donut PieChart; wrapped in <div aria-label="..."> (Recharts doesn't forward aria-label in jsdom)
- frontend/src/components/dashboard/SubscriptionStatusBadge.tsx: color-coded badge (green/amber/red) with aria-label
- frontend/src/components/dashboard/PiggyBankProgressRing.tsx: SVG circle ring with aria-label, green on completed
- frontend/src/router.tsx: index route wired to Dashboard
- frontend/src/test/handlers.ts: DASHBOARD_RESPONSE fixture + MSW handler
- Tests: Dashboard.test.tsx (10), BudgetProgressCard.test.tsx (5), CategoryBreakdownChart.test.tsx (2), SubscriptionStatusBadge.test.tsx (3), PiggyBankProgressRing.test.tsx (4) = 24 tests
- backend/app/dev_seed.py: idempotent seed data with realistic scenarios (subscriptions/piggy banks/budgets/transactions) for dev mode

## Milestone 8: PDF Statement Import — In Progress

### Task 8.7: Frontend — Import Pages
- frontend/src/pages/Imports.tsx: batch list with status badge (pending/processing/completed/failed), verification_status, parsed/confirmed/rejected counts, Review link per batch, Upload PDF link
- frontend/src/pages/ImportUpload.tsx: file input (PDF only), account selector, optional password field; calls useUploadPdf; navigates to review page on success
- frontend/src/pages/ImportReview.tsx: batch header with status + verification badge; 4 tabs (pending/confirmed/rejected/duplicate); per-row inline edit (description, amount, type) via usePatchRecord; bulk confirm (+ force confirm for duplicates) and bulk reject via select-all checkbox; useConfirmRecords/useRejectRecords
- frontend/src/test/handlers.ts: IMPORT_BATCHES_RESPONSE + IMPORT_RECORDS_RESPONSE fixtures; MSW handlers for GET/PATCH /imports and confirm/reject endpoints
- frontend/src/router.tsx: /imports, /imports/upload, /imports/$batchId routes
- Tests: Imports.test.tsx (5), ImportUpload.test.tsx (5), ImportReview.test.tsx (9) = 19 tests

### Task 8.6: Confirm / Reject Flow
- app/routers/imports.py: POST /imports/{batch_id}/confirm (ConfirmRequest: record_ids optional, force flag; converts pending/duplicate records to Transaction rows atomically; updates total_confirmed); POST /imports/{batch_id}/reject (RejectRequest: record_ids optional; marks pending records as rejected; updates total_rejected)
- _record_to_transaction() helper: converts parsed_json → Transaction row
- Tests in tests/test_imports.py: confirm creates transaction, force flag confirms duplicates, reject selected, reject all pending

### Task 8.5: Deduplication
- backend/app/services/dedup.py: find_duplicates(session, user_id, candidates) using rapidfuzz fuzzy matching; exact match on (date, amount, account), fuzzy match on description with date window; cross-account negative
- 9 unit tests: exact/fuzzy/date-window/cross-account

### Task 8.4: Balance Verification
- backend/app/services/balance_verifier.py: verify_balance(records, opening_balance) → VerificationResult; VERIFIED/DISCREPANCY/INDETERMINATE status stored on batch
- 9 unit tests: VERIFIED/DISCREPANCY/INDETERMINATE cases

### Task 8.3: HDFC PDF Parser
- backend/app/parsers/base.py: BankParser ABC with parse(text) → list[ParsedTransaction]
- backend/app/parsers/banks/hdfc.py: HDFCParser regex-based implementation
- backend/app/parsers/registry.py: detect_parser(text) → BankParser | None
- 15 unit tests: parse correctness, detection logic

### Task 8.2: PDF Upload & Unlock
- backend/app/workers/import_worker.py: process_pdf_import ARQ job; pikepdf unlock; parser detection + run
- POST /imports/pdf multipart endpoint; per-user temp storage; ARQ enqueueing with fallback
- 6 integration tests: correct/wrong password, non-PDF, empty file, auth, cross-user isolation

### Task 8.1: Import Schema
- backend/app/models/import_batch.py: ImportBatch (id, user_id, source, filename, account_id, status, verification_status, total_parsed/confirmed/rejected, imported_at, completed_at, deleted_at); RawImportRecord (id, batch_id, raw_text, parsed_json JSONB, status, transaction_id, confidence, match_type, created_at); enums: ImportSource, ImportBatchStatus, VerificationStatus, RecordStatus, RecordConfidence, RecordMatchType
- backend/app/schemas/imports.py: ImportBatchResponse, RawImportRecordResponse, RawImportRecordPatch, ParsedTransaction
- alembic migration: import_batches + raw_import_records tables; FK transactions.import_record_id → raw_import_records
- frontend/src/api/imports.ts: all types + hooks (useGetImportBatches, useGetImportBatch, useGetImportRecords, useUploadPdf, usePatchRecord, useConfirmRecords, useRejectRecords)
- backend/tests/test_import_schema.py: model-level tests

## Milestone 6: Subscriptions & Piggy Banks — COMPLETE

### Task 6.3: Frontend — Subscriptions & Piggy Banks
- frontend/src/api/subscriptions.ts: BillingCycle, SubscriptionStatus, Subscription types; useGetSubscriptions, useGetSubscription, useCreateSubscription, usePatchSubscription, useDeleteSubscription, useLinkTransaction, useGetSubscriptionHistory hooks
- frontend/src/api/piggy_banks.ts: PiggyBank, Contribution types; useGetPiggyBanks, useGetPiggyBank, useCreatePiggyBank, usePatchPiggyBank, useDeletePiggyBank, useGetContributions, useAddContribution, useRemoveContribution hooks
- frontend/src/pages/Subscriptions.tsx: list with StatusBadge (green=upcoming, amber=due_soon, red=overdue, aria-label for accessibility), inline create modal
- frontend/src/pages/SubscriptionDetail.tsx: subscription info, status badge, linked transactions history
- frontend/src/pages/SubscriptionForm.tsx: create/edit form, useEffect to pre-populate for edit mode
- frontend/src/pages/PiggyBanks.tsx: list with ProgressRing SVG (aria-label "X% progress"), completed badge
- frontend/src/pages/PiggyBankDetail.tsx: progress ring, add contribution inline form (transaction_id + amount), contributions list with remove button
- frontend/src/pages/PiggyBankForm.tsx: create/edit form
- frontend/src/router.tsx: 8 new routes (/subscriptions/* and /piggy-banks/*)
- frontend/src/test/handlers.ts: SUBSCRIPTIONS_RESPONSE (Netflix/upcoming, Spotify/overdue), PIGGY_BANKS_RESPONSE (Europe Trip 30%), CONTRIBUTIONS_RESPONSE; MSW handlers for all endpoints
- Tests: Subscriptions.test.tsx (8), SubscriptionDetail.test.tsx (5), SubscriptionForm.test.tsx (3), PiggyBanks.test.tsx (6), PiggyBankDetail.test.tsx (6) — 28 total



### Task 6.2: Piggy Banks
- app/models/piggy_bank.py: PiggyBank model (id, user_id, name, target_amount, currency, current_amount (default 0), target_date nullable, notes, is_completed, timestamps, deleted_at); PiggyBankContribution (id, piggy_bank_id FK→piggy_banks CASCADE, transaction_id FK→transactions RESTRICT, contribution_type enum(transfer/expense), amount, date, notes, created_at); ContributionType StrEnum
- app/schemas/piggy_bank.py: PiggyBankCreate, PiggyBankPatch, PiggyBankResponse (with computed progress_pct float), ContributionCreate, ContributionResponse
- app/routers/piggy_banks.py: POST/GET/GET{id}/PATCH/DELETE/restore CRUD; POST /piggy-banks/{id}/contributions (validates txn ownership, adds amount to current_amount, auto-sets is_completed); DELETE /piggy-banks/{id}/contributions/{contrib_id} (reverses amount, un-completes if now < target); GET /piggy-banks/{id}/contributions; _update_completion helper (is_completed = current >= target)
- alembic/versions/0013_piggy_banks.py: creates piggy_banks + piggy_bank_contributions tables
- tests/test_piggy_banks.py: 18 integration tests (CRUD, cross-user, add contribution updates total, auto-complete at threshold, remove reverses/un-completes, list contributions, cross-user transaction 404, invalid transaction 404, patch triggers auto-complete)

### Task 6.1: Subscriptions
- app/models/subscription.py: Subscription model (id, user_id, name, amount, currency, billing_cycle enum (daily/weekly/monthly/quarterly/yearly), billing_day INT, last_billed_at nullable, account_id FK→accounts, payment_method_id FK→payment_methods nullable, category_id FK→categories nullable, is_active, url, notes, timestamps, deleted_at)
- app/services/subscription_dates.py: compute_next_billing_date(sub, as_of) → date (one cycle after last_billed_at; or first occurrence from billing_day if never billed); subscription_status(sub, as_of) → "overdue"|"due_soon"|"upcoming" (due_soon = within 3 days)
- app/schemas/subscription.py: SubscriptionCreate, SubscriptionPatch, SubscriptionResponse (includes next_billing_date + status computed fields)
- app/routers/subscriptions.py: POST/GET/GET{id}/PATCH/DELETE/restore CRUD; POST /subscriptions/{id}/link-transaction (sets transaction.subscription_id); GET /subscriptions/{id}/history (linked transactions)
- alembic/versions/0012_subscriptions.py: creates subscriptions table; adds FK fk_transactions_subscription_id (transactions.subscription_id → subscriptions.id)
- app/schemas/transaction.py: added subscription_id to TransactionCreate + TransactionPatch
- app/routers/transactions.py: wires subscription_id on create + patch (as scalar field)
- app/main.py: subscriptions_router registered
- tests/test_subscription_dates.py: 16 unit tests (all billing cycles, status transitions)
- tests/test_subscriptions.py: 18 integration tests (CRUD, cross-user isolation, link-transaction, history, create-with-subscription-id)

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
