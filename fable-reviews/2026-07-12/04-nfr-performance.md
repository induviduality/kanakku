# NFR & Performance Review — 2026-07-12

Context for calibration: single user, ~200–300 transactions/month (your own estimate,
decisions.md D-002), production target Raspberry Pi 5 + Postgres in Docker. Nothing here
is "web scale" advice — each item is judged against *that* deployment. Ordered by expected
user-perceived impact.

## Backend

### 1. `GET /transactions` — six queries per row (the big one)
`backend/app/routers/transactions.py:128-143` (`_to_response`), called per item at `:612`

Every listed transaction triggers 6 sequential awaits: category ids, tag ids, budget ids,
piggy-bank id, payment-method name, split id. Plus the list endpoint's own 5–7 aggregate
queries (count, inflow, outflow, transfer legs ×2, opening balances). A 100-row page ≈
**610 round trips**; even at 0.5–1 ms each on the Pi that's 300–600 ms of pure query
latency per page — and this endpoint backs the transactions page, both drawers, and every
picker. Fix shape (no schema change):

- One `SELECT … FROM transaction_categories WHERE transaction_id IN (:page_ids)` per join
  table (3 queries), one `IN` query for piggy contributions, one join for payment-method
  names, one for split ids — **6 queries per page instead of 6×N**.
- Same treatment inside `list_splits` (`splits.py:693-714`): shares + settlements +
  expense-ids are each per-split loops today (3×N); batch by `split_id IN (…)`.

### 2. Dashboard: ~35–50 sequential queries per load
`backend/app/routers/dashboard.py:759-812`

`_budgets_summary` is 4 queries × N budgets; `_recent_transactions` adds 1×5; the rest is
~15 fixed queries. With 8 budgets that's ~50 round trips per dashboard render — and the
frontend refetches it on every window focus (see §6). Two cheap levers before any
restructuring: batch `_budgets_summary` the same way as §1, and collapse
`_monthly_totals` current+previous into one query with conditional aggregation. (The
comment at `:772` is right that `asyncio.gather` can't help on one session — batching is
the honest fix.)

### 3. `list_budgets` N+1
`backend/app/routers/budgets.py:332-340` — 2 spent-queries + 1 category-query per budget.
Same batching pattern.

### 4. Unbounded list endpoints
`GET /splits`, `/payees`, `/categories`, `/tags`, `/subscriptions` return everything.
Fine at your scale for years — flagging only because `GET /splits` is *also* fetched by the
Transactions page on every visit purely to compute "Split Share" badges
(`Transactions.tsx:198`), multiplying §1's cost. Better: return a
`settlement_split_id` on the transaction response itself (the backend already computes
`split_id` for expenses; do the same join on settlements) and drop the whole splits fetch
from the page.

### 5. Text search will eventually need an index
`Transaction.description ILIKE '%q%'` (`transactions.py:466`) can't use a btree. At your
volume it's fine ~indefinitely; if search becomes a first-class UI feature (recommended in
the UX review), add a `pg_trgm` GIN index then. **Verify** meanwhile that a composite
index on `(user_id, transacted_at)` exists for the list ordering — I did not audit the
migrations for it; `EXPLAIN` one page query on prod to confirm no seq-scan.

### 6. Import pipeline
- Enqueue-before-commit race (bug #16) — correctness, but also a perf note: the
  Redis-down fallback parses the PDF synchronously inside the request (`imports.py:79-81`),
  which on a Pi means a multi-second request and a uvicorn worker pinned by CPU-bound
  parsing. If Redis is down, better to fail the upload with a clear message.
- Dedup check at parse time compares against exact date+amount (per completed.md) — fine.

### 7. FastAPI app-level gaps (cheap wins)
`backend/app/main.py` has no GZip middleware (dashboard JSON with cashflow buckets
compresses ~10×; matters on Tailscale-over-WAN), no request logging, no timing header.
`uvicorn --workers 3` on a Pi 5 with a mostly-async app is reasonable; the CPU-bound PDF
parse in a worker process (ARQ) is correctly isolated — keep it that way (see §6).

## Frontend

### 8. No route-level code splitting — every page ships in one bundle
`frontend/src/router.tsx:2-37` imports all 35 pages statically. That pulls **CodeMirror**
(`@uiw/react-codemirror`, Reports), **Recharts** (dashboard + widgets),
**react-grid-layout**, and `react-day-picker` into the first paint for someone opening the
login page. On a phone over Tailscale this is the difference between ~instant and a
multi-second first load. TanStack Router supports lazy route components; splitting just
Reports/ReportDashboard (CodeMirror + grid-layout) and the chart components is likely a
40–60 % initial-bundle cut. Run `vite build` with `rollup-plugin-visualizer` once to get
the real numbers.

### 9. Query-cache defaults: staleTime 0 everywhere
`frontend/src/main.tsx:9` — `new QueryClient()` means every query is stale immediately and
refetches on every window focus/remount. Combined with §1/§2, alt-tabbing back to Kanakku
re-fires the 50-query dashboard plus the 600-query transactions page. For single-user data
that only you mutate, a default `staleTime` of 30–60 s (and `refetchOnWindowFocus:
'always'` only for the dashboard, if desired) removes most redundant load without any
staleness you'd ever notice. This is also where the missing global `MutationCache.onError`
goes (bug #12) — one constructor, two systemic fixes.

### 10. Transactions page composition cost
Each render maps `accounts.find(...)`/`payees.find(...)` per row (O(rows × entities)) —
irrelevant at 30 rows, but trivially fixed with a `Map` built in `useMemo` alongside the
existing `splitsBySettlementTxnId`. The bigger cost is the `useListSplits()` fetch (§4).

### 11. PWA cache interplay
`vite.config.ts` workbox: `NetworkFirst` for `/api/` GETs with 5-min cache. Two notes:
(a) after a mutation, an offline-served stale GET can show pre-mutation data with no
indicator — acceptable, but consider skipping the cache for `/dashboard` and
`/transactions` since those are the "is my money right" screens; (b) **verify** the service
worker excludes `/api/v1/export/*/download` (config mentions skipping `/download` — good,
confirm it matches the archive path).

### 12. Perceived performance (cheap, high value)
- Dashboard uses `isFetching` opacity — nice pattern; extend to Transactions (currently
  full skeleton swap on every filter change, which flashes).
- Import review polls at 1.5 s during processing — good; consider stopping the records
  poll once `total_parsed > 0` and records have arrived (currently both batch + records
  poll until terminal status).

## NFR checklist against the project's own principles

| Principle | Status |
|---|---|
| NFR-1.1 config only via env | ✅ held everywhere I looked (`config.py`, compose) — one gap: `jwt_secret` default (06-production-grade §1) |
| NFR-2.1 fully-local LLM mode | ✅ trivially (LLM is never invoked — see 03-architecture §5) |
| FR-7.9 net expense | ✅ dashboard/category; ❓ budgets (flagged decision); ⚠️ silently degradable via split edit (bug #3) |
| Four transaction types | ✅ model; ⚠️ type-switch payload pollution (bug #20) |
| opening_balance excluded from reports | ✅ flows; ⚠️ shown in Recent Transactions (deliberate per completed.md — fine) |
| Soft delete everywhere | ⚠️ splits hybrid (bug #18); payment_methods/imports not in Bin or purge |
| Constraints at app AND db level | ❌ opening_balance uniqueness app-only; split invariant bypassable (03-architecture §3) |
