# Project Review TODO — 2026-06-02

Tracking all findings from [docs/reviews/project-review-2026-06-02.md](reviews/project-review-2026-06-02.md).

Items are crossed off as they are fixed.

---

## CRITICAL

- [x] **C1** — Unified `WorkerSettings` with all three jobs (`purge_soft_deleted`, `process_pdf_import`, `export_archive`); update compose `command`. Created `backend/app/workers/settings.py`; compose now points at `app.workers.settings.WorkerSettings`.
- [x] **C2** — Net-expense (FR-7.9/7.10) not applied in dashboard: `_monthly_totals` uses gross `SUM(amount)`; `_category_breakdown` same; settlement income counted as income. Drive aggregates off `transaction_with_net_amount` view and exclude settlement-linked income.

---

## HIGH

- [x] **H1** — `expense_calculator.net_expense()` broken by migration 0026. **Already fixed** (ad-hoc sprint): code already uses `SplitExpense.transaction_id`; `test_expense_calculator.py` also updated. No action needed.
- [x] **H2** — Compose hardwired to external `proxy-nw` network → clean `docker compose up` fails on fresh host. Move `proxy-nw` + Caddy attachment to a `docker-compose.tunnel.yml` override, or document a required `docker network create` step prominently.
- [x] **H3** — No automatic database migrations on deploy. Added `backend/entrypoint.sh` (runs `alembic upgrade head` then execs uvicorn); Dockerfile now uses it as `ENTRYPOINT`.
- [x] **H4** — Caddy/TLS story incoherent: Caddyfile comment says "auto HTTPS" but config uses `http://` + custom port, so ACME can never run. Commit to one story (tunnel-terminated HTTP, or real HTTPS with 80/443) and update Caddyfile comment + README.

---

## MEDIUM

- [x] **M1** — Read-only Postgres role (`app_readonly`) never used: `readonly_database_url` defaults to `database_url`. Resolved by dropping `readonly_database_url`/`get_readonly_engine` entirely; query endpoint now runs on the regular session with `SET TRANSACTION READ ONLY` + sqlglot SELECT-only AST check as the two enforcement layers.
- [ ] **M2** — `user_id` guard on SQL query endpoint bypassable (`WHERE user_id = :user_id OR 1=1` passes). Document as not a hard multi-tenant boundary; consider RLS as the proper fix.
- [x] **M3** — Reports schema-reference panel was stale. Updated `_SCHEMA` in `reports.py`: fixed transactions (removed duplicate `transacted_at`, added `external_ref`, added `opening_balance` type), fixed accounts.type, replaced stale splits/split_shares with correct schema, added `split_expenses` and `split_share_settlements` tables, fixed budgets (type, period, added missing columns).
- [x] **M4** — Vite dev proxy targets wrong port (`8000` instead of `8765`). Point proxy at `http://localhost:8765`.
- [x] **M5** — Light-theme classes (`bg-white`, `text-gray-700`, `border-gray-300`) on dark-themed `TransactionForm`. Migrate to design tokens (`fg`/`surface`/`border`).
- [ ] **M6** — Split creation is non-atomic two-step from form: if `POST /splits` fails after transaction is persisted, retry creates a duplicate. Add an atomic server-side path, or handle retry/cleanup on client.
- [x] **M7** — Category/tag/budget pickers are flat chip lists with no search or inline-create; auto-overwrite payee default categories even when user already chose manually. Replace with `Autocomplete` multi-select + inline-create; only apply payee defaults when no categories are already chosen.
- [x] **M8** — `POST /auth/setup` issues tokens but stored no `Session` row. Added `SessionModel(...)` insert in `setup`, mirroring `login`.
- [ ] **M9** — `CADDY_PORT`/`PUBLIC_BASE_URL` defaults inconsistent: compose/Caddy default to `8081`, `env.example` sets `9090`, `PUBLIC_BASE_URL` points at `8765` (internal API port). Pick one host port; make all three agree; set `PUBLIC_BASE_URL` to Caddy-exposed URL.

---

## LOW / Code Smells

- [ ] **L1** — N+1 queries in transaction listing (`_to_response` runs 5 sub-queries per row; `list_splits` same shape). Consider batched `selectinload`/joined loads.
- [x] **L2** — Backend container runs as root in `backend/Dockerfile`. Add non-root `USER`.
- [x] **L3** — `opening_balance` was additive. Added a ≤1 guard in `create_transaction`: raises 422 if a non-deleted `opening_balance` already exists for the account.
- [ ] **L4** — No rate limiting on auth/imports (NFR-6); no `/ready` or `/metrics` (TDD §4.12); CORS middleware unimplemented (moot for same-origin, but TDD §4.11 cites it — note as deferred).
- [x] **L5** — `test_expense_calculator.py` was dead/failing. Already fixed as part of H1 (ad-hoc sprint).

---

## Docs & Code Cleanup

- [x] **D1** — `DEV_MODE_SETUP.md` (repo root) is entirely stale: documents `.dev-config.yml` + preset system never shipped, `X-Dev-User-ID` header that doesn't exist, wrong dev email. Rewrite to match real `DEV_MODE`/`/auth/dev-login` flow; move to `docs/dev-mode.md`.
- [x] **D2** — Dev-user email mismatch: `DEV_MODE_SETUP.md` and `env.example` comment say `dev@kanakku.local`; seed and actual value is `dev@kanakku.com`. Fix all occurrences.
- [x] **D3** — `infra/load-dev-config.py` reads `.dev-config.yml` that doesn't exist. Delete the script.
- [x] **D4** — `docs/TDD.md` still describes Ollama-in-compose and GPay as live features. Add "v1 deviations" note at the top pointing at the decision log and this review.
- [x] **D5** — `docs/running.md` references `app.worker.WorkerSettings` (old path); also has stale Ollama-in-compose commands. Fix worker path; remove/update stale Ollama compose references.
- [x] **D6** — Consolidate point-in-time bug-tracking docs (`docs/bugfixes/*`) into `docs/reviews/archive/`.
- [x] **D7** — `frontend/.env.local.bak` is an untracked stray. Delete it.
- [ ] **D8** — Decide LLM's fate: if deferred, hide **Settings → LLM Activity** entry behind `LLM_BACKEND != none` so users don't see a dead feature; if removed, delete `app/llm/*`, `llm_activity_logs` surface, and `match_gpay_to_bank`.
- [x] **D9** — `expense_calculator.py` was broken. Already fixed (ad-hoc sprint) — uses `SplitExpense` join table correctly.
- [x] **D10** — `TransactionForm`'s `initial?: any` prop. Typed as `Transaction`.

---

## TDD Drift (decisions needed)

- [x] **T1** — `opening_balance` as a 4th transaction type contradicts the "three types only" principle in `CLAUDE.md` and `TDD.md`. **Resolved (2026-06-04):** legitimized in TDD v3.1 and `CLAUDE.md`; decision logged.
- [x] **T2** — Dashboard sub-queries are sequential despite TDD §4.14 saying they should be parallelized. **Accepted as-is:** `asyncio.gather` cannot safely share one `AsyncSession`; true parallelism requires one session-per-coroutine with added connection-pool pressure. Not worth the complexity at current scale. TDD §4.14 is aspirational and will be noted as deferred.
- [ ] **T3** — CORS and rate-limiting gaps vs. TDD §4.11/§4.12.
  - **CORS:** genuinely moot — frontend and API share the same Caddy origin in all deployment topologies; no cross-origin request is ever issued. Note as N/A in TDD.
  - **Rate limiting on auth/imports:** genuinely missing. Low risk behind a tunnel, but still a gap vs. spec. Tracked as L4.
