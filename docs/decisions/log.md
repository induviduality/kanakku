# Decision Log

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
