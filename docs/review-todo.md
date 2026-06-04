# Project Review TODO — 2026-06-02

Tracking all findings from [docs/reviews/project-review-2026-06-02.md](reviews/project-review-2026-06-02.md).

Items are crossed off as they are fixed.

---

## CRITICAL

- [ ] **C1** — Unified `WorkerSettings` with all three jobs (`purge_soft_deleted`, `process_pdf_import`, `export_archive`); update compose `command`; add smoke test that every `enqueue_job` name is registered.
- [x] **C2** — Net-expense (FR-7.9/7.10) not applied in dashboard: `_monthly_totals` uses gross `SUM(amount)`; `_category_breakdown` same; settlement income counted as income. Drive aggregates off `transaction_with_net_amount` view and exclude settlement-linked income.

---

## HIGH

- [ ] **H1** — `expense_calculator.net_expense()` broken by migration 0026: references dropped `Split.expense_transaction_id`. Rewrite to use `SplitExpense` join table or delete and rely on SQL view; fix `test_expense_calculator.py`.
- [ ] **H2** — Compose hardwired to external `proxy-nw` network → clean `docker compose up` fails on fresh host. Move `proxy-nw` + Caddy attachment to a `docker-compose.tunnel.yml` override, or document a required `docker network create` step prominently.
- [ ] **H3** — No automatic database migrations on deploy. Add entrypoint that runs `alembic upgrade head` before uvicorn, or a one-shot `migrate` service with `depends_on: { condition: service_completed_successfully }`.
- [ ] **H4** — Caddy/TLS story incoherent: Caddyfile comment says "auto HTTPS" but config uses `http://` + custom port, so ACME can never run. Commit to one story (tunnel-terminated HTTP, or real HTTPS with 80/443) and update Caddyfile comment + README.

---

## MEDIUM

- [ ] **M1** — Read-only Postgres role (`app_readonly`) never used: `readonly_database_url` defaults to `database_url`. Provision role with password in DB init, add `READONLY_DATABASE_URL` to `env.example`, fail fast if it equals `DATABASE_URL` in non-dev.
- [ ] **M2** — `user_id` guard on SQL query endpoint bypassable (`WHERE user_id = :user_id OR 1=1` passes). Document as not a hard multi-tenant boundary; consider RLS as the proper fix.
- [ ] **M3** — Reports schema-reference panel is stale: `splits.expense_transaction_id` (dropped in 0026) listed; `split_expenses` missing; `split_shares.settled_at/settlement_transaction_id/forgiven_at` (dropped in 0024) listed; `forgiven_amount`/`split_share_settlements` missing; `transactions` has duplicate `transacted_at` and missing `external_ref`/`opening_balance` type; `accounts.type` and `budgets.type`/`period` are wrong. Regenerate `_SCHEMA` from live models or `information_schema`; add test that every advertised column exists.
- [x] **M4** — Vite dev proxy targets wrong port (`8000` instead of `8765`). Point proxy at `http://localhost:8765`.
- [x] **M5** — Light-theme classes (`bg-white`, `text-gray-700`, `border-gray-300`) on dark-themed `TransactionForm`. Migrate to design tokens (`fg`/`surface`/`border`).
- [ ] **M6** — Split creation is non-atomic two-step from form: if `POST /splits` fails after transaction is persisted, retry creates a duplicate. Add an atomic server-side path, or handle retry/cleanup on client.
- [x] **M7** — Category/tag/budget pickers are flat chip lists with no search or inline-create; auto-overwrite payee default categories even when user already chose manually. Replace with `Autocomplete` multi-select + inline-create; only apply payee defaults when no categories are already chosen.
- [ ] **M8** — `POST /auth/setup` issues tokens but stores no `Session` row → first refresh after 24 h returns 401. Add `SessionModel(...)` insert in `setup`, mirroring `login`.
- [ ] **M9** — `CADDY_PORT`/`PUBLIC_BASE_URL` defaults inconsistent: compose/Caddy default to `8081`, `env.example` sets `9090`, `PUBLIC_BASE_URL` points at `8765` (internal API port). Pick one host port; make all three agree; set `PUBLIC_BASE_URL` to Caddy-exposed URL.

---

## LOW / Code Smells

- [ ] **L1** — N+1 queries in transaction listing (`_to_response` runs 5 sub-queries per row; `list_splits` same shape). Consider batched `selectinload`/joined loads.
- [x] **L2** — Backend container runs as root in `backend/Dockerfile`. Add non-root `USER`.
- [ ] **L3** — `opening_balance` is additive: two opening-balance transactions on one account stack. Consider a "≤1 non-deleted opening_balance per account" guard.
- [ ] **L4** — No rate limiting on auth/imports (NFR-6); no `/ready` or `/metrics` (TDD §4.12); CORS middleware unimplemented (moot for same-origin, but TDD §4.11 cites it — note as deferred).
- [ ] **L5** — `test_expense_calculator.py` is dead/failing (see H1).

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
- [ ] **D9** — Remove or fix broken `expense_calculator.py` (see H1) — don't leave a broken twin of the SQL view.
- [ ] **D10** — `TransactionForm`'s `initial?: any` prop (line 14) — replace `any` with the proper type.

---

## TDD Drift (decisions needed)

- [x] **T1** — `opening_balance` as a 4th transaction type contradicts the "three types only" principle in `CLAUDE.md` and `TDD.md`. **Resolved (2026-06-04):** legitimized in TDD v3.1 and `CLAUDE.md`; decision logged.
- [x] **T2** — Dashboard sub-queries are sequential despite TDD §4.14 saying they should be parallelized. **Accepted as-is:** `asyncio.gather` cannot safely share one `AsyncSession`; true parallelism requires one session-per-coroutine with added connection-pool pressure. Not worth the complexity at current scale. TDD §4.14 is aspirational and will be noted as deferred.
- [ ] **T3** — CORS and rate-limiting gaps vs. TDD §4.11/§4.12.
  - **CORS:** genuinely moot — frontend and API share the same Caddy origin in all deployment topologies; no cross-origin request is ever issued. Note as N/A in TDD.
  - **Rate limiting on auth/imports:** genuinely missing. Low risk behind a tunnel, but still a gap vs. spec. Tracked as L4.
