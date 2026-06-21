# Decision Log

## 2026-06-21 — TransactionPicker: three-tier escalation instead of single large fetch

**Context:** H4 UX bug: split pickers capped at 50 rows. Options were: (A) raise limit globally, (B) full pagination, (C) tiered escalation (3-month pool + search fallback).

**Decision:** Tier-C. Tier-1 fetches last 90 days (limit 200). If the user types a query with no client matches, tier-2 auto-fires (last year, limit 100, `q` filter). If tier-2 is also empty, a manual "Search all transactions" button triggers tier-3 (all-time, limit 100). This avoids loading thousands of transactions upfront while giving complete coverage at cost of only two extra network requests in the worst case.

**Affects:** `frontend/src/components/TransactionPicker.tsx`, `frontend/src/api/transactions.ts`, `backend/app/routers/transactions.py`

## 2026-06-21 — SplitDrawer txnMap kept at default limit=50 for settlement labels

**Context:** SplitDrawer needs income transaction labels for already-linked settlements (SettlementRow). Replacing the picker removed the need for `incomeTransactions` but `txnMap` (used for label display) still comes from `useTransactions({ type: 'income' })` at the default 50-row limit. The spec explicitly accepted this tradeoff.

**Decision:** Leave the txnMap fetch at limit=50. Settlements outside the top-50 income transactions fall back to a truncated-ID label. Full fix would require fetching the specific settlement transaction IDs only, which is a separate scope.

**Affects:** `frontend/src/components/drawers/SplitDrawer.tsx`

## 2026-06-15 — SpendingClassification: 5-value enum covering intent × necessity + routine

**Context:** User requested tracking "necessary vs unnecessary" expenses. The raw requirement was a 2×2 matrix (wanted/didn't want × necessary/unnecessary) plus a separate "routine" bucket.

**Decision:** Introduced a `SpendingClassification` StrEnum with 5 values: `routine`, `planned_essential`, `planned_discretionary`, `unplanned_essential`, `unplanned_discretionary`. `routine` is its own top-level value (not folded into planned_essential) because recurring predictable spend (rent, EMIs, subscriptions) is a distinct spending pattern from a deliberate one-off essential purchase. Column is nullable — omitting it means "unclassified", which is the correct default for historical/imported transactions.

**Alternatives considered:**
- Boolean `is_necessary` + boolean `is_planned` pair — normalised but harder to display/filter; enum collapses them into a single queryable column
- 4-value (drop `routine`) — loses the recurring-vs-deliberate distinction that users care about for budgeting insight

**Affects:** `backend/app/models/transaction.py`, `backend/app/schemas/transaction.py`, `backend/alembic/versions/0028_spending_classification.py`, `frontend/src/api/transactions.ts`, `frontend/src/components/forms/TransactionForm.tsx`

## 2026-06-15 — Piggy bank linking via existing PiggyBankContribution; no new FK on Transaction

**Context:** Adding piggy bank selection to the transaction form. Two options: add a `piggy_bank_id` FK column to `transactions`, or reuse the existing `piggy_bank_contributions` join table.

**Decision:** Reuse `piggy_bank_contributions`. Adding a direct FK would duplicate the relationship (the join table already models it), and the join table carries richer metadata (`contribution_type`, `amount`, `date`). A helper `_sync_piggy_bank()` in the router deletes any existing contribution for the transaction and inserts a new one atomically. `piggy_bank_id` is exposed as a virtual field on `TransactionResponse` (queried from the join table) and on `TransactionCreate`/`TransactionPatch`.

**Affects:** `backend/app/routers/transactions.py`, `backend/app/schemas/transaction.py`, `frontend/src/api/transactions.ts`, `frontend/src/components/forms/TransactionForm.tsx`

## 2026-06-15 — Categories: single-select in TransactionForm; Tags: multi-select with inline create

**Context:** User clarified that a transaction should belong to one category (mutually exclusive) but can carry multiple tags (dimensions/labels).

**Decision:** Changed the category field in TransactionForm from multi-select chips to a `<select>` dropdown (single-select). `category_ids` array is preserved on the API for backwards compatibility — the form wraps the single id in `[id]` on submit and unwraps `category_ids[0]` on load. Tags remain multi-select chips. Added an inline "Type & press Enter to create" input in the tags section so new tags can be created on the fly without leaving the form (calls `POST /tags` and immediately selects the new tag).

**Alternatives considered:**
- Keep multi-select chips for categories — harder to enforce single-select UX; a dropdown communicates mutual exclusivity more clearly
- Autocomplete for tags — would hide existing tags; chips let users see all options at a glance while still supporting inline creation

**Affects:** `frontend/src/components/forms/TransactionForm.tsx`

## 2026-06-06 — entrypoint.sh execs the passed command; worker waits on api to serialize migrations

**Context:** `backend/entrypoint.sh` ran `alembic upgrade head` then `exec uvicorn app.main:app --host 0.0.0.0 --port 8765` with the uvicorn command **hardcoded** — it ignored `"$@"`. Since the Dockerfile sets `ENTRYPOINT ["/app/entrypoint.sh"]` and no `CMD`, each service's compose `command:` is passed as args to the entrypoint and was being discarded. Two consequences: (1) the API ignored `--workers 3` (prod) / `--reload` (dev), always running a single non-reloading worker; (2) the **worker** service — same image, same entrypoint — ran uvicorn instead of `python -m arq …`, so background jobs never ran.

**Decision:** Change the last line to `exec "$@"` so the per-service compose command is honored. Keep `alembic upgrade head` in the entrypoint. Because both `api` and `worker` now run the entrypoint (and thus alembic) and they start concurrently, add `depends_on: api: condition: service_healthy` to the worker so the API applies migrations first; the worker's subsequent `alembic upgrade head` then runs against an up-to-date schema and is a no-op. This both prevents two concurrent migration runs from racing and guarantees the worker starts against a ready schema.

**Alternatives considered:**
- Guard migrations with a `RUN_MIGRATIONS` env var so only the API runs them — still requires the worker to wait for the schema (so it still needs `depends_on: api`), and adds branching config; the no-op `alembic upgrade head` is simpler and harmless
- A dedicated one-shot migration service — cleaner separation but more moving parts than this single-user deployment needs
- Postgres advisory lock around alembic — solves the race but not the "worker starts before schema ready" problem; serialization via depends_on covers both

**Affects:** `backend/entrypoint.sh`, `infra/docker-compose.yml` (worker `depends_on`). No code/schema change; NFR-1.1 preserved (same compose file, behavior differs only via the existing per-service `command:`).

## 2026-06-06 — Create Split drawer: "already-linked income" derived client-side from existing splits

**Context:** Task B (Create Split drawer frontend). The Link Transaction panel must hide income transactions already used as settlements (the backend rejects them with 409). For expense parents the `Transaction` response exposes `is_split` / `split_id` (computed via the `SplitExpense` join in `transactions.py` `_fetch_split_id`). But settlement **income** transactions carry **no** such flag — `split_id`/`is_split` are only populated for expense parents, so there was no per-transaction signal to exclude already-linked income.

**Decision:** The drawer derives the used-income set on the client from `useListSplits()` — iterate every split's `shares[].settlements[].transaction_id` into a `Set` and exclude those (plus ids already staged on another card in the same form) from the Link panel. The atomic `POST /splits` 409 check remains the server-side safety net.

**Alternatives considered:**
- Add a backend flag (e.g. `is_settlement`/`settlement_split_id`) to `TransactionResponse` — cleaner per-row signal, but requires a join in the hot transactions list path and a schema change; the splits list is already fetched cheaply and is small for a single user
- Filter income server-side via a new query param — more API surface for a single consumer
- Rely solely on the 409 — violates the spec's requirement to exclude them in the picker, and gives a worse UX

**Affects:** `frontend/src/components/drawers/CreateSplitDrawer.tsx`

## 2026-06-06 — Create Split: settlements + forgiveness folded into POST /splits (atomic), not follow-up calls

**Context:** The new Create Split drawer (spec: `docs/specs/create-split-drawer.md`) lets the user pick expenses, set payee shares, link settlement income transactions, and forgive — all before submitting. The existing API would require the client to call `POST /splits` then N× `settle` then M× `forgive`. That sequence is not atomic: if any call after the first fails, the split is already committed and the expense transactions are linked, so a retry hits 409 and the user is stuck with a half-built split.

**Decision:** Extend `POST /splits` to accept per-share `settlement_transaction_ids` and `forgiven_amount`, processed inside the one transaction that already creates the split + shares + `SplitExpense` rows. Each settlement is credited at the income transaction's **full amount** (no manual partial amounts — a share is resolved solely by which transactions are linked plus forgiveness). Validation enforced before commit: settlement must be income, must not already be linked (409), `Σ(settlements) + forgiven ≤ share.amount` (422), and the null-payee own share may carry neither settlements nor forgiveness. Any `HTTPException` raised before `session.commit()` rolls the whole thing back. The standalone `settle`/`forgive`/`unsettle` endpoints stay unchanged for the SplitDrawer's post-hoc editing.

**Alternatives considered:**
- Client-side 3-call sequence (create → settle → forgive) — rejected: not atomic, broken retry path, leaves orphan splits
- A new dedicated endpoint (e.g. `POST /splits/full`) — unnecessary; the existing create path already builds the split in one transaction, so extending its schema is the smaller change and keeps one creation entry point
- Allow manual per-settlement credit amounts (like the `settle` endpoint does) — rejected per product decision: settlement is whole-transaction-only in this flow; partial money handling is done by adjusting the share or forgiveness

**Affects:** `app/schemas/split.py`, `app/routers/splits.py` (`create_split`), `tests/test_splits.py`. No migration — `split_share_settlements` and `split_shares.forgiven_amount` already exist.

## 2026-06-06 — M2: SQL query endpoint user_id enforcement via AST rewrite

**Context:** The previous `_validate_sql` guard checked that the user's SQL *mentioned* a `user_id` column (string walk), then bound `:user_id` as a parameter. This was bypassable: `WHERE user_id = :user_id OR 1=1` passes the check and, depending on AND/OR precedence, could leak all rows.

**Decision:** Replace the string-scan check with `_inject_user_id_filter()`: parse the user's SQL with sqlglot, then use `stmt.transform()` to visit every `Select` node (including CTEs and subqueries), find direct table references in FROM/JOINs, and inject `table.user_id = :user_id` as an AND condition for each table that carries `user_id`. Existing WHERE is wrapped in `Paren` before ANDing, making OR-bypass impossible. Final SQL is generated with `.sql()` (no dialect) so named params stay `:user_id` for SQLAlchemy's `text()`.

**Alternatives considered:**
- PostgreSQL RLS — proper multi-tenant enforcement at the DB level, but requires a migration adding `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + policies for every table; significant complexity for a single-user app
- Keep string-scan, add documentation — doesn't fix the actual bypass

**Affects:** `routers/reports.py`

## 2026-06-04 — `opening_balance` legitimized as a 4th transaction type (TDD v3.1)

**Context:** The original spec and `CLAUDE.md` stated "three types only: expense, income, transfer." The ad-hoc sprint added `opening_balance` to seed an account's starting balance when it is first created. The implementation was already in place (migration, model enum, router guard, frontend display); the spec just hadn't been updated.

**Decision:** Legitimize `opening_balance` as the 4th transaction type in TDD v3.1 and update `CLAUDE.md`. Constraints remain: (1) at most one non-deleted `opening_balance` per account (enforced at application level in the accounts router), (2) excluded from all income/expense/net reports, (3) `split_parent` is still not a type — splits remain a separate entity.

**Affects:** `docs/TDD.md` (v3.1), `docs/CLAUDE.md`

## 2026-06-03 — C2: dashboard net-expense uses SQL view; settlement income excluded at query time

**Context:** FR-7.9 / FR-7.10 require the dashboard to show net split amounts (own share + forgiven) not gross, and to exclude friend repayments from income. Three implementation paths considered.

**Decision:** (1) Fix the `transaction_with_net_amount` SQL view (migration 0027) to also sum `forgiven_amount` for partially-forgiven shares — the Python service already did this correctly, the view was inconsistent. (2) `_monthly_totals` now selects `SUM(net_amount)` from the view for expenses; for income, a `NOT IN (SELECT transaction_id FROM split_share_settlements)` subquery excludes settlement transactions. (3) `_category_breakdown` joins against the view instead of `transactions` directly. (4) New `_pending_splits_from_others_total` is a raw-SQL correlated subquery (amount − forgiven − settled) scoped to the dashboard period, exposed as `pending_splits_from_others` on `DashboardResponse`.

**Alternatives considered:**
- Python-level post-processing (call `net_expense()` per transaction in a loop) — O(N) DB round-trips; rejected
- Define the view as a full SQLAlchemy ORM mapped class — heavier setup for a read-only view used in one place; `sa.table()` lightweight reference is sufficient
- Recalculate pending in `_pending_splits_summary` (already exists) — that helper is global (all time), not period-scoped; a separate helper is cleaner

**Affects:** `alembic/versions/0027_fix_net_amount_view_partial_forgiveness.py`, `routers/dashboard.py`, `schemas/dashboard.py`, `tests/test_dashboard_net_expense.py`

## 2026-06-02 — Split multi-expense: split_expenses join table replaces single FK

**Context:** Original `splits.expense_transaction_id` was a single FK, allowing only one expense transaction per split. User required multiple expense transactions per split (e.g. bundling dinner + drinks into one split). Payee uniqueness rule also needed enforcement: at most one share per payee (including the user's own null-payee share).

**Decision:** (1) New `split_expenses` join table with UNIQUE constraint on `transaction_id` (one expense can belong to at most one split). (2) `splits.expense_transaction_id` column dropped; `SplitExpense` model added. (3) DB trigger `trg_split_invariant` updated to sum via `split_expenses` JOIN. (4) Partial unique index on `split_shares(split_id, payee_id) WHERE payee_id IS NOT NULL` for non-null payee uniqueness; null-payee uniqueness (user's own share) enforced at application level in `create_split` only (bundle is exempt — it creates null-payee shares for anonymous income legs). (5) Bundle flow groups income transactions by `payee_id` → one share per payee with multiple settlements. (6) All API responses changed from `expense_transaction_id: UUID` to `expense_transaction_ids: list[UUID]`.

**Alternatives considered:**
- Keep single FK, limit to one expense per split — too restrictive for real-world use (e.g. dinner + drinks at same outing)
- Allow multiple expenses via array column (PostgreSQL `UUID[]`) — join table is more relational, easier to add indexes/FKs/cascade rules
- Enforce null-payee uniqueness at DB level via expression index on `(split_id) WHERE payee_id IS NULL` — not supported in PostgreSQL (can't have a unique index that allows at most one NULL per group); app-level check is correct

**Affects:** `alembic/versions/0026_split_multi_expense_payee_uniqueness.py`, `models/split.py`, `schemas/split.py`, `routers/splits.py`, `routers/transactions.py`, `services/split_service.py`, `dev_seed.py`, all 4 split test files, `frontend/src/api/splits.ts`, `BundleAsSplitModal.tsx`, `Transactions.tsx`, `SplitDrawer.tsx`, `SplitDetail.tsx`, `TransactionForm.tsx`, `handlers.ts`

## 2026-05-31 — Use shared get_session in imports/gpay routers; register gpay before imports

**Context:** `test_imports.py` and `test_gpay_matcher.py` all failed with FK violations or InterfaceErrors. Root cause: `imports.py` and `gpay.py` each did `from app.db.session import async_session_factory` at module level and defined their own `get_session`. The test fixture patches `_db_session.async_session_factory`, but the module-level binding in these routers was already fixed to the production factory — the patch never took effect.

**Decision:** (1) Both routers now use `from app.db.session import get_session` directly. `get_session` in `app.db.session` accesses `async_session_factory` from the module's globals at call time, so patching the module attribute works. (2) `gpay_router` registered before `imports_router` in `main.py` so static paths (`/gpay-matches`) aren't shadowed by `/{batch_id: uuid.UUID}`.

**Affects:** `app/routers/imports.py`, `app/routers/gpay.py`, `app/main.py`

## 2026-05-27 — Split settlement redesigned to multi-payment join table + partial forgiveness

**Context:** The original settlement model used a single `settlement_transaction_id` FK on `split_shares`, meaning only one income transaction could settle a payee's share. The user wanted: (1) multiple income transactions adding up to settle one share, (2) partial forgiveness (absorb only part of the unpaid remainder), (3) payee tracking kept on shares for traceability.

**Decision:** Replaced the single FK with a `split_share_settlements` join table (`share_id`, `transaction_id`, `amount`, `created_at`) — UNIQUE on `(share_id, transaction_id)`. Each income transaction remains 1:1 with one share (no cross-share splitting), but the same share can accumulate many payment rows. Added `forgiven_amount NUMERIC(15,2) DEFAULT 0` to `split_shares`; removed `settlement_transaction_id`, `settled_at`, `forgiven_at`. Status is derived at write time: `paid + forgiven >= amount` → settled (if `paid > 0`) or forgiven (if `paid == 0`); otherwise pending. `POST /forgive { amount }` is a SET operation (replaces prior value, not incremental). `POST /unsettle` is a nuclear reset: deletes all settlements + zeros forgiven_amount.

**Alternatives considered:**
- Keep single FK, require exact match — doesn't allow partial payments or multi-payment flows
- Make `forgiven_amount` incremental (add on each call) — SET is simpler and avoids drift; caller can always calculate the new total
- Allow one income transaction to settle parts of multiple shares — useful edge case but adds complexity; deferred

**Affects:** `0024_split_settlements.py`, `models/split.py`, `schemas/split.py`, `routers/splits.py`, `dev_seed.py`, `test_splits_settle.py`, `test_splits_bundle.py`, `test_splits.py`

## 2026-05-26 — Budget transaction linking: period bucket derived from transaction date, not stored

**Context:** When a user links a transaction to a budget, the system needs to show only the spending for the selected global period (e.g. May 2026), not the entire budget lifetime (Jan–May). The question was whether to store a "period key" in the `transaction_budgets` join table or derive it at query time.

**Decision:** No new column needed in `transaction_budgets`. The period bucket is derived at query time by filtering `transacted_at` against the period window (`from`/`to` params passed from the global period context). Three coordinated fixes: (1) `list_budget_transactions` now defaults to `_current_period_window(b)` instead of `b.start_date/b.end_date`; (2) `BudgetDrawer` and `BudgetDetail` both pass global period dates to the transactions query; (3) `TransactionForm` now has a budget picker (expense-only chip toggle) that sends `budget_ids` in the create/patch payload. `TransactionResponse` extended with `budget_ids` so pre-population works on edit.

**Alternatives considered:**
- Store a `period_key` (e.g. "2026-05") in `transaction_budgets` — adds complexity and would need migration; date filtering achieves the same result without new schema
- Period filtering only on the backend default — risk of stale frontend; better to have both the frontend pass explicit params AND the backend default to current period

**Affects:** `backend/app/routers/budgets.py` (`list_budget_transactions`), `backend/app/schemas/transaction.py` (`TransactionResponse.budget_ids`), `backend/app/routers/transactions.py` (`_fetch_budget_ids`, `_to_response`), `frontend/src/components/drawers/BudgetDrawer.tsx`, `frontend/src/pages/BudgetDetail.tsx`, `frontend/src/components/forms/TransactionForm.tsx`, `frontend/src/api/transactions.ts`, `frontend/src/test/handlers.ts`

## 2026-05-26 — Budget period filter uses activated_at + rrule.before/after for current-period detection

**Context:** Budgets need a time-period filter (e.g. "last month") to show which budgets were active then and what was spent during that period. Needed both a field to record activation time and robust current-period detection for recurring budgets.

**Decision:** Added `activated_at TIMESTAMPTZ` column (migration 0022). `list_budgets` now accepts `from_date`/`to_date` and filters by `activated_at <= to_date AND end_date >= from_date`. `_current_period_window` was rewritten from `expand_budget(b, today, today)` to `rrulestr.before(today)` + `rrulestr.after(today)` — the expand approach returned empty if today was not an exact occurrence date (e.g. mid-month). `_compute_current_spent` accepts explicit period params; period-filtered views pass them directly, bypassing the recurrence-window logic.

**Custom interval:** Stored as `FREQ=DAILY;INTERVAL=X` in the existing `recurrence_rule` column — no new field needed; dateutil already handles it.

**Affects:** `backend/alembic/versions/0022_budget_activated_at.py`, `models/budget.py`, `schemas/budget.py`, `routers/budgets.py`, `dev_seed.py`, `frontend/src/api/budgets.ts`, `frontend/src/pages/Budgets.tsx`, `frontend/src/test/handlers.ts`

## 2026-05-26 — Budget current_spent uses per-budget current-period window via expand_budget

**Context:** `_batch_spent` was using the budget's overall `start_date`/`end_date` to filter transactions, so a recurring monthly budget accumulated all spending since its creation instead of just the current month.

**Decision:** Replaced `_batch_spent` with `_compute_current_spent` (per-budget) + `_current_period_window`. For recurring budgets, `expand_budget(b, today, today)` finds today's occurrence and returns its `start_date`/`end_date` as the window. For ad-hoc budgets, `start_date`/`end_date` are used unchanged. `_batch_spent` now just iterates and calls `_compute_current_spent` per budget.

**Alternatives considered:**
- Add `activated_at` column to track when a budget period starts (user's suggestion) — expand_budget already has the recurrence logic, no new DB column needed
- Keep the batched JOIN query but pass per-budget windows via CASE/VALUES — overly complex for a list that's typically <50 rows

**Affects:** `backend/app/routers/budgets.py`

## 2026-05-25 — Progress ring mount animation uses requestAnimationFrame + CSS transition

**Context:** Four separate `ProgressRing` components needed to animate from 0% to the real value on initial render. Pure CSS transitions don't fire on mount because the element is painted with the final value immediately.

**Decision:** `useState(circumference)` (fully offset = 0%) as initial state, then a `useEffect` with a single `requestAnimationFrame` to set the real offset. The browser paints the 0% frame, rAF fires after the paint, React state update triggers the CSS `stroke-dashoffset` transition. One `transition` style on the arc circle handles both mount animation and subsequent value changes.

**Alternatives considered:**
- CSS `@keyframes` animation — can't be driven by a runtime value; would need `animation-delay` hack
- Framer Motion / react-spring — brings a dependency for one simple effect
- Double-rAF pattern — sometimes needed for DOM mutations but single rAF is sufficient for React state updates after mount

**Affects:** `PiggyBankProgressRing.tsx`, `PiggyBankDrawer.tsx` (local `ProgressRing`), `PiggyBankDetail.tsx`, `PiggyBanks.tsx`.

## 2026-05-25 — Cash flow buckets embedded in /dashboard/home response, not a separate endpoint

**Context:** Dashboard needs time-series income vs expense data to render the cash flow chart. Two approaches: add it to the existing dashboard payload, or create a separate `/dashboard/cashflow` endpoint.

**Decision:** Added `cashflow_buckets: list[CashFlowBucket]` directly to `DashboardResponse`. Avoids a second network round-trip; the dashboard already fetches everything the page needs in one call. The bucket query is a single `GROUP BY (type, date_trunc(...))` on the same transaction table already being queried.

**Alternatives considered:**
- Separate endpoint — cleaner API surface, independently cacheable, but costs an extra fetch and complicates the frontend data flow
- Client-side aggregation from transaction list — unbounded result set, not paginated, would require fetching all transactions for the period

**Affects:** `backend/app/schemas/dashboard.py` (`CashFlowBucket`, `DashboardResponse`), `backend/app/routers/dashboard.py` (`_cashflow_buckets`), `frontend/src/api/dashboard.ts`, `frontend/src/components/dashboard/CashFlowChart.tsx`.

## 2026-05-25 — Budget detail transaction drawer uses a local adapter instead of re-fetching

**Context:** `BudgetDetail` shows `BudgetTransactionItem` rows. Clicking a row should open `TransactionDrawer`, which expects a full `Transaction` object. `BudgetTransactionItem` is a subset — it's missing `tag_ids`, `notes`, `to_account_id`, `subscription_id`, etc.

**Decision:** `toTransaction()` adapter fills in missing fields with safe defaults (`tag_ids: []`, `notes: null`, etc.) and casts to `Transaction`. The drawer gracefully skips sections with empty/null values, so the user sees all available data (account, payee, categories, amount, date) without an extra API call per click.

**Alternatives considered:**
- Fetch `GET /transactions/{id}` on click — shows complete data (tags, notes) but adds latency and a loading state inside the drawer; tags/notes are rarely present on budget-linked transactions anyway
- Extend the budget transactions endpoint to return full `Transaction` objects — over-fetches data the list view doesn't need

**Affects:** `frontend/src/pages/BudgetDetail.tsx`.

## 2026-05-25 — Cash flow bucket granularity auto-selected by period duration

**Context:** The cash flow chart needs to choose between daily, weekly, and monthly bars. Fixed granularity per period type (e.g. "month always → daily") doesn't work for custom periods of arbitrary length.

**Decision:** Duration-based threshold: ≤31 days → `date_trunc('day')`, ≤91 days → `date_trunc('week')`, >91 days → `date_trunc('month')`. This keeps the chart readable (≤31 bars) regardless of which period is selected.

**Affects:** `backend/app/routers/dashboard.py` (`_cashflow_buckets`).

## 2026-05-25 — Dev mode auth bypass uses HTTPBearer(auto_error=False) with fallback user

**Context:** User runs DEV_MODE=true on the production server to test features without a local Docker setup. The `get_current_user` dependency previously required a valid Bearer token unconditionally.

**Decision:** Changed `_bearer = HTTPBearer(auto_error=False)` and made `credentials` optional. When `dev_mode=True` and no token is present, the dependency looks up the dev seed user by its fixed UUID and returns it directly. If the dev user doesn't exist in the DB, it falls through to the standard 401 path.

**Alternatives considered:**
- A separate `DevAuthMiddleware` that injects a fake token — more complex, touches the request pipeline
- A distinct `get_current_user_dev` dependency that routes would use in dev mode — requires changing every router, error-prone



## 2026-05-25 — Generic table parser replaces HDFC-specific parser

**Context:** The original `HDFCParser` was hardcoded to HDFC's column layout. Real bank PDFs vary: some have separate withdrawal/deposit columns, others use Dr/Cr suffixes, others have no column headers at all.

**Decision:** Dropped `HDFCParser` entirely and replaced it with `GenericTableParser` in `backend/app/parsers/banks/generic.py`. It detects layout from column headers using flexible substring matching, then handles three layouts: dual-column (separate debit/credit), single-column with Dr/Cr suffix, and headerless (structure inferred from row data). The parser registry now points to `GenericTableParser` for all inputs.

**Alternatives considered:**
- Keep HDFC parser + add per-bank subclasses — grows linearly with bank count; most banks are minor variants of the same three layouts
- Config-driven column mappings — overfits to known banks, still fails on unknown ones

**Affects:** `backend/app/parsers/banks/generic.py` (new), `backend/app/parsers/banks/hdfc.py` (deleted), `backend/app/parsers/registry.py`, `backend/tests/test_parser.py` (replaced `test_hdfc_parser.py`).

## 2026-05-25 — budget `_batch_spent` uses two date-windowed batched queries instead of one GROUP BY

**Context:** The original `_batch_spent` helper only counted explicit `transaction_budgets` links with no date filter. The drawer's `list_budget_transactions` also counts category-matched transactions and respects `budget.start_date / end_date`. This caused the list page to show a different (lower) spend figure than the drawer.

**Decision:** Rewrote `_batch_spent` to run two batched queries — (1) explicit links via `transaction_budgets`, (2) category matches via `transaction_categories` — both date-windowed by joining `Budget` and filtering on `start_date / end_date`. Results are summed per budget_id. This matches the drawer logic exactly.

**Alternatives considered:**
- Single query with UNION — harder to read, mixing join paths in one query is fragile
- Reuse `list_budget_transactions` endpoint logic — that runs per-budget; batching requires a different approach

**Affects:** `backend/app/routers/budgets.py` (`_batch_spent`).

## 2026-05-23 — Dev seed lives in app/dev_seed.py, called from lifespan

**Context:** Dev mode needed realistic fixture data spanning all domain entities
(accounts, transactions, budgets, subscriptions, piggy banks) to support UI
development without manually creating data each time.

**Decision:** Created `backend/app/dev_seed.py` as a standalone idempotent seed
module. It uses fixed UUIDs and a check-before-insert pattern so it's safe to
call on every startup. Called from the existing `_seed_dev_user()` lifespan hook
in `main.py`, lazy-imported to avoid import cost in production.

**Alternatives considered:**
- Alembic data migration — couples dev fixtures to the migration chain; hard to
  evolve as features are added
- CLI script (e.g. `uv run python seed.py`) — requires manual step; easy to forget
- pytest fixtures only — test fixtures use in-memory SQLite; dev seed needs
  real Postgres with the full schema, different use case

**Affects:** `backend/app/dev_seed.py` (new), `backend/app/main.py` (call site),
`docs/CLAUDE.md` (update-when rules for future Claude sessions).

## 2026-05-23 — Split invariant DB trigger uses DEFERRABLE INITIALLY DEFERRED

**Context:** The invariant trigger on split_shares (SUM(shares) == parent transaction amount) fires AFTER INSERT/UPDATE/DELETE on each row. If it fires immediately after each row, inserting multiple shares within a single transaction would fail after the first insert (partial sum < total).

**Decision:** Used a PostgreSQL CONSTRAINT TRIGGER with DEFERRABLE INITIALLY DEFERRED. This defers the invariant check to commit time, so all shares can be inserted within one transaction before the constraint is evaluated.

**Alternatives considered:**
- AFTER STATEMENT trigger — PostgreSQL constraint triggers can only be FOR EACH ROW, not FOR EACH STATEMENT, so this isn't available
- Immediate trigger with "allow partial" logic (e.g. only fire when sum > expected) — fragile and makes delete-to-break harder to enforce
- Application-only enforcement (no DB trigger) — violates the TDD requirement for dual-layer enforcement

**Affects:** `0009_splits.py` (trigger SQL), `test_splits_schema.py` (custom fixture creates the trigger for schema tests, since db_tables uses Base.metadata.create_all which doesn't install triggers).
The format: date, title, context, decision, alternatives, what it affects.

## 2026-05-23 — Setup prerequisites live in docs/SETUP.md, not docs/running.md

**Context:** `docs/running.md` already covers how to run the stack (options 1–3), but had no coherent "what do I install on this machine first" section per deployment target. The README linked nowhere useful.

**Decision:** Created `docs/SETUP.md` as the dedicated "start here" file covering OS-level prerequisites (Git, Docker, Python, Bun) for three scenarios: Local PC, Pi 5, Cloud VPS. `docs/running.md` retains the run instructions and gets a one-line cross-reference. README updated to link SETUP.md prominently.

**Alternatives considered:**
- Extend the existing Prerequisites table in `running.md` — that file is already long; mixing "install Docker" with "run migrations" in one document was the root of the confusion
- One file per scenario — unnecessary fragmentation; a single SETUP.md with H2 sections per scenario is scannable

**Affects:** `docs/SETUP.md` (new), `README.md`, `docs/running.md` (cross-ref only), `docs/todo.md` (backlog items added).

## 2026-05-23 — transaction_budgets join table created without budget_id FK

**Context:** Task 3.1 requires a transaction_budgets join table, but the budgets table doesn't exist until M5.

**Decision:** Created transaction_budgets now with transaction_id FK → transactions, and budget_id as a plain UUID column (no FK). The FK to budgets will be added in the M5 migration when the budgets table exists.

**Alternatives considered:**
- Skip transaction_budgets until M5 — would mean PATCH /transactions accepting budget_ids couldn't be added in M3
- Use a deferred FK — not supported cleanly in SQLAlchemy / Postgres without separate ALTER TABLE

**Affects:** `0008_transactions.py`, `transaction.py`, `transactions.py` router (budget_ids accepted in create/patch).

## 2026-05-23 — Payee response extended with default_category_ids

**Context:** TransactionForm (Task 3.3) needs to auto-populate categories when a payee is selected. The payee_default_categories join table exists (from M2.5) but wasn't exposed in the API.

**Decision:** Added `default_category_ids: list[uuid.UUID]` to PayeeResponse. All payee router endpoints now query the join table and include the field. The Table reference (payee_default_categories) was added to category.py to enable this query.

**Alternatives considered:**
- Separate GET /payees/{id}/categories endpoint — extra round trip, more complex frontend
- Skip auto-populate in M3 — doesn't meet prompt_plan spec

**Affects:** `app/models/category.py`, `app/schemas/payee.py`, `app/routers/payees.py`, `frontend/src/api/payees.ts`.

## 2026-05-23 — Dev mode toggled via DEV_MODE env var (plain env, not YAML config)

**Context:** An earlier plan called for a `.dev-config.yml` file + `infra/load-dev-config.py` loader to toggle dev mode. The `.dev-config.yml` file was never shipped; only `load-dev-config.py` exists. In practice dev mode is controlled directly by the `DEV_MODE=true` env var (read via pydantic-settings in `app/config.py`).

**Decision:** Keep plain env var (`DEV_MODE`) as the sole toggle. The `load-dev-config.py` script remains as a convenience helper but is not required. No `.dev-config.yml` file exists or is needed.

**Affects:** `backend/app/config.py` (`dev_mode: bool = False`), `infra/load-dev-config.py` (optional helper), `infra/env.example`. The `DEV_MODE_BACKEND / DEV_MODE_FRONTEND / DEV_MODE_INFRA` split was planned but never implemented.
## 2026-05-24 — Production docker-compose split into base + dev override

**Context:** The development compose needed code volume mounts and `--reload` for hot iteration, while production needs multi-worker uvicorn and no mounts. Both use the same `docker-compose.yml` filename (per NFR-1.1 "same file for home server + VPS").

**Decision:** Made `docker-compose.yml` the production baseline (no mounts, `--workers 3`, resource limits). Created `docker-compose.override.yml` for dev which Docker Compose applies automatically when present. Production servers don't have the override file. Added `make prod-up` for running production mode locally.

**Alternatives considered:**
- Build-arg or `COMPOSE_FILE` env var to switch profiles — less discoverable
- Separate `docker-compose.dev.yml` requiring explicit `-f` flag — would break existing `make up`

**Affects:** `infra/docker-compose.yml`, `infra/docker-compose.override.yml` (new), `infra/Makefile`, `docs/running.md`.

## 2026-05-23 — Export and import-archive share one router file; ExportJob stored in DB (not Redis)

**Context:** Tasks 12.1 (export) and 12.2 (import-archive) both need /export and /import-archive endpoints. Job status needs persistence across the ARQ worker and the API process.

**Decision:** Put both endpoints in `app/routers/export.py`. Used a DB-backed `ExportJob` model for status (pending/running/done/failed) rather than Redis keys, so job history is durable and queryable. Import-archive runs synchronously inside the API handler (no separate ARQ job) since the operation is bounded by archive size and a single-user transaction.

**Alternatives considered:**
- Redis-only status store — lost on restart; requires Redis to be running in tests
- Separate router files — needless fragmentation for two small endpoint groups
- ARQ job for import — adds queue latency with no benefit; the atomic DB transaction blocks anyway

**Affects:** `app/models/export_job.py`, `app/routers/export.py`, `0019_export_jobs.py`.
