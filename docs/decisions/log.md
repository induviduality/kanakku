# Decision Log

## 2026-07-08 — Credit cards: dropped `credit_card` from `PaymentMethodType`, kept only as an `AccountType`

**Context:** Credit cards were modeled two ways at once: `AccountType.credit_card` (a dedicated liability account, e.g. dev seed's "HDFC Credit Card") *and* `PaymentMethodType.credit_card` (a payment method nested under that same account, e.g. dev seed's "HDFC Credit ••9876"). The nested payment method was pure redundancy — the account already represents the card.

**Decision:** Removed `credit_card` from `PaymentMethodType` (now `debit_card` / `netbanking` / `upi` only). Migration `0029` drops the enum value: any `payment_methods` rows of that type are deleted (their transactions' `payment_method_id` nulled first), then the Postgres enum is recreated without the value. Frontend: `TransactionForm`'s payment-method selector already hides itself when `pmOptions` is empty, so no code change was needed there; `Accounts.tsx` and `AccountDrawer.tsx` now hide the "Payment methods" panel/toggle entirely for `credit_card`-type accounts, and the "Add payment method" type dropdown no longer offers `credit_card`. Also excluded `credit_card` accounts from the dashboard's per-account cash-flow chart (`_cashflow_by_account` in `dashboard.py`) — a card's outstanding balance is a fluctuating liability, not liquid cash flow — while leaving them in `account_balances` / net worth, where they still belong.

**Alternatives considered:**
- Keep `credit_card` as a payment-method type for "swiped in person" vs "online" distinction — rejected by the user; simpler to have no payment method at all under a credit-card account.

**Affects:** `backend/app/models/payment_method.py`, `backend/alembic/versions/0029_remove_credit_card_payment_method_type.py`, `backend/app/routers/dashboard.py`, `backend/app/routers/reports.py`, `backend/app/dev_seed.py`, `frontend/src/api/accounts.ts`, `frontend/src/pages/Accounts.tsx`, `frontend/src/components/drawers/AccountDrawer.tsx`.

## 2026-06-21 — Edit Split: Atomic PUT endpoint for safe updates

**Context:** The backend lacked an endpoint to edit a split and its shares in one go. Patching shares individually (via PATCH) is impossible when changing amounts because the total sum of shares must always equal the total expense; intermediate PATCH requests would violate this invariant.

**Decision:** Created a `PUT /splits/{split_id}` endpoint that accepts a `SplitCreate` payload. It atomically validates the new payload, deletes old split child rows (expenses, settlements, shares), inserts new ones, validates the invariant, and commits within a single database transaction. 

**Affects:** `backend/app/routers/splits.py`, `frontend/src/api/splits.ts`

## 2026-06-21 — Edit Split: Extracted SplitForm component

**Context:** The form logic for split creation was inside `CreateSplitDrawer.tsx` (as `CreateSplitForm`). To support editing without duplicating state management and rendering code, we needed to share this form.

**Decision:** Extracted the form to `SplitForm.tsx` as a reusable component. It accepts an optional `initialSplit` prop, switches query mutations between Create and Update, and excludes already split expenses/settlements from other splits while preserving the current split's own selection.

**Affects:** `frontend/src/components/SplitForm.tsx`, `frontend/src/components/drawers/CreateSplitDrawer.tsx`, `frontend/src/components/drawers/SplitDrawer.tsx`

## 2026-06-21 — Splits Bug Fixes: net expense calculation uses own share + payee forgiven amounts (BUG-1)

**Context:** BUG-1 noted that the net expense calculation was summing all shares' forgiven amounts, which is incorrect.

**Decision:** Net expense calculation updated to `own_share + forgiven_amounts_on_payee_shares` per FR-7.9.

**Affects:** `frontend/src/components/drawers/SplitDrawer.tsx`

## 2026-06-21 — Splits Bug Fixes: decimal values display convention (BUG-8)

**Context:** The user wanted to see decimals only if there is a paisa (non-zero decimal) value.

**Decision:** Formatter (`fmt` in `SplitDrawer.tsx` and `inr` in `CreateSplitDrawer.tsx`) set to `minimumFractionDigits: 0` and `maximumFractionDigits: 2`.

**Affects:** `frontend/src/components/drawers/SplitDrawer.tsx`, `frontend/src/components/drawers/CreateSplitDrawer.tsx`

## 2026-06-21 — Splits Bug Fixes: Settle/Forgive form validation and error handling (BUG-3)

**Context:** Settle/Forgive actions could fail silently or crash the frontend on backend error.

**Decision:** Added client-side validations to disable Confirm/Set buttons when invalid values are typed, and added try/catch blocks with inline error displays.

**Affects:** `frontend/src/components/drawers/SplitDrawer.tsx`

## 2026-06-21 — Splits revamp: balance indicator uses amber (bg-warning) for under-allocated, not red

**Context:** The design spec (2026-06-21-splits-revamp-design.md) says the balance progress bar in `CreateSplitDrawer` should be "red when over or under" the total. The implementation plan code uses `bg-warning` (amber) when under-allocated and `bg-negative` (red) only when over-allocated.

**Decision:** Keep amber for under-allocated. Showing red when the user hasn't filled all shares yet is misleading — it implies an error state before the user has had a chance to enter amounts. Amber correctly communicates "in progress" while red communicates "you've gone too far." The spec's "red for both" was likely a copy simplification.

**Affects:** `frontend/src/components/drawers/CreateSplitDrawer.tsx`

## 2026-06-21 — Splits revamp: SplitDrawer action row uses · separators (spec vs gap-only in original plan)

**Context:** The design spec shows action links as `Record payment · Forgive · Edit · Reset` with `·` separators. The original implementation plan code used only `gap-x-3` spacing. During execution the spec was treated as authoritative for visual design details.

**Decision:** Added literal `·` `<span aria-hidden>` elements between action links to match the spec. The separators are hidden from screen readers via `aria-hidden` so assistive technologies only read the buttons.

**Affects:** `frontend/src/components/drawers/SplitDrawer.tsx`

## 2026-06-21 — Splits revamp: SplitDrawer fallback title is "Split expense" not "Split detail"

**Context:** The implementation plan code had `title={split?.notes ?? 'Split detail'}` but the design spec explicitly says fallback should be `"Split expense"`.

**Decision:** Applied spec. "Split expense" is clearer to users than "Split detail" as it describes what the drawer is showing.

**Affects:** `frontend/src/components/drawers/SplitDrawer.tsx`

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

## 2026-07-11 — Split form resolves transactions per-id; TransactionPicker primes the query cache

**Context:** The Create/Edit Split drawer computed totals and labels from its own 90-day / 200-item transaction pools. The TransactionPicker searches up to a year (tier 2) or all time (tier 3), so a transaction picked from search results outside the pool window resolved to nothing: total showed ₹0, "Use remainder" filled 0, and linked settlements rendered as a raw UUID slice with +₹0.

**Decision:** SplitForm now resolves every referenced transaction (selected expenses + all linked settlements) individually via `useQueries` on `['transaction', id]` — no date-window pool at all. TransactionPicker calls `queryClient.setQueryData(['transaction', id], txn)` on select, so the just-picked row is served from cache instantly (no extra fetch, works for every picker consumer). Edit-mode pre-selected ids are covered by the same queries.

**Alternatives considered:**
- Passing the full Transaction object up through onChange — changes the picker's public API and still leaves edit-mode initial ids unresolved.
- Widening the pool window to all-time — unbounded fetch, still capped by page size.

**Affects:** `frontend/src/components/SplitForm.tsx`, `frontend/src/components/TransactionPicker.tsx`.

## 2026-07-11 (2) — Amount-owed auto-fill reads settlement amounts from the query cache, not the local txnMap

**Context:** Follow-up to the same-day split-drawer fix. Linking a payment via "+ Link payments" should auto-fill the payee's "Amount owed" field (previously it stayed at whatever was typed/blank, forcing users to manually copy the linked payment's amount). The naive fix — sum `txnMap[id]?.amount` for the newly linked ids inside the `settlementIds` state update — read stale data: `txnMap` is built from `useQueries` keyed off `shares` from the *previous* render, so the just-picked transaction's amount isn't in it yet on the render where `onChange` fires.

**Decision:** `updateSettlements` reads each newly-linked id via `queryClient.getQueryData(['transaction', id])` (falling back to `txnMap` for ids already resolved) instead of `txnMap` alone. TransactionPicker's `handleSelect` already primes that cache entry synchronously before calling `onChange`, so the freshly-picked amount is available immediately. Auto-fill only applies while the amount field is untouched (`PayeeShare.touched`); a manual edit turns off the sync so linking further payments won't clobber a user-entered value.

**Alternatives considered:**
- Passing the full `Transaction` object through `TransactionPicker`'s `onChange` — bigger API change across all picker consumers for one caller's need.
- `useEffect` reacting to `settlementIds` changes and recomputing from `txnMap` — same staleness problem, just deferred one render; still lags behind the synchronous cache write.

**Affects:** `frontend/src/components/SplitForm.tsx`.

## 2026-07-11 (3) — Split form UI: standalone Done button, and "I'm not part of this split" checkbox

**Context:** User feedback on the same-day revamp: (1) the expense picker's toggle button relabeled itself between "Add expense" and "Done adding" in the same slot, which read as one ambiguous control; (2) no way to exclude yourself entirely from a split (e.g. you're just facilitating a payment between two other people) without leaving "Your share" at a confusing 0.

**Decision:** Split the toggle into two controls — "+ Add expense" only shows when the picker is closed; once open, a "Select expenses" header row with a right-aligned "Done" button (same pattern as the existing "Link settlement" panel) closes it. Added an `excludeMe` checkbox next to the "Your share" label; when checked, the amount input is hidden entirely and `myShareNum` is forced to 0 regardless of any previously typed value (which is preserved in state and restored if unchecked). Edit mode defaults the checkbox to checked when the loaded split has no `payee_id: null` share.

**Affects:** `frontend/src/components/SplitForm.tsx`.

## 2026-07-11 (4) — Transaction edit: local-time datetime-local handling + per-id cache invalidation

**Context:** Investigating a report of "opening_balance duplicate" error led to discovering the account/transaction referenced didn't exist in the DB at all (stale frontend reference, not a backend bug — no code change needed there). The user's real complaint was that editing a transaction's date "doesn't cascade" — most noticeable on opening_balance transactions since those get corrected after the fact.

**Decision:** Two independent bugs, both in the transaction edit path:
1. `TransactionForm.tsx` built the `<input type="datetime-local">` value via `initial.transacted_at.slice(0, 16)` on the raw UTC ISO string, and formatted new transactions via `new Date().toISOString().slice(0, 16)`. `datetime-local` has no timezone — it displays the string as literal wall-clock. For any user not in UTC, this both displayed the wrong time and, on submit (even with the field untouched), silently shifted the stored instant by the browser's UTC offset. Fixed with a `toDatetimeLocalValue(date: Date)` helper that reads local Date components (`getFullYear`/`getHours`/etc.) instead of slicing an ISO string.
2. `usePatchTransaction`/`useDeleteTransaction` in `api/transactions.ts` invalidated `['transactions']` (plural list) but never `['transaction', id]` (singular detail key) — a *different* noun, so React Query's prefix-based invalidation never touched it. `SplitForm.tsx`, `SplitDrawer.tsx`, `SplitDetail.tsx`, and the transaction edit page (`useTransaction`) all read that singular key directly, so they kept serving the pre-edit snapshot for up to the 5-minute `staleTime`. Fixed by also invalidating `['transaction', id]` in both mutations' `onSuccess`.

An Explore-agent audit of the rest of `frontend/src/api/` confirmed this mismatched-noun pattern is unique to transactions — every other file's singular detail key shares the plural key's prefix (e.g. `['budgets', id]` vs `['budgets']`), so cascading invalidation already worked there.

**Affects:** `frontend/src/components/forms/TransactionForm.tsx`, `frontend/src/api/transactions.ts`.

## 2026-07-11 (5) — Dashboard account balances scoped to period end; fixed a pervasive transfer-in bug found along the way

**Context:** User wanted the "Account Balances" dashboard section to show each account's balance as of the end of the selected period (or "now" for the current, still-open period), not the account's live current_balance — so picking "January" shows Jan 31 balances even if the account has since moved.

**Decision:** Added `_balance_delta_since(session, user_id, acc_ids, since)` in `routers/dashboard.py`: sums the net income/expense/transfer effect of every transaction dated on/after `since`, excluding `opening_balance` (it's a permanent one-time seed baked into `current_balance`, never period-scoped — matches FR-9). `_account_balances` now computes `current_balance - delta_since(period_end)` per account, giving exactly the balance as of the period boundary; a period_end in the future (current month) naturally reduces to the live balance since nothing is dated beyond it. Refactored `_cashflow_by_account`'s existing (near-identical, duplicated) "opening balance at period_start" calculation to reuse this same helper instead of re-deriving it inline.

Renamed `AccountBalanceItem.current_balance` → `.balance` (schema + frontend type + `Dashboard.tsx` + MSW fixture) since the field no longer means "live balance" — keeping the old name would have been actively misleading. `total_balance` in the dashboard summary now sums the same period-scoped `.balance`, so the hero "Balance" stat card is consistent with the Account Balances section below it (previously it summed the live balance while everything else on the page was period-scoped). Dashboard.tsx also gained an "Account Balances — as of {date}" label (min(period_end, today), showing "today" when the period is still open) so the scoping isn't silently invisible to the user.

**Bug found while writing this:** Auditing the existing "opening balance" query (which I was refactoring into the shared helper) turned up that `SUM(Transaction.to_amount)` for transfer-in credit silently drops every same-currency transfer, because `to_amount` is only populated for cross-currency transfers — the frontend `TransactionForm` never sends it otherwise, so it's `NULL` for essentially all real-world transfers. The live-balance code path (`_apply_transfer_balances`) already handles this correctly via `(txn.to_amount or txn.amount)`, but the dashboard's aggregate SQL queries didn't. Since this feeds the cashflow chart's *running* balance, one dropped transfer-in permanently offsets every subsequent bucket for that account — this is very likely what the user meant by "the cash flow chart looks completely wrong." Fixed both occurrences (the new shared helper, and `_cashflow_by_account`'s per-bucket transfer-in query) with `sa.func.coalesce(Transaction.to_amount, Transaction.amount)`.

**Affects:** `backend/app/routers/dashboard.py`, `backend/app/schemas/dashboard.py`, `frontend/src/api/dashboard.ts`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/test/handlers.ts`. 3 new/updated backend tests (period-end scoping, transfer credit regression); no DB available locally to execute them — syntax-checked only, flagged to user.

## 2026-07-11 (6) — Moved the transactions page-size selector into the header, next to Filters

**Context:** User asked for the "Show X per page" control to move from the pagination footer up into the header row, positioned to the left of the Filters button.

**Decision:** Moved the `<select aria-label="Rows per page">` from the bottom pagination bar into the header's control row, placed between the sort controls and the Filters button. Kept it gated by the same `showPagination` condition it always had (only shown when there's more than one page) rather than making it unconditionally visible, since the ask was about position, not visibility rules.

**Discovered while validating:** `Transactions.test.tsx` (12 tests) and a wide swath of unrelated page tests (Categories, Tags, ImportReview, PiggyBankDrawer, BudgetForm — 64 failures total in the full suite) fail with `useToast must be used within ToastProvider` / `usePeriod must be used inside PeriodProvider`. Traced to an older commit (`734cb94`, predates this session) that added toast notifications and period-context usage to several pages without updating the shared `renderWithQuery` test helper to wrap `ToastProvider`/`PeriodProvider`. Confirmed via `git stash` that every file touched today is unaffected — reverting each in isolation reproduces the identical failure count. Not fixed (out of scope for today's asks); flagged to the user as a pre-existing test-infra gap worth a dedicated follow-up.

**Affects:** `frontend/src/pages/Transactions.tsx`.

## 2026-07-11 (7) — Cash flow chart: truncate instead of round when abbreviating amounts

**Context:** User noticed the chart's ₹K/₹L abbreviations rounded off the underlying amount (e.g. ₹81,483 displayed as ₹81K, losing precision the axis/tooltip should convey) and asked that it not round — e.g. 81,483 should read at least 81.4K.

**Decision:** `formatINR` in `CashFlowChart.tsx` now truncates toward zero to 1 decimal place instead of `.toFixed(0)`/`.toFixed(1)` (which round to nearest). A displayed abbreviated value now never overstates the real amount.

**Affects:** `frontend/src/components/dashboard/CashFlowChart.tsx`. Updated existing test expectations to match (5 assertions changed for values that rounded up under the old logic); added a dedicated truncation regression test using the user's own example (81,483 → "81.4K").

## 2026-07-11 (8) — Account balance: computed from the ledger, not an imperatively-maintained cached column (Phase 1)

**Context:** User reported a real production discrepancy between kanakku's displayed balance and their actual bank statement. Investigation via read-only queries against the production DB (run by the user, results shared back) showed all 5 real accounts had drift between the stored `current_balance` column and a from-scratch recomputation of the same account's transaction history. Root cause: `routers/imports.py`'s `confirm_records` inserted `Transaction` rows via `session.add()` directly, bypassing the `apply_balance()` logic that every other create/edit/delete/restore path in `transactions.py` correctly calls — imported transactions never touched account balance at all. `replace_existing` was worse: it soft-deleted the old transaction and added the replacement without touching balance on either side, only staying correct by coincidence when the replacement amount matched exactly.

**Decision:** Rather than just patch the two missing call sites (which would leave the underlying design flaw — any future code path inserting a Transaction row can make the identical mistake, with nothing to catch it), redesign so there is no separate maintained value to desync in the first place. `Account.current_balance` becomes computed on read: `SUM()` over the ledger, in a new `app/services/account_balance.py` (`compute_balance`/`compute_balances`, batched, `as_of`-bounded for historical/period queries). At this app's real transaction volume (~200-300/month per user, so even a decade of heavy use is a few tens of thousands of rows per account), the query costs low single-digit milliseconds — the cached-column design was never buying real performance, only the *risk* of exactly this bug.

**Staged rollout (Phase 1, this entry; Phase 2 later):** kept the `accounts.current_balance` DB column in place — stopped writing to it from every mutation path, but didn't drop it yet, so its last-written value serves as a frozen snapshot the user can manually compare against the newly computed value (and their real bank statements) before a follow-up migration removes the column for good. This was explicitly chosen over a single big migration given no local test DB is available to verify the new logic before it touches the user's real production data.

**Necessary correctness fix bundled into Phase 1 (not optional scope creep):** `create_account` previously set `current_balance = opening_balance` directly with zero corresponding ledger transaction. Once balance reads switch to computed-from-ledger, that would make every newly created account show ₹0 despite a nonzero entered opening balance — a regression Phase 1 would introduce on day one if left alone. Fixed by having `create_account` insert a real `opening_balance`-type Transaction whenever `opening_balance != 0`. This also happens to close the "two sources of truth for a starting balance" gap that caused the original investigation's first false alarm this session (an account's `opening_balance` field being set independently of, and sometimes duplicated by, a separately-created `opening_balance` transaction).

**Also refactored:** `dashboard.py`'s `_account_balances` and `_cashflow_by_account`'s "opening balance at period_start" step both used to compute a historical balance as `live_current_balance − delta_since(as_of)`. With balance itself now computed, that indirection collapses to a direct `compute_balances(as_of=...)` call — deleted the old `_balance_delta_since` helper (functionality subsumed by `compute_balances`).

**Alternatives considered:**
- Just fix the two missing `apply_balance` calls in `imports.py` — the minimal fix, but leaves the design flaw (nothing stops the next new code path from making the same mistake) that directly caused this bug.
- A DB trigger to enforce the invariant at the database layer instead of removing the cache — stronger safety net than application code remembering, but still an imperative mechanism (just relocated), and more complex to test/reason about than deleting the code entirely.
- One combined migration (compute-balance switch + drop column) instead of a staged rollout — rejected given the inability to test against a real database before deploying to the user's actual financial data; the staged approach gives a built-in verification step for free.

## 2026-07-11 (9) — Transactions list: transfers count as real credit/debit once account-filtered; added opening/closing balance to the response

**Context:** User compared their real June Union Bank statement (Total Debits ₹1,28,119.70 / Total Credits ₹1,26,037.67) against the app's Transactions page for the same account+month (−₹82,082.03 / +₹46,037.67) — individual transactions matched, but the summary totals didn't. Root cause: `list_transactions`'s `total_inflow`/`total_outflow` aggregates only summed `income`/`expense`-type transactions, excluding transfers entirely, with the reasoning "transfers net to zero between own accounts" (comment in the code). That's true only when viewing the whole portfolio at once — once the view is filtered to one account, a transfer into or out of *that* account is a real credit/debit on its ledger, exactly what a bank statement shows. The missing legs (a transfer-in and a transfer-out) accounted for the entire gap.

**Decision:** When `account_id` filters the list to specific accounts, `total_inflow`/`total_outflow` now also include transfer legs in the correct direction relative to the filtered account(s) — `to_account_id` in the filtered set counts as inflow (crediting `coalesce(to_amount, amount)`, matching the same-currency-transfer convention used elsewhere), `account_id` in the filtered set counts as outflow. With no account filter, transfers are still excluded (portfolio-wide net-zero holds). Gated on `type is None or type == transfer` so an explicit `type=income`/`type=expense` filter isn't silently widened.

**Also added (explicit ask):** `opening_balance`/`closing_balance` fields on `TransactionListResponse`, summed across whichever accounts the view is scoped to (the account filter, or every account the user owns if unfiltered). `opening_balance` = `compute_balances(as_of=from_date)` (0 if no `from_date`, since there's no bounded start to measure "before" against); `closing_balance` = `opening_balance + total_inflow − total_outflow`, mirroring the bank statement's own "Opening + Credits − Debits = Closing" identity — which is also how the user validated the discrepancy in the first place, so the same identity now holds inside the app.

**Test-DB access, first time this session:** found a running local Docker Postgres (`infra-db-1`, already up) with a pre-existing `kanakku_test` database, letting the whole backend suite actually run for the first time since the Phase 1 account-balance refactor (commit `d780d07`) — that refactor had only ever been `py_compile`-checked. Running for real surfaced 4 pre-existing regressions: tests asserting bare transaction-list counts (`test_list_returns_own_transactions`, `test_list_excludes_deleted_by_default`, `test_filter_by_account`, `test_cursor_pagination`) broke because `create_account`'s new `opening_balance` Transaction row (added in Phase 1) now legitimately appears in listings. Fixed by scoping those assertions with `type=expense` where that was already the test's intent. Also fixed `test_replace_existing_updates_account_balance` (added last session, never executed), which asserted a soft-deleted transaction's `deleted_at` via a GET that 404s by design (soft-deleted rows are excluded from `GET /transactions/{id}` unless `include_deleted`) — changed the assertion to expect the 404 directly.

**Found but explicitly out of scope:** `tests/conftest.py`'s `db_tables` fixture builds the schema via `Base.metadata.create_all`, which only creates ORM-mapped tables — it never runs Alembic migrations, so raw-SQL objects like the `transaction_with_net_amount` view (migration `0010_net_expense_view.py`) don't exist in the test DB. This fails all of `test_dashboard.py` and `test_dashboard_net_expense.py` (`UndefinedTableError`) regardless of any code change; confirmed pre-existing and unrelated by scope (no file in either failing suite was touched this session). `test_export.py`, `test_cli.py`, `test_import_archive.py`, `test_payment_methods.py`, `test_reports_query.py` also have pre-existing unrelated failures (multi-user `/auth/setup` returning 404 on a second call, ARQ export jobs staying "pending" with no worker running, a missing UPI-app validation, a missing SQL-injection guard on `/reports/query`) — none touch code from this session; flagged for a separate follow-up, not fixed here.

**Affects:** `backend/app/routers/transactions.py`, `backend/app/schemas/transaction.py`, `frontend/src/api/transactions.ts`, `frontend/src/pages/Transactions.tsx`, `backend/tests/test_transactions.py` (2 new tests), `backend/tests/test_imports.py` (1 test fixed). Full `test_transactions.py`/`test_imports.py`/`test_accounts.py` suite (55 tests) passes against a real Postgres DB.

## 2026-07-11 (10) — `compute_balances`'s `as_of` bound excluded an opening_balance transaction dated exactly on the boundary

**Context:** Immediately after shipping (9), user reported the new Opening/Closing balance fields showing "Opening: 0.00" for a Union Bank account whose Opening Balance transaction was clearly visible in the list, dated 01 Jan 2026 — for the "Jan 2026" period, whose `from_date` is also `2026-01-01T00:00:00Z`.

**Root cause:** `account_balance.py::compute_balances`'s `_bound` helper applies `Transaction.transacted_at < as_of` uniformly to income, expense, *and* `opening_balance` rows in one combined query. An opening_balance transaction dated at the exact same instant as `as_of` fails the strict `<` and gets silently dropped. This isn't a rare coincidence: the PDF parser (`parsers/banks/generic.py`) always dates a statement's opening balance at midnight on the statement's first day, and `import_router`'s date-only parsing (`datetime.strptime(date_str, "%Y-%m-%d")`) always lands on midnight — so any period whose `from_date` is the start of the account's first imported month hits this exactly. This is the same helper `dashboard.py`'s `_account_balances` and `_cashflow_by_account` call, so the bug wasn't limited to the Transactions page — it would have silently zeroed the same account's opening balance on the dashboard and cashflow chart's first bucket too, whenever that boundary condition was met. This is exactly the kind of shared-helper enforcement the user asked about in the previous exchange ("should this be enforced regardless of filters or where it's displayed") — the enforcement mechanism was already correctly centralized in one function, but that one function had the bug, so it was wrong everywhere at once.

**Decision:** Split the boundary treatment by transaction type instead of applying one bound to the whole income/expense/opening_balance query: `opening_balance` rows use `<=` (a pre-period seed is logically "as of" a boundary it sits exactly on), income/expense rows keep the strict `<` (so a transaction dated exactly at a period's start isn't double-counted in both "opening balance" and that period's own flow totals — the far more common case, since date-only imports frequently land on midnight). New `_ie_bound` in `account_balance.py` implements this as `(type == opening_balance AND transacted_at <= as_of) OR (type != opening_balance AND transacted_at < as_of)`, applied only to the combined income/expense/opening_balance query; the transfer-leg queries keep the original strict `_bound`.

**Affects:** `backend/app/services/account_balance.py`. Fix lives in the shared helper, so it also corrects `dashboard.py`'s `_account_balances` and `_cashflow_by_account` for the same boundary case, without touching either file. New regression test `test_opening_balance_dated_exactly_at_period_start_is_included` in `test_transactions.py` reproduces the exact reported scenario (opening_balance dated `2026-01-01T00:00:00Z`, queried with `from=2026-01-01T00:00:00Z`). Full `test_transactions.py`/`test_imports.py`/`test_accounts.py` (56 tests) passes against a real Postgres DB.

**Affects:** new `backend/app/services/account_balance.py`; `backend/app/routers/{accounts,transactions,imports,dashboard}.py`; `backend/tests/{test_accounts,test_transactions,test_imports,test_dashboard}.py`. No migration in this phase (column kept, unused). Not executed against a real database — validated via `py_compile` and explicit import-resolution checks only; a real pytest run against a test DB is still needed before this is considered fully verified.

## 2026-07-11 (11) — Period date-range boundaries treated a local calendar date as if it were already UTC

**Context:** After deploying (10), the user reported it "still wrong" — a Union Bank Opening Balance transaction, correctly dated 01 Jan 2026 00:00 IST, was appearing inside the "Dec 2025" filtered Transactions view. They then edited it, and it disappeared from *both* Dec 2025 and Jan 2026 — a direct SQL check on their production DB showed the edit had (correctly) converted 31 Dec 2025 7:30pm IST's time-of-day to UTC, but the *year* had silently stayed at 2026 (the datetime-local input's initial value carried the pre-edit year; editing only month/day/time doesn't roll the year back, a known trap of plain `<input type="datetime-local">` widgets) — a data-entry mistake, not an app bug, and unwound by re-editing.

**Root cause of the actual reported bug:** `Transactions.tsx` (and `Disputes.tsx`) built the `from`/`to` query params by taking `period-context`'s `start_date`/`end_date` — bare `YYYY-MM-DD` strings produced by `toIsoDate()`, which strips all timezone information — and reattaching a literal `'T00:00:00.000Z'`/`'T23:59:59.999Z'` suffix. That treats the local calendar date as if it were already a UTC date, which is only correct for users in UTC. For IST (UTC+5:30, confirmed as the user's timezone), "end of Dec 31 local" is actually `2025-12-31T18:29:59.999Z`, not `2025-12-31T23:59:59.999Z` — the naive construction extended the "Dec 2025" window nearly 5.5 hours into Jan 1 UTC, wide enough to catch a transaction whose true local date was Jan 1 but whose UTC instant (`2025-12-31T18:30:00Z`) still looked like "Dec 31" by the naive, timezone-blind comparison.

**Decision:** Added `toLocalStartOfDayISO`/`toLocalEndOfDayISO` to `period.ts` — both take the `ResolvedPeriod.start`/`.end` Date objects (already correct, since `resolvePeriod()` builds them with local-time constructors like `new Date(y, m, d)`) and call `.toISOString()` directly on a local-midnight/local-23:59:59.999 Date, letting the JS engine do the local→UTC conversion correctly for whatever timezone the browser is actually in — instead of manually reconstructing a fake UTC string from stripped-down date components. `PeriodProvider` now exposes these as `rangeStart`/`rangeEnd` on the context (alongside the existing bare-date `dashboardParams.start_date`/`end_date`, kept for consumers using date-only display or endpoints). `Transactions.tsx` and `Disputes.tsx` — the only two call sites using this naive pattern — now source `from`/`to` from `rangeStart`/`rangeEnd`.

**Verification note:** the dev sandbox this was fixed in genuinely runs with `getTimezoneOffset() === -330` (IST) — not a coincidence to rely on going forward, so the new regression test in `period.test.ts` asserts the *round-trip* property (parsing the produced ISO string back gives true local midnight/end-of-day) rather than a timezone-specific literal string, so it's meaningful on any runner.

**Explicitly not fixed in this pass, same root cause, flagged for the user to decide on:** `backend/app/routers/dashboard.py`'s `_period_window` custom-period branch has the identical bug independently on the backend side (`datetime(start_date.year, month, day, tzinfo=UTC)` from a bare `date` query param with no timezone information) — this is reachable from the Dashboard page, whose Account Balances/cashflow chart could show the same kind of month-boundary leak. `Budgets.tsx`/`BudgetDrawer.tsx`/`BudgetDetail.tsx`/`Splits.tsx`/`SplitsAll.tsx` all consume `dashboardParams.start_date`/`end_date` as bare dates too, passed to their own backend endpoints, which likely share the same date-only-query-param pattern. Fixing all of these consistently would mean widening several backend endpoints' query params from `date` to `datetime` and auditing each frontend caller — a larger, multi-file change not undertaken here since it wasn't the reported symptom.

**Affects:** `frontend/src/lib/period.ts`, `frontend/src/lib/period-context.tsx`, `frontend/src/pages/Transactions.tsx`, `frontend/src/pages/Disputes.tsx`, `frontend/src/lib/period.test.ts` (2 new tests, 15 total pass). `bun run build` clean; pre-existing `Transactions.test.tsx` failures (12, `usePeriod must be used inside PeriodProvider`) confirmed unrelated — same test-infra gap documented 2026-07-11 (6).

## 2026-07-11 (12) — Extended the timezone fix to dashboard.py, budgets.py, and Splits/SplitsAll (user: "we need to do it... timezone agnostic, converted right before returned from the API or converted to IST locally from the UI")

**Context:** Follow-up to (11), explicitly requested broader in scope. User's stated principle: the backend should be genuinely timezone-agnostic — it should never guess or assume a timezone — and any local-time conversion should happen exactly once, in the browser (which is the only place that actually knows the user's real timezone).

**Audit found the identical UTC-vs-local mistake in four more places**, none related to the frontend fix in (11):
1. `dashboard.py`'s `_period_window` custom-period branch — `datetime(start_date.year, month, day, tzinfo=UTC)` from a bare `date` query param, same as the bug already fixed in `account_balance.py`/`Transactions.tsx`.
2. `budgets.py` — three separate call sites (`list_budgets`'s activation-window filter and `_batch_spent` call, `_compute_current_spent`'s `_date_conds()`, `list_budget_transactions`) all did the same `datetime(y, m, d, tzinfo=UTC)` reconstruction from a bare `date` query param before comparing against `Transaction.transacted_at`/`Budget.activated_at` (both real timestamptz columns).
3. `Splits.tsx`/`SplitsAll.tsx` — client-side period filters did `s.expense_date.slice(0, 10)` / `s.created_at.slice(0, 10)` directly on a full UTC ISO timestamp, extracting the **UTC** calendar date rather than the user's local one, then comparing that against the local `start`/`end` boundary strings. Same failure mode as the original bug, just in the browser instead of at a query boundary.

**Decision — backend contract:** any endpoint filtering by a period boundary against a real timestamp column now takes a full `datetime` query param instead of a bare `date`, and does *no* server-side reconstruction of a UTC instant from date components — it trusts the instant it's given, because it has no way to know the caller's timezone and must not assume UTC. `dashboard.py::home_dashboard`'s `start_date`/`end_date` changed to `datetime | None`; `_period_window`'s custom branch now just returns them directly (`return start_date, end_date`, no `+ timedelta(days=1)` reconstruction — the caller supplies the already-correct exclusive boundary). `budgets.py::list_budgets` gained new `spent_from`/`spent_to: datetime | None` params used only for the timestamptz comparisons (transaction spend, `Budget.activated_at`), while keeping `from_date: date | None` unchanged for the one comparison that's genuinely date-only (`Budget.end_date`, a `DATE` column with no time component — no bug there, no fix needed). Removed the now-unused `to_date` param entirely rather than leaving dead code. `budgets.py::list_budget_transactions`'s `from`/`to` changed from `date` to `datetime` outright (no dual-purpose date column involved there).

**Decision — frontend contract:** `usePeriod()` now exposes three correct, pre-computed UTC instants alongside the existing bare-date `dashboardParams` (kept for display and any genuinely date-only comparison): `rangeStart` (local start-of-day), `rangeEnd` (local end-of-day, inclusive — for `<=`-style endpoints), `rangeEndExclusive` (start of the next local day — for `<`-style endpoints, matching `dashboard.py`'s and `budgets.py`'s existing exclusive-end convention rather than forcing every endpoint onto one convention). `Dashboard.tsx`, `Budgets.tsx`, `BudgetDrawer.tsx`, `BudgetDetail.tsx` now build their API-call params from these instead of `dashboardParams.start_date`/`end_date` directly. `Splits.tsx`/`SplitsAll.tsx`'s client-side filters now convert the transaction's full timestamp to a local date via `toIsoDate(new Date(...))` before comparing, instead of slicing the raw UTC string.

**Bug found and fixed as a direct side effect of unblocking `test_dashboard.py`** (see next paragraph): `_cashflow_by_account`'s Step 2 (net change per bucket) only summed `income`/`expense` types, never `opening_balance`. Combined with Step 1 (`compute_balances(as_of=period_start)`) correctly excluding an opening_balance transaction dated *after* `period_start`, an account created mid-period had its opening balance vanish from the per-account cashflow chart entirely — neither step ever counted it. Fixed by including `opening_balance` as a credit in Step 2's query, mirroring `account_balance.py`'s own `compute_balances` treatment. Caught by `test_dashboard_same_currency_transfer_credits_destination_balance`, which creates a second account mid-test (so its opening_balance is naturally mid-period) — this test existed before today but had never actually run.

**Test infrastructure fix, prerequisite for verifying any of the above:** `tests/conftest.py`'s `db_tables` fixture used `Base.metadata.create_all`, which only creates ORM-mapped tables — it silently skips raw-SQL objects defined directly in Alembic migrations, so `transaction_with_net_amount` (a view, migration 0027) never existed in the test DB. This made all of `test_dashboard.py` (18 tests) and `test_dashboard_net_expense.py` (5 tests) fail with `UndefinedTableError` regardless of any code change — flagged as pre-existing and out of scope twice already this session (entries 9 and the completed.md note for this task), but today it directly blocked verifying the dashboard.py fix above, so fixing it became load-bearing rather than optional. Fixed by executing the view's `CREATE OR REPLACE VIEW` SQL by hand in the fixture after `create_all` (not by running full Alembic migrations in tests — simpler, and this is the only such object currently in the schema). Doing this surfaced three more pre-existing test bugs from last session's Phase 1 balance refactor, never caught because these tests literally could not run before: `test_dashboard_empty_state` assumed a literal empty transaction table (now `create_account` seeds a real opening_balance row); `test_dashboard_account_balances_as_of_period_end` and `test_dashboard_same_currency_transfer_credits_destination_balance` needed bare-date params updated to full instants once `home_dashboard`'s contract changed. Fixed all three.

**Alternatives considered:** running real Alembic migrations against the test DB instead of hand-copying the view SQL — more correct in the abstract (can't silently drift from the real migration), but a bigger, riskier change (async-engine/Alembic integration, migration-runner overhead on every test) for a single view; deferred unless more raw-SQL migration objects appear.

**Affects:** `backend/app/routers/{dashboard,budgets}.py`, `backend/tests/conftest.py`, `backend/tests/test_dashboard.py` (3 tests fixed); `frontend/src/lib/period.ts` (new `toLocalExclusiveEndISO`), `frontend/src/lib/period-context.tsx`, `frontend/src/pages/{Dashboard,Budgets,BudgetDetail,Splits,SplitsAll}.tsx`, `frontend/src/components/drawers/BudgetDrawer.tsx`, `frontend/src/api/budgets.ts`, `frontend/src/pages/Dashboard.test.tsx` (updated a hand-built `PeriodContext` mock to match the new required fields), `frontend/src/test/handlers.ts` (dashboard mock now mirrors the real backend's `period_end = end_date - 1 day` exclusive-boundary contract). Full backend suite: 486 passed, 8 failed (all pre-existing/unrelated — `test_export.py`, `test_cli.py`, `test_import_archive.py`, `test_payment_methods.py`, `test_reports_query.py`), 7 skipped. Full frontend suite: 466 passed, 64 failed (exactly the pre-existing `ToastProvider`/`PeriodProvider` test-infra gap from 2026-07-11 (6), confirmed via `git stash` — no new failures).

## 2026-07-11 (13) — Investigated the 8 remaining "pre-existing" test failures instead of leaving them flagged; found the export/import feature was completely broken in production

**Context:** User asked, reasonably, whether the 8 failures flagged as "pre-existing, unrelated" across entries (9)–(12) should actually be fixed or the tests updated — rather than continuing to wave them off as out of scope. Investigated each one individually instead of assuming.

**Real product bugs found (not test staleness) — the data-export/import feature (`POST /export`, `POST /import-archive`, `python -m app.cli export-archive`/`import-archive`) was fully broken end to end:**
1. `export_worker.py::_EXPORT_TABLES` referenced `"llm_activity_logs"` (plural) — the real table (migration `0015_llm_activity_log.py`, model `LLMActivityLog.__tablename__`) is `llm_activity_log` (singular). Every export hit `UndefinedTableError` on this line and failed outright — this bug shipped and would have broken every real export the user ever tried. Same typo duplicated in `_USER_ID_TABLES` (`routers/export.py`) and `user_id_tables` (`cli.py`)'s remap sets.
2. `cli.py::_import_archive` and `routers/export.py::import_archive` both wrapped their insert loop in `async with session.begin():`, but an earlier query on the same session (`_find_user`'s SELECT / the pre-import transaction-count guard) had already auto-begun a transaction — SQLAlchemy 2.0 async sessions autobegin on first use. Calling `session.begin()` again raised `InvalidRequestError: A transaction is already begun on this Session` — import failed unconditionally, before inserting a single row. Fixed by removing the explicit `begin()` and committing/rolling back manually.
3. Export flattens every `UUID`/`Decimal`/`date`/`datetime` value to a string for JSON (`_serialize`). Import never reversed this — it bound the JSON-decoded strings straight into a raw `INSERT ... VALUES (:k, ...)`, and asyncpg (unlike psycopg2) requires the exact Python type for these columns, not a string literal it could implicitly cast. Every table with a timestamp, decimal amount, or UUID column would fail. Fixed with a new `deserialize_row(table_name, row)` in `export_worker.py` that looks up each column's real type via `Base.metadata.tables[table_name].columns[col].type.python_type` (every export table is ORM-mapped, so this is exact, not a guess from string shape) and parses accordingly.
4. `user_settings` has exactly one row per user, auto-created at signup (`_create_user`/`/auth/setup`/accept-invite all do this). Importing the archived `user_settings` row for a target user that (by definition, since they must already exist to import into) already has one always collided on the `user_id` primary key. Fixed by deleting the target's existing row before inserting the archived one, in both import paths.
5. `payment_method.py`'s `PaymentMethodCreate` validator lost its "upi_app is required when type is upi" half in commit `467bc3b` ("feat: implement hard-delete functionality for piggy banks and splits...") — an unrelated commit that had nothing to do with payment methods; almost certainly an accidental find/replace or merge artifact, not an intentional simplification (confirmed via `git show` — the diff only removed those two lines, renaming the validator and dropping the check). Restored it. The other direction (`upi_app` set when type isn't `upi`) survived and was still enforced, which is why this wasn't caught by anything obviously breaking — accounts could just silently create UPI payment methods with no app specified.

**Genuinely stale tests, updated to match current (better) behavior, not a regression:**
- `test_missing_user_id_rejected` (now `test_missing_user_id_auto_scoped`) asserted `SELECT * FROM accounts` (no explicit `user_id` filter) gets rejected with 400. The actual, current design in `reports.py::_inject_user_id_filter` is better than that: it rewrites the query AST to inject `table.user_id = :user_id` automatically for every table that has one, for every nested SELECT/CTE/subquery — so a query without an explicit filter is auto-scoped, not rejected. That's a stronger safety property (impossible to forget), not a missing feature. Rewrote the test to assert the actual (correct) behavior: 200, results scoped to the caller.
- `test_export_contains_only_own_data` and `test_roundtrip_export_import` both called `POST /auth/setup` twice to create two users — but `_assert_no_users_exist` makes that endpoint single-use by design (this is a genuinely single-user, self-hosted app; a second user only exists via the invite flow). Switched both to the already-established `register_second_user` helper (`tests/_helpers.py`, already used by `test_dashboard.py`).
- `test_trigger_export_falls_back_inline`, `test_download_export_archive`, and (transitively) `test_export_contains_only_own_data`/`test_roundtrip_export_import` all assume "Redis is unreachable → job runs inline and finishes immediately." That's an environment precondition, not something the test enforced — this sandbox has a real, reachable Redis (`infra-redis-1`), so `arq.create_pool()` actually succeeded, the job enqueued for a worker that isn't running, and it stayed `"pending"` forever. Added `_force_redis_unavailable()` (mocks `app.routers.export.arq.create_pool` to raise) so these tests are deterministic regardless of what's actually reachable at `REDIS_URL`, matching the pattern the file's own passing test (`test_trigger_export_returns_job`) already used for the opposite case.
- `test_roundtrip_export_import` (in `test_import_archive.py`) still failed after all of the above with a `409 UUID conflict in accounts` — which turned out to be the UUID-conflict guard working *correctly*: it blocks importing a row whose id already exists anywhere in the table, and the source user's own account (same id, obviously) was still live in the same database. That guard is a real safety feature (without it, re-importing into the same live database would silently duplicate/collide primary keys) — the test's "roundtrip within one live database, source data still present" isn't how the feature is meant to be used (real use case: migrate to a fresh, empty install). Updated the test to hard-delete the source account (and its transactions, for the FK) before importing, simulating "this data no longer lives here."

**Affects:** `backend/app/workers/export_worker.py` (table name fix, new `deserialize_row`), `backend/app/cli.py`, `backend/app/routers/export.py` (both: table name fix, `session.begin()` fix, `deserialize_row` wiring, `user_settings` collision fix), `backend/app/schemas/payment_method.py` (restored validation), `backend/tests/{test_export,test_import_archive,test_reports_query}.py`. Full backend suite: **494 passed, 0 failed, 7 skipped** — every test in the repository passes for the first time this session (previously 486/8/7).
