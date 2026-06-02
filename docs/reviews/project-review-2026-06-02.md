# Kanakku — Full Project Review

**Date:** 2026-06-02
**Reviewer:** Claude (Opus 4.8), full-codebase pass
**Scope:** Backend, Frontend, Infra/Deployment, TDD-vs-implementation drift, UI/UX, docs & code cleanup.
**Method:** Read `docs/tdd.md`, `docs/decisions/log.md`, `docs/context/*`, `docs/todo.md`, then read source across `backend/app/**`, `frontend/src/**`, `infra/**`. Cross-checked against the prior [bug-review.md](bug-review.md) (2026-05-27).

> **How to read this:** Severity is **CRITICAL** (core feature broken / data loss in normal use) → **HIGH** → **MED** → **LOW/cleanup**. Each item has a file reference, the concrete impact, and a suggested fix. Section 11 maps findings back to your six asks. Section 12 is a prioritized punch-list.

---

## 1. Executive Summary

The project is in strong shape: 14 milestones complete, ~460 backend tests, a coherent domain model, and a prior bug-review whose HIGH items were genuinely fixed. The architecture is sound. The issues below cluster in three areas:

1. **A few production-only breakages** that don't show up in dev/tests — most importantly the **background worker only registers the purge job**, so PDF import and data export silently never run once Redis is in the loop.
2. **The "net expense" core principle (FR-7.9/7.10) is not actually reflected in any reported number.** The logic exists in an isolated service (now itself broken by migration 0026), but the dashboard sums gross amounts.
3. **The infra is wired to one specific external-tunnel topology**, which conflicts with the "runs anywhere with env-only changes, identical Pi 5 ↔ VPS" goal and makes a clean `docker compose up` fail on a fresh host.

| Severity | Count | Headline items |
|---|---|---|
| CRITICAL | 2 | Worker missing import/export jobs; net-expense never applied in reports |
| HIGH | 4 | `expense_calculator` broken by 0026; external proxy network blocks fresh deploy; no auto-migrations; Caddy TLS story incoherent |
| MED | 9 | Read-only role unused; weak SQL user_id guard; stale Reports schema panel; Vite proxy port; light-theme form on dark UI; split two-step create; chip-only pickers; setup session row; CADDY_PORT/PUBLIC_BASE_URL drift |
| LOW / cleanup | 12+ | Stale `DEV_MODE_SETUP.md`; dev-email mismatch; half-removed LLM/GPay; no rate-limit/CORS/ready/metrics; root in Docker; N+1 queries; dead tests |

Nothing here blocks single-user local use today **if** you run via the full Docker stack with the proxy network present and trigger migrations manually. The fixes are mostly small and high-leverage.

---

## 2. CRITICAL findings

### C1 — Background worker never runs PDF import or export jobs in production
**Files:** [infra/docker-compose.yml:81](../infra/docker-compose.yml#L81), [backend/app/workers/purge_worker.py:120-127](../backend/app/workers/purge_worker.py#L120-L127), [backend/app/routers/imports.py:70-79](../backend/app/routers/imports.py#L70-L79)

The worker container runs:
```yaml
command: python -m arq app.workers.purge_worker.WorkerSettings
```
`WorkerSettings.functions = [purge_soft_deleted]` — that is the **only** registered job. But `process_pdf_import` ([import_worker.py](../backend/app/workers/import_worker.py)) and `export_archive` ([export_worker.py](../backend/app/workers/export_worker.py)) are enqueued by name from the API:
```python
await redis_pool.enqueue_job("process_pdf_import", ...)   # imports.py
```
The upload handler has an **inline fallback only on enqueue failure** (Redis unreachable). In production Redis *is* reachable, so the enqueue succeeds, the job lands on the queue, and the worker — which has no `process_pdf_import` registered — can never execute it. The batch stays `pending` forever; the user sees a spinner that never resolves. Same for `POST /export`.

This is invisible in tests (they call the function directly or hit the Redis-down inline path) and in MSW-mock dev. It only bites on the real Pi 5 / VPS stack.

**Fix:** Create one unified `WorkerSettings` (e.g. `app/workers/settings.py`) with `functions = [purge_soft_deleted, process_pdf_import, export_archive]` and the purge cron, and point the compose `command` at it. Add a smoke test that asserts every name passed to `enqueue_job(...)` is present in `WorkerSettings.functions`.

### C2 — "Net expense" (FR-7.9/7.10) is never applied to any reported figure
**Files:** [backend/app/routers/dashboard.py:137-160](../backend/app/routers/dashboard.py#L137-L160) (`_monthly_totals`), [dashboard.py:254-296](../backend/app/routers/dashboard.py#L254-L296) (`_category_breakdown`)

`CLAUDE.md` lists this as a *"never violate"* principle:
> FR-7.9: Net expense for splits = user_own_share + forgiven_shares only. Pending shares do not reduce reported expense.
> FR-7.10: Settlement income transactions are not counted as "income" in reports.

The dashboard field is even named `total_spent_net`, but `_monthly_totals` is a plain `SUM(amount)` over all expense rows and a plain `SUM(amount)` over all income rows. Consequences:

- A ₹4,000 dinner you split 4 ways is reported as ₹4,000 spent, not your ₹1,000 net share.
- When friends pay you back, those settlement-income transactions **are** counted as income (inflating income and the savings rate), violating FR-7.10.
- `_category_breakdown` likewise attributes the full split amount to the category.

The intended logic lives in [`expense_calculator.net_expense()`](../backend/app/services/expense_calculator.py) and the `transaction_with_net_amount` SQL view (migration 0010/0026), but **neither is referenced by the dashboard** (see C3 — the service is also broken). So the headline principle is effectively unimplemented end-to-end.

**Fix:** Drive the dashboard's spend/income/category/cash-flow aggregates off the `transaction_with_net_amount` view (it was updated correctly in 0026), and exclude settlement-linked income (income transactions referenced by `split_share_settlements`) from the income total. Add an integration test asserting a split expense contributes only the net share to `total_spent_net`.

---

## 3. HIGH findings

### H1 — `expense_calculator.net_expense()` is broken by migration 0026
**File:** [backend/app/services/expense_calculator.py:36-43](../backend/app/services/expense_calculator.py#L36-L43)

```python
select(Split).where(Split.expense_transaction_id == transaction_id, ...)
```
Migration 0026 **dropped** `splits.expense_transaction_id` and removed the attribute from the `Split` model (replaced by the `split_expenses` join table). `Split.expense_transaction_id` no longer exists, so this raises `AttributeError` the moment the function is called. It's currently only reachable from `test_expense_calculator.py` (which fails), so it's *dead-but-broken* code — but it's the canonical implementation of C2, so fixing C2 means fixing this first.

This is a **regression** of prior-review item HIGH-3 (marked ✅ fixed on 2026-05-27, then broken by 0026 on 2026-06-02). The 0026 change updated the SQL view but not the Python twin.

**Fix:** Rewrite the lookup to go through `SplitExpense` (join `split_expenses` on `transaction_id`), or delete the service and rely solely on the SQL view. Either way, re-point/rewrite `test_expense_calculator.py`.

### H2 — Compose is hardwired to an external proxy network → clean `docker compose up` fails
**Files:** [infra/docker-compose.yml:103-136](../infra/docker-compose.yml#L103-L136), [infra/env.example:13-14](../infra/env.example#L13)

```yaml
networks:
  proxy-nw:
    external: true
    name: ${PROXY_NETWORK:-my-example-proxy-nw}
```
On any host that hasn't already created that external network, compose aborts:
`network <name> declared as external, but could not be found`. The `make up` quick-start (`docker compose up -d`) does not create it, and no doc step does either. This directly undercuts the project's stated goal — *"run it locally/dev with ease, and on a Pi 5 with ease; VPS identical to Pi 5, env-only changes"* (NFR-1.1/1.2). A first-time clone-and-run on a clean Pi/VPS/laptop will not start.

It's clearly intentional for *your* tunnel topology (Cloudflare/Tailscale container on a shared network), but that coupling shouldn't live in the base file that's supposed to be portable.

**Fix:** Move the `proxy-nw` network + Caddy's attachment to it into a **separate override** (e.g. `docker-compose.tunnel.yml`) opted in with `-f`. Keep the base file self-contained (Caddy publishes its port on the host). Alternatively, document a required `docker network create $PROXY_NETWORK` step prominently in the quick-start and Makefile.

### H3 — No automatic database migrations on deploy
**Files:** [backend/Dockerfile:29](../backend/Dockerfile#L29), [backend/app/main.py:27-31](../backend/app/main.py#L27-L31), [infra/Makefile:64-65](../infra/Makefile#L64)

The API image's `CMD` is uvicorn; the lifespan hook only runs `seed_dev_data()` when `DEV_MODE=true`. Nothing runs `alembic upgrade head` on startup. A fresh production bring-up (`make prod-up`) therefore starts the API against an **empty schema** until someone remembers `make migrate`. For a "self-host with ease" product this is an easy-to-miss footgun, and on a Pi the first request will 500 confusingly.

**Fix:** Add an entrypoint that runs `alembic upgrade head` before launching uvicorn (guarded so only one of api/worker does it, or make it idempotent/locked), or a dedicated one-shot `migrate` service that the api `depends_on: { condition: service_completed_successfully }`. Document either way.

### H4 — Caddy/TLS story is incoherent vs. the comments and NFR-6.4
**File:** [infra/Caddyfile:20](../infra/Caddyfile#L20), [infra/Caddyfile:1-10](../infra/Caddyfile#L1-L10)

The site address is `http://{$PUBLIC_DOMAIN:localhost}:{$CADDY_PORT:8081}` — explicit `http://` + custom port means Caddy serves **plain HTTP only** and never provisions certificates. Yet the header comment says *"Production: PUBLIC_DOMAIN=… → auto HTTPS (Let's Encrypt)"*, and only `CADDY_PORT` is published (no `80`/`443`), so ACME could not work even if enabled. In practice TLS is expected to be terminated by the external tunnel (H2), which is a fine design — but the in-file documentation promises something the config can't deliver, and the "deploy to a VPS and get HTTPS" path from the README is not actually wired.

**Fix:** Either (a) commit to tunnel-terminated TLS and rewrite the Caddyfile comments + README to say Caddy is HTTP-only behind the tunnel; or (b) add a real `https://{$PUBLIC_DOMAIN}` block publishing 80/443 for the standalone-VPS case, selected by env. Don't leave both stories half-present.

---

## 4. MEDIUM findings

### M1 — The "read-only role" is dead by default; the query endpoint runs with full privileges
**Files:** [backend/app/config.py:9,21-25](../backend/app/config.py#L21-L25), [backend/app/db/session.py:18-22](../backend/app/db/session.py#L18), [infra/env.example](../infra/env.example) (no `READONLY_DATABASE_URL`)

`readonly_database_url` silently defaults to `database_url`, and `env.example` never sets a separate one. So `get_readonly_engine()` connects as the **same full-privilege role** as the rest of the app. The `app_readonly` Postgres role created in migration 0017 is never used. The only thing protecting `POST /reports/query` is `SET TRANSACTION READ ONLY` + the sqlglot SELECT-only check — the dedicated least-privilege role from TDD §4.11 is not in effect.

**Fix:** Provision `app_readonly` with a password in the DB init, add `READONLY_DATABASE_URL` to `env.example` pointing at that role, and fail fast (or warn loudly) if it equals `DATABASE_URL` in non-dev.

### M2 — `user_id` enforcement on the SQL query endpoint is bypassable
**File:** [backend/app/routers/reports.py:52-59](../backend/app/routers/reports.py#L52-L59)

Validation only checks that *a column named `user_id` appears somewhere* in the AST. `SELECT * FROM transactions WHERE user_id = :user_id OR 1=1` passes the check and returns every user's rows. Single-user deployments are unaffected (one user), but TDD says "schema supports multi-user from day one" and this is the documented isolation boundary, so it's a latent multi-user data leak.

**Fix:** This is hard to do robustly via AST surgery. The right defense is RLS (already on your post-v1 list) or the dedicated read-only role scoped per-user; at minimum, document that the endpoint is *not* a hard multi-tenant boundary.

### M3 — Reports schema-reference panel is stale and partly wrong
**File:** [backend/app/routers/reports.py:120-363](../backend/app/routers/reports.py#L235-L260)

The schema browser users rely on to write SQL no longer matches the DB:
- `splits.expense_transaction_id` is listed but was **dropped** in 0026; `split_expenses` is **missing**.
- `split_shares.settled_at`, `settlement_transaction_id`, `forgiven_at` are listed but were **dropped** in 0024; `forgiven_amount` and the `split_share_settlements` table are **missing**.
- `transactions` lists `transacted_at` **twice** and is missing `external_ref`; the `type` description omits `opening_balance`.
- `accounts.type` claims `wallet, investment` — the enum is only `bank, cash, credit_card, loan` ([account.py:12-16](../backend/app/models/account.py#L12-L16)).
- `budgets.type` says `one_time, recurring` (actual: `recurring, adhoc`) and `period` lists `custom` (actual: `daily/weekly/monthly/quarterly/yearly`); missing `activated_at`, `parent_budget_id`, `is_modified_instance`.

A user querying `splits.expense_transaction_id` from the starter panel gets a SQL error. Since the SQL/reports surface is a headline feature, this materially hurts it.

**Fix:** Regenerate `_SCHEMA` from the live models (or `information_schema`) so it can't drift, and add a test that every advertised column exists.

### M4 — Vite dev proxy targets the wrong backend port
**File:** [frontend/vite.config.ts:59-65](../frontend/vite.config.ts#L59-L65)

```ts
proxy: { '/api': 'http://localhost:8000' }
```
The backend listens on **8765** everywhere (Dockerfile, compose, healthcheck, the override's `8765:8765`). So `bun run dev` against a locally-run uvicorn proxies to a dead port. The comment also references `VITE_MOCK_API` while the actual flag is `VITE_DEV_MODE`/`VITE_MOCK_API` split (see dev-mode.ts).

**Fix:** Point the proxy at `http://localhost:8765` and refresh the comment.

### M5 — Light-theme form classes on a dark-themed app (primary entry surface)
**File:** [frontend/src/components/forms/TransactionForm.tsx](../frontend/src/components/forms/TransactionForm.tsx) (e.g. labels `text-gray-700`, inputs `bg-white border-gray-300`)

The app is dark (`base.css` bg `#09090b`, drawers use `bg-surface-1`/`text-fg`, PWA `background_color: #09090b`), but the most-used screen — the transaction form — hardcodes light Tailwind utilities (`bg-white`, `text-gray-700`, `text-gray-600`, `border-gray-300`) and mixes in a few design tokens (`text-fg-faint`, `bg-accent/20`). Result: dark-gray labels on a near-black background (low contrast) and white input fields that fight the surrounding dark chrome. It's inconsistent with the drawer/detail components that were migrated to tokens.

**Fix:** Migrate the form (and any sibling forms still on hardcoded grays) to the `fg`/`surface`/`border` design tokens already defined in `base.css`/`theme.css`.

### M6 — Split creation is a non-atomic two-step from the form
**File:** [frontend/src/components/forms/TransactionForm.tsx:153-163](../frontend/src/components/forms/TransactionForm.tsx#L153-L163)

The form first creates the transaction, then issues a second `POST /splits` with the returned id. If the split call fails (validation, network), the transaction is already persisted and there's no rollback — the user gets a generic "Failed to save" and, on retry, creates a **duplicate** expense. The upfront-split path (FR-7.4) should be atomic.

**Fix:** Add an upfront-split server path that creates the expense + split in one transaction (or have the client clean up / link to the just-created txn on retry instead of re-creating).

### M7 — Categories / Tags / Budgets are flat chip lists with no search or inline-create
**File:** [frontend/src/components/forms/TransactionForm.tsx:316-418](../frontend/src/components/forms/TransactionForm.tsx#L316-L418); tracked in [docs/todo.md:570-575](todo.md#L570)

Every category, tag, and budget renders as an inline wrap of toggle chips. With a realistic 20–40 categories this becomes a wall of chips, there's no type-ahead, and (unlike Payee) **no inline create** for categories/tags — so adding a category mid-entry means leaving the form. Your own todo backlog already flags this. It also auto-overwrites manually-chosen categories whenever the payee or the payees array reference changes ([TransactionForm.tsx:90-96](../frontend/src/components/forms/TransactionForm.tsx#L90-L96)).

**Fix:** Replace with the existing `Autocomplete` (multi-select variant) + inline-create, matching the payee field. Only apply payee default categories when the user hasn't already chosen any.

### M8 — `POST /auth/setup` issues tokens but stores no session row
**File:** [backend/app/routers/auth.py:51-70](../backend/app/routers/auth.py#L51-L70) vs. [auth.py:159-179](../backend/app/routers/auth.py#L159-L179)

`login`, `accept-invite`, and `dev-login` all persist a `Session` row for the refresh token; `setup` does not. So the very first user's refresh token has no matching session, and the first `POST /auth/refresh` after the 24 h access token expires returns `401 Session not found or revoked`, forcing a re-login on the brand-new account.

**Fix:** Add the `SessionModel(...)` insert in `setup`, mirroring `login`.

### M9 — `CADDY_PORT` / `PUBLIC_BASE_URL` defaults are inconsistent
**Files:** [infra/docker-compose.yml:107](../infra/docker-compose.yml#L107) & [infra/Caddyfile:20](../infra/Caddyfile#L20) (default `8081`) vs. [infra/env.example:11](../infra/env.example#L11) (`CADDY_PORT=9090`) and [env.example:8](../infra/env.example#L8) (`PUBLIC_BASE_URL=http://localhost:8765`)

Three different "front door" values float around: compose/Caddy default to `8081`, `env.example` sets `9090`, and `PUBLIC_BASE_URL` points at `8765` (the *internal* API port, not the Caddy-exposed one the browser actually uses). Confusing for first-run and for anything that echoes `PUBLIC_BASE_URL` (invite links, etc.).

**Fix:** Pick one host port, make all three agree, and set `PUBLIC_BASE_URL` to the Caddy-exposed URL.

---

## 5. LOW findings & code smells

- **L1 — N+1 queries in transaction listing.** [`_to_response`](../backend/app/routers/transactions.py#L130-L143) runs 5 sub-queries per row (categories, tags, budgets, payment-method name, split id); a 50-row page ≈ 250+ round-trips. Bounded by pagination so fine now, but it's the kind of thing NFR-7.1 cares about at 100K txns. `list_splits` ([splits.py:416-437](../backend/app/routers/splits.py#L416)) has the same shape. Consider batched `selectinload`/joined loads.
- **L2 — Backend container runs as root** ([backend/Dockerfile](../backend/Dockerfile)) — add a non-root `USER`.
- **L3 — `opening_balance` is additive** ([transactions.py:152-156](../backend/app/routers/transactions.py#L152)) — two opening-balance txns on one account stack. Prior review MED-3 accepted this; consider a "≤1 non-deleted opening_balance per account" guard.
- **L4 — No rate limiting** on auth/imports (NFR-6 "rate limiting on auth and imports"); **no `/ready` or `/metrics`** (TDD §4.12); **no CORS middleware** (the bundled same-origin design means it's genuinely unnecessary, but the TDD's "CORS limited to PUBLIC_BASE_URL" line is unimplemented — note it's moot, not missing).
- **L5 — Dead/failing tests**: `test_expense_calculator.py` (H1).

---

## 6. Infra & deployment assessment (Pi 5 ↔ VPS)

What's good: single compose file with a clean dev `override.yml`; resource `limits` tuned for a Pi (db 1g / api 512m / etc.); healthchecks; `restart: unless-stopped`; relative `/api/v1` base URL in the frontend (so the same image works at any hostname — nice). `postgres:16` and `redis:7-alpine` are multi-arch and run on arm64.

What undercuts the "identical, env-only, runs anywhere" goal:
1. **External `proxy-nw` network** (H2) — breaks clean bring-up; bakes one tunnel topology into the base file.
2. **No auto-migrations** (H3) — manual step between deploy and a working app.
3. **TLS story** (H4) — the "VPS gets HTTPS automatically" path isn't actually wired; it depends on an unstated external tunnel.
4. **Ollama decoupled from compose** (intended — see §7) means the TDD's Pi-5 RAM budget table (which reserved ~1.5 GB for Ollama) no longer matches reality; the stack is *lighter* than budgeted, which is fine, but the docs still claim Ollama is a compose service.
5. **`deploy.resources.limits`** is honored by `docker compose` v2, so OK — but `reservations` aren't, so don't rely on them later.
6. Two web servers (nginx inside the frontend image **and** Caddy in front). Works, but on a RAM-tight Pi you could drop the nginx layer and have Caddy `file_server` the built assets from a shared volume — one fewer container/image. Optional simplification.

Net: the **identical Pi-5/VPS** principle mostly holds (same images, env-driven), but the three items above mean a brand-new host does **not** come up with `make up` alone. Closing H2/H3/H4 restores the "clone → env → up" promise.

---

## 7. TDD-vs-implementation drift

These are deviations from `docs/tdd.md`. You flagged that a handful are expected; categorized accordingly.

**Expected / accepted (you already know):**
- **LLM "removed":** Ollama decoupled from compose; `LLM_BACKEND` defaults to `none`. The LLM *code* (`app/llm/*`) and the **Settings → LLM Activity** page still ship, so it's a *half-removal* — no model ever runs by default, but the UI/endpoint remain (see §8 cleanup).
- **GPay enrichment removed:** FR-12 / §3.3.12 fully described in the TDD, but the router/service/model/frontend pages are gone. Migration `0016_gpay_matches` and many doc references remain (history is fine; live docs aren't — §8).
- **Splits model evolved:** single `expense_transaction_id` → `split_expenses` join (multi-expense); single settlement FK → `split_share_settlements` (multi-payment) + `forgiven_amount` (partial forgiveness). Well-logged in decisions.
- **`opening_balance` as a 4th transaction type** — TDD says "three types only" and CLAUDE.md repeats it as a principle. Pragmatic, but the principle text and TDD should be updated to legitimize it (or move opening balance off the transaction enum, since it's also an `accounts` column).

**Unexpected drift (worth a decision):**
- **FR-7.9/7.10 not wired into reports** (C2) — the *single most important* split principle isn't reflected in any number the user sees.
- **Read-only query role not actually used** (M1) vs. TDD §4.11.
- **No `/ready`, `/metrics`, rate limiting** vs. TDD §4.12 / §4.11.
- **Dashboard isn't "parallelized server-side"** — TDD §4.14 says dashboard sub-queries are parallelized; [dashboard.py:742-743](../backend/app/routers/dashboard.py#L742) explicitly runs them sequentially (correctly noting asyncio.gather can't share one session). Fine, but it's a documented-vs-actual gap; if you want the perf, use a connection pool + gather.

---

## 8. Docs & code cleanup

**Stale docs (fix or delete):**
- **`DEV_MODE_SETUP.md` (repo root) — entirely stale.** It documents a `.dev-config.yml` + preset system that *was never shipped* (confirmed in [decisions/log.md 2026-05-23](decisions/log.md)), an `X-Dev-User-ID` auth-bypass header that **does not exist** in the code (the real mechanism is `HTTPBearer(auto_error=False)` + no-token fallback in [dependencies.py](../backend/app/dependencies.py)), and the wrong dev email. The `curl -H "X-Dev-User-ID: …"` example will not work. Rewrite to match the real `DEV_MODE`/`/auth/dev-login` flow and move it under `docs/`.
- **Dev-user email mismatch:** seed is `dev@kanakku.com` ([dev_seed.py:40](../backend/app/dev_seed.py#L40)), but `DEV_MODE_SETUP.md` and the `env.example` comment ([env.example:48](../infra/env.example#L48)) say `dev@kanakku.local`. Anyone following the docs can't log in.
- **`infra/load-dev-config.py`** reads a `.dev-config.yml` that doesn't exist — either ship the file, or delete the script and the doc that references it.
- **TDD/`docs/*` still describe Ollama-in-compose and GPay as live features.** Add a short "v1 deviations" note at the top of `tdd.md` pointing at this review + the decision log, rather than rewriting the whole spec.
- **`docs/running.md:79`** still references `app.worker.WorkerSettings` (old path) — already fixed in compose per [docker-crud-fixes.md](bugfixes/docker-crud-fixes.md) but the doc lagged.
- **Consolidate the bug-tracking docs.** `docs/bug-review.md` + `docs/bugfixes/*` + `docs/testing-plan.md` are point-in-time artifacts. Consider an `docs/reviews/` folder (this report included) and archive the rest, so the "current truth" is obvious.

**Code cleanup:**
- **Decide LLM's fate.** If LLM stays deferred, hide the Settings → LLM Activity entry behind `LLM_BACKEND != none` so users don't see a feature that never produces data; if it's gone, remove `app/llm/*`, the `llm_activity_logs` surface, and the `match_gpay_to_bank` method.
- **Remove the broken `expense_calculator` or fix it** (H1) — don't leave a broken twin of the SQL view.
- `frontend/.env.local.bak` is an untracked stray ([git status]) — delete it.
- `TransactionForm`'s `initial?: any` ([line 14](../frontend/src/components/forms/TransactionForm.tsx#L14)) — type it.

---

## 9. Security notes (single-user lens)

Given the single-user, self-hosted, behind-a-tunnel reality, the security posture is acceptable, but for the record vs. TDD §4.11/§2.2.6:
- argon2id + JWT rotation: ✅ implemented well; `refresh` correctly rotates and revokes.
- Read-only role not enforced (M1); per-user SQL guard bypassable (M2).
- No rate limiting on auth/imports (L4) — brute-force possible if ever exposed without a tunnel.
- `DEV_MODE=true` turns the whole instance anonymous (no-token ⇒ seed user). Fine for dev; ensure it can never be true in a network-exposed deploy. Consider a startup hard-fail if `dev_mode and not localhost-ish DATABASE_URL`.
- `JWT_SECRET` defaults to `"change-me-in-production"` in [config.py:11](../backend/app/config.py#L11) with no guard — add a startup assertion that it's been changed when `debug=false`.

---

## 10. What the prior bug-review got right (and what regressed)

The 2026-05-27 [bug-review.md](bug-review.md) was high quality and its HIGH/MED fixes hold up in the current code (api-client single-flight refresh, `_set_joins` budget preload, confirm status-filter, logout ownership, etc. — all verified present). Two things to flag:
- **HIGH-3 regressed** via migration 0026 (H1 above) — the partial-forgiveness fix landed, then the split-multi-expense refactor broke the same file by not updating its `Split.expense_transaction_id` reference.
- That review **scoped itself to "code-level bugs"** and didn't look at wiring/topology, so it missed C1 (worker registration), C2 (net-expense never reaching the dashboard), and the infra items — which is where the current highest-impact issues are.

---

## 11. Mapping to your six asks

1. **FE/BE bugs:** C1, C2, H1, M3, M4, M6, M8, L1, L5 (+ prior review's fixed set holds).
2. **Infra bad patterns (Pi 5 / VPS / local parity):** H2 (external network), H3 (no auto-migrate), H4 (TLS), M9 (port drift), §6 (nginx+Caddy duplication, Ollama budget doc), L2 (root container).
3. **UI/UX concerns:** M5 (light form on dark UI), M6 (split duplicate-on-retry), M7 (chip pickers, no search/inline-create), plus currency free-text & payee-overwrites-categories in §4/M7.
4. **TDD deviations:** §7 — expected (LLM/GPay/splits/opening_balance) and unexpected (net-expense not wired, read-only role unused, observability/rate-limit gaps).
5. **Other concerns / simplifications:** §5, §6 (drop nginx), §9 (JWT secret guard, dev-mode guard), N+1 batching.
6. **Cleanup (docs & code):** §8 — stale `DEV_MODE_SETUP.md`, dev-email mismatch, half-removed LLM/GPay, `.env.local.bak`, broken calculator, doc consolidation.

---

## 12. Prioritized punch-list

**Do first (correctness / breaks in prod):**
1. **C1** — unified `WorkerSettings` with all three jobs; wire compose; add the enqueue-name guard test.
2. **C2 + H1** — fix/rewrite `net_expense` (or use the view) and drive dashboard spend/income/category off net amounts; exclude settlement income.
3. **H3** — run `alembic upgrade head` automatically on deploy.

**Do next (portability / first-run):**
4. **H2** — move `proxy-nw` to a tunnel override; keep base compose self-contained.
5. **H4 + M9** — pick the TLS story, align ports, fix Caddyfile comments + README.
6. **M4** — Vite proxy → 8765.

**Then (UX + integrity):**
7. **M8** — session row on setup. **M6** — atomic upfront split. **M5/M7** — form theming + searchable/inline-create pickers.
8. **M1/M2** — real read-only role + document the SQL boundary.
9. **M3** — auto-generate the Reports schema panel from models.

**Cleanup (low-risk, high-clarity):**
10. §8 doc fixes — rewrite/relocate `DEV_MODE_SETUP.md`, fix dev email everywhere, decide LLM/GPay removal, delete `.env.local.bak`, consolidate review docs.

---

*Generated 2026-06-02. References use paths relative to `docs/`. No code was modified as part of this review.*
