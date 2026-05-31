# Bug Review — Frontend & Backend

Date: 2026-05-27
Scope: code-level bugs only. Items that look intentional but diverge from `tdd.md` are listed at the bottom under **Possible spec/code drift** so you can decide whether the TDD or the code is the source of truth now.

Severity legend:
- **HIGH** — silently corrupts data, breaks a documented flow, or has a real chance of triggering in normal use.
- **MED** — wrong/unsafe behavior in a real-but-narrower scenario, or UX regression.
- **LOW** — code smell, dead code, fragile but currently working.

---

## Backend

### HIGH-1. PATCH /transactions wipes budget links when only categories or tags change
[backend/app/routers/transactions.py:438](../backend/app/routers/transactions.py#L438)

```python
await _set_joins(
    txn.id,
    body.category_ids if body.category_ids is not None else existing_cats,
    body.tag_ids      if body.tag_ids      is not None else existing_tags,
    body.budget_ids   if body.budget_ids   is not None else [],   # ← always [] when omitted
    session,
)
```

`existing_cats` / `existing_tags` are preloaded for the omit-case, but the budget branch falls back to `[]`. Any PATCH that includes `category_ids` or `tag_ids` without an explicit `budget_ids` will silently strip every budget link from the transaction. Fix: preload `existing_budgets` and use it as the fallback (mirror the cats/tags pattern).

### HIGH-2. PATCH /transactions cannot clear nullable fields
[backend/app/routers/transactions.py:401](../backend/app/routers/transactions.py#L401)

```python
patch_data = body.model_dump(
    exclude_none=True, exclude={"category_ids", "tag_ids", "budget_ids"}
)
```

`exclude_none=True` makes it impossible to unset `payee_id`, `payment_method_id`, `to_account_id`, `to_amount`, `to_currency`, `notes`, `external_ref`, or `subscription_id` once they have a value. Combined with [transactions.py:407–411](../backend/app/routers/transactions.py#L407-L411): if a user PATCHes `type` from `transfer` → `expense`, they cannot also null `to_account_id` in the same call, so the request is rejected with 422. There is no way to convert a transfer back to an expense via the API. Use Pydantic's "unset vs none" distinction (`exclude_unset=True` + sentinel handling), not `exclude_none=True`.

### HIGH-3. Partial forgiveness silently dropped from net-expense
[backend/app/services/expense_calculator.py:44-54](../backend/app/services/expense_calculator.py#L44-L54)

The net-expense query sums `SplitShare.amount` for shares where `payee_id IS NULL` **or** `status == 'forgiven'`. A share that is *partially* forgiven (forgiven_amount > 0 but < amount, and is later partly settled) has `status = settled` in `_derive_status` ([routers/splits.py:30-33](../backend/app/routers/splits.py#L30-L33)). The settled status means the entire share is excluded from net expense, even though `forgiven_amount` was always meant to count per FR-7.9. Fix: net expense should also add `SUM(forgiven_amount)` over all non-own shares (instead of using status alone). The `forgiven_amount` column exists but is currently never read for the expense calculation.

### HIGH-4. Export archive omits `split_share_settlements`
[backend/app/workers/export_worker.py:71-76](../backend/app/workers/export_worker.py#L71-L76)

The export emits `splits` and `split_shares` but never `split_share_settlements`. On a self-host restore, every settled share will look unsettled because the join rows are gone — `paid_amount` reverts to 0 and shares flip back to `pending`. Add a table entry similar to `split_shares`.

### HIGH-5. `confirm_records` re-imports already-confirmed/rejected records when `record_ids` is provided
[backend/app/routers/imports.py:180-204](../backend/app/routers/imports.py#L180-L204)

When the client passes explicit `record_ids`, the query filter is `RawImportRecord.id.in_(record_ids)` with no status filter. Records that are already `confirmed` or `rejected` slip through and are converted into new `Transaction` rows (with new `transaction_id` overwriting the previous link on the record). Two real consequences: duplicate transactions in the ledger, and the original `confirmed → Transaction` link is silently swapped. Fix: always also constrain `RawImportRecord.status.in_([pending, duplicate])`.

### HIGH-6. `_record_to_transaction` silently drops records with no `batch.account_id`
[backend/app/routers/imports.py:290-291](../backend/app/routers/imports.py#L290-L291)

If a batch was uploaded without `account_id`, `_record_to_transaction` returns `None`, the record's status is left as `pending`, and `confirmed_count` does not increment. The caller sees a 200 response with `total_confirmed` unchanged and no error. The UI has no signal that confirm failed. Either reject the confirm at the boundary (422) or require `account_id` on upload.

### HIGH-7. Purge worker will crash when accounts/categories are still referenced
[backend/app/workers/purge_worker.py:43-49](../backend/app/workers/purge_worker.py#L43-L49)

`Account` is purged with `sa.delete(...)`; `Transaction.account_id` and `Transaction.to_account_id` both use `ondelete="RESTRICT"`. If an account was soft-deleted >30 days ago but any (even soft-deleted) transaction still references it, the DELETE raises and the entire purge transaction rolls back. Same risk exists for `Category` (`transaction_categories.ondelete=CASCADE` is fine, but `Subscription.category_id` is `ON DELETE SET NULL`, so that's OK — Account is the real issue). Either purge transactions first (the model order already starts with Transaction, so that helps), or hard-delete child transactions cascade-first explicitly, or short-circuit if children still exist.

### HIGH-8. `delete_account` does not check for live transactions
[backend/app/routers/accounts.py:105-113](../backend/app/routers/accounts.py#L105-L113)

A soft-deleted account still owns its transactions. Combined with HIGH-7 above this means soft-deleting an account and waiting 30 days throws an error in the purge job — but more immediately, the user can keep creating transactions referencing a soft-deleted account because the `_get_account_or_404` lookup in transactions filters by `deleted_at.is_(None)` only on the *fetch* helper; the FK itself is satisfied. Result: the account appears in "recently deleted" but still has live transactions writing balances against it (writes go through ORM `setattr` on `account.current_balance` after re-fetching by id without the deleted check in `_apply_transfer_balances`). Actually `_get_account_or_404` does filter deleted, so this is contained at the transaction-create path — but the integrity question remains: deleting an account whose balance is non-zero leaves the data inconsistent. Suggest blocking delete when non-deleted transactions exist (or warn + cascade soft-delete).

### HIGH-9. `account.opening_balance` patch does not reconcile `current_balance`
[backend/app/routers/accounts.py:90-102](../backend/app/routers/accounts.py#L90-L102)

`patch_account` `setattr`s every field from the body, including `opening_balance`, but never updates `current_balance` to reflect the new opening. The account's current balance is now stale — equal to the old opening_balance plus net of all txn deltas. Fix: when opening_balance changes by ΔX, also add ΔX to current_balance.

### MED-1. `forgive_share` overwrites rather than accumulates
[backend/app/routers/splits.py:548-549](../backend/app/routers/splits.py#L548-L549)

`share.forgiven_amount = body.amount` — the API docs string in `splits.ts:71` calls this out ("SET the forgiven_amount"), so this is *intended* set-semantics, but it's surprising: calling `forgive(50)` then `forgive(100)` ends at 100 forgiven, not 150. There is no read-modify-write helper or PATCH-style alternative. Document explicitly or rename to `set_forgiven`.

### MED-2. GPay match window is asymmetric
[backend/app/services/gpay_matcher.py:161-162](../backend/app/services/gpay_matcher.py#L161-L162)

```python
window_start = midnight(rec.date) - _DATE_WINDOW
window_end   = midnight(rec.date) + _DATE_WINDOW + timedelta(days=1)
```

`_DATE_WINDOW = timedelta(days=1)`. The range is `[rec.date-1 00:00, rec.date+2 00:00)`, i.e. ±1 inclusive day. That matches the spec, but the construction is confusing (`+ DATE_WINDOW + timedelta(days=1)`) and easily misread. Cosmetic — just suggest replacing with `window_end = midnight(rec.date + timedelta(days=2))` and a comment.

### MED-3. `_apply_balance_delta` skips `opening_balance` semantics
[backend/app/routers/transactions.py:149-156](../backend/app/routers/transactions.py#L149-L156)

`opening_balance` is treated as an additive credit. So creating two opening_balance txns of 1000 on the same account gives current_balance = opening_balance(field) + 2000. This is probably wrong; an `opening_balance` *transaction* should be unique per account (or at least not cumulatively additive). Suggest a constraint (at most one non-deleted opening_balance txn per account) and re-think whether current_balance should reflect it as a delta at all.

### MED-4. `balance_verifier.verify_balance` treats transfers as expenses
[backend/app/services/balance_verifier.py:24-28](../backend/app/services/balance_verifier.py#L24-L28)

Loop is `if rec.type == "income": net += amount else: net -= amount`. PDF statements often have both incoming and outgoing transfers; treating every non-income row as money-out will produce a `discrepancy` whenever a statement has incoming transfers (salary, refund, reversal). If `ParsedRecord.type` only ever produces `"income" | "expense"` (i.e., parsers normalize), this is fine — worth verifying. If a `"transfer"` value ever leaks through, the check is wrong.

### MED-5. Logout does not verify session ownership
[backend/app/routers/auth.py:130-142](../backend/app/routers/auth.py#L130-L142)

`logout` deletes any `SessionModel` whose `token_hash` matches the supplied refresh token, without checking that the session's `user_id` matches `_current_user.id`. If a refresh token of another user is somehow obtained, the authenticated user can revoke it. Low real impact (you need the token), but a `user_id` constraint adds defense-in-depth.

### MED-6. DEV_MODE auth bypass is dangerous in shared deployments
[backend/app/dependencies.py:25-31](../backend/app/dependencies.py#L25-L31)

When `settings.dev_mode` is true and no `Authorization` header is present, every request authenticates as the seed user `11111111-…`. If `DEV_MODE` leaks into a hosted environment, the entire instance becomes anonymous. The startup banner / config validation should hard-fail when `dev_mode` *and* `database_url` points at anything that looks remote, or at least loudly log on every request.

### LOW-1. `gpay.py` defines its own `_get_session` factory
[backend/app/routers/gpay.py:29-32](../backend/app/routers/gpay.py#L29-L32)

Duplicates `app.db.session.get_session`. Harmless functionally but invites drift (e.g., when the canonical factory adds connection options, this one won't follow).

### LOW-2. `gpay.py` upload handler uses `= None` defaults on dependency-injected params
[backend/app/routers/gpay.py:43-44](../backend/app/routers/gpay.py#L43-L44)

```python
current_user: UserDep = None,  # type: ignore[assignment]
session: SessionDep = None,  # type: ignore[assignment]
```

FastAPI still resolves the dependency, but the `= None` default + `# type: ignore` is a code smell and inconsistent with the other endpoints in the file. Drop the defaults.

### LOW-3. `subscription_dates.compute_next_billing_date` only advances one cycle
[backend/app/services/subscription_dates.py:90-96](../backend/app/services/subscription_dates.py#L90-L96)

If `last_billed_at` is months in the past and the cycle is daily/weekly, the returned "next due" is still just `last_billed + one cycle`, deep in the past. The docstring acknowledges this but it means the `subscription_status` "overdue" classification is correct only by accident. Consider rolling forward to the first occurrence ≥ today.

### LOW-4. `SplitSharesEditor` sums shares as float
[frontend/src/components/SplitSharesEditor.tsx:19](../frontend/src/components/SplitSharesEditor.tsx#L19)

JS float math; UI may show "Remaining: 0.00000000001" while the backend strict `Decimal` compare succeeds. Use a rounded comparison only for display (the code already uses 0.005 threshold for the badge, but not for the "Shares must sum to…" alert).

### LOW-5. Dead `error` state in `SplitSharesEditor`
[frontend/src/components/SplitSharesEditor.tsx:17,112](../frontend/src/components/SplitSharesEditor.tsx#L17)

`useState('')` is declared and cleared in three handlers, but no path ever calls `setError(...)` with a non-empty value. Remove.

---

## Frontend

### HIGH-10. No automatic refresh on 401
[frontend/src/lib/api-client.ts:14](../frontend/src/lib/api-client.ts#L14)

`apiGet/apiPost/apiPatch/apiDelete` all `throw res` on any non-ok response. The 15-minute (or whatever) access token expiry will surface as a hard error on every query/mutation after expiry, even though the refresh token in `localStorage` is still valid. Either wrap fetches with a single retry-after-refresh interceptor, or do a silent refresh on a timer. (Bootstrap-time refresh in `main.tsx` only covers cold-start.)

### HIGH-11. Split mutations don't invalidate transaction caches consistently
[frontend/src/api/splits.ts:94-153](../frontend/src/api/splits.ts#L94-L153)

Only `useBundleSplit` invalidates `['transactions']` / `['transactions-infinite']`. `useCreateSplit`, `useSettleShare`, `useUnlinkSettlement`, `useForgiveShare`, `useUnsettleShare` do not. After any of these mutations, the transaction list still shows stale `is_split=false` badges and the linked-split panel doesn't refresh in the transaction drawer. Add `qc.invalidateQueries({ queryKey: ['transactions'] })` (and `transactions-infinite`) to each.

### MED-7. `useTransactions` filters don't include `budget_id`
[frontend/src/api/transactions.ts:78-100](../frontend/src/api/transactions.ts#L78-L100)

The backend accepts `budget_id`; the client builder never sets it. Any UI that tries to filter by budget by passing `budget_id` will be silently ignored. Either add it to `TransactionFilters` and to `buildParams`, or remove the server-side filter if no UI uses it.

### MED-8. `apiDelete` calls `res.json()` on non-204 success
[frontend/src/lib/api-client.ts:38-46](../frontend/src/lib/api-client.ts#L38-L46)

If a DELETE endpoint returns 200 with no body (some FastAPI handlers do, e.g. ones returning a Pydantic model after restore), `res.json()` throws on empty content. Only the 204 path is short-circuited. Handle `204 || content-length === 0`.

### MED-9. `TransactionFormPage` calls `setDone`/`navigate` twice on create path
[frontend/src/pages/TransactionForm.tsx:23-34](../frontend/src/pages/TransactionForm.tsx#L23-L34)

The create branch sets `done`, navigates, and `return`s an `{ id }`. Then execution falls through to lines 32–33 which `setDone(true); navigate(...)` again — but only after the `return` of an object, which exits the function. So this is actually fine *today*, but the structure is brittle: any future caller that drops the early-return will hit a double-navigate. Restructure as `if (isEditing) {…} else {…}` with one trailing navigate.

### MED-10. `Link to={…} as any}` bypasses TanStack Router type safety
[frontend/src/pages/Dashboard.tsx:242](../frontend/src/pages/Dashboard.tsx#L242)

```tsx
<Link to={`/piggy-banks/${p.id}` as any} …>
```

Defeats the route param typing. If the route definition changes, this won't be flagged. Use the typed `params={{ id: p.id }}` form.

### MED-11. AuthGuard redirects on every render where token is missing
[frontend/src/components/AuthGuard.tsx:13-19](../frontend/src/components/AuthGuard.tsx#L13-L19)

`useEffect` checks `authed` — but `isAuthenticated()` is a function, not reactive state. If the access token is set/cleared elsewhere, the component does not re-render. After a token-clearing 401, the guard will not bounce the user to /login until something else triggers a re-render. Use a context-backed auth state.

### LOW-6. `Dashboard` parses numeric strings on every render
[frontend/src/pages/Dashboard.tsx:164-166,212,257,264,293](../frontend/src/pages/Dashboard.tsx#L164-L166)

Many `parseFloat(t.amount)`/`.toLocaleString` calls re-run on every render. Not a correctness bug, but on large recent-transactions lists this is wasteful. Memoize with `useMemo` over `data`.

---

## Possible spec / TDD drift (flag for review, not necessarily bugs)

These look intentional given how the code evolved, but they diverge from `tdd.md` / `docs/decisions/log.md` as worded. Decide which side to update.

- **Net-expense formula vs FR-7.9.** The TDD says net expense = `user_own_share + forgiven_shares`. The current `expense_calculator` interprets "user_own_share" as `payee_id IS NULL` and "forgiven_shares" as `status = forgiven` (binary). The data model now has `forgiven_amount Decimal` per share, allowing partial forgiveness, but `expense_calculator` ignores that column. Either drop partial forgiveness from the schema or rewrite the calculator (HIGH-3 above is the bug consequence).
- **`opening_balance` as a `TransactionType`.** TDD says three types only (expense, income, transfer); `models/transaction.py` adds a fourth, `opening_balance`. Pragmatic, but worth either updating the TDD or moving the opening balance to a non-transaction concept (it's already on `Account` as a column).
- **`is_modified_instance` on `Budget`.** The recurrence override model uses a self-FK + flag, not what the TDD describes for recurring exceptions. Looks like a reasonable evolution; document in `decisions/log.md`.
- **GPay enrichment populates `notes` instead of a separate field.** `auto_linked` matches stuff merchant info into `Transaction.notes` (overwriting only if empty). If the user had no notes, the merchant tag wins; if they had notes, the enrichment is silently dropped. Consider a dedicated `merchant` column or an `external_metadata` JSON blob.
- **Forgive endpoint is set-semantics.** The verb suggests append-semantics. See MED-1.

---

## Fix status (2026-05-27)

| Item | Status | Notes |
|---|---|---|
| HIGH-1 budget link wipe | ✅ fixed | `_set_joins` now preloads `existing_budgets` as fallback |
| HIGH-2 PATCH can't clear nulls | ✅ fixed | switched to `exclude_unset=True` + `"to_account_id" in patch_data` check |
| HIGH-3 partial forgiveness in net_expense | ✅ fixed | `expense_calculator` now sums `forgiven_amount` for partially-forgiven shares |
| HIGH-4 export missing settlements | ✅ fixed | `split_share_settlements` added to `_EXPORT_TABLES` |
| HIGH-5 confirm_records re-imports | ✅ fixed | status filter always applied, regardless of `record_ids` |
| HIGH-6 batch without account_id | ✅ fixed | confirm now 422s upfront instead of silently dropping |
| HIGH-7 purge worker FK crash | ✅ fixed | accounts purged only when no referencing transactions remain |
| HIGH-8 delete_account integrity | ✅ fixed | 409 when live transactions still reference the account |
| HIGH-9 patch_account opening_balance | ❌ false positive | `AccountPatch` schema doesn't expose `opening_balance` — bug as described doesn't exist. Kept `exclude_unset=True` cleanup |
| HIGH-10 api-client 401 refresh | ✅ fixed | single-flight refresh on 401, then retry; clears auth on failure |
| HIGH-11 split mutation invalidations | ✅ fixed | all split mutations now invalidate `['transactions']` + `['transactions-infinite']` |
| MED-1 forgive set-semantics | 🚫 intentional | docstring already calls it out; per user decision |
| MED-2 GPay window construction | 🚫 skipped | GPay scope excluded |
| MED-3 opening_balance TransactionType | 🚫 intentional | spec drift accepted |
| MED-4 balance_verifier transfers | ✅ confirmed safe | `ParsedRecord.type` is only `"income"` / `"expense"` |
| MED-5 logout user_id check | ✅ fixed | session lookup now scoped to `current_user.id` |
| MED-6 DEV_MODE auth bypass | 🚫 deferred | deployment concern; no code change needed for the bug itself |
| MED-7 budget_id filter | ✅ fixed | added to `TransactionFilters` + `buildParams` |
| MED-8 apiDelete body parsing | ✅ fixed | `parseJsonOrUndefined` handles 204 + empty body for all verbs |
| MED-9 TransactionFormPage double nav | ✅ fixed | single navigate + return path |
| MED-10 Link as any | ✅ fixed | typed `to="/piggy-banks/$piggyId"` + `params` |
| MED-11 AuthGuard reactive | ✅ fixed | `useSyncExternalStore` against new `subscribeToAuth` pub-sub |
| LOW-1, LOW-2 GPay | 🚫 skipped | GPay scope excluded |
| LOW-3 subscription_dates roll-forward | 🚫 reverted | existing tests rely on "first unpaid cycle" semantics; my proposed change was wrong |
| LOW-4 SplitSharesEditor float math | ✅ fixed | `round2` helper + `BALANCE_TOLERANCE` |
| LOW-5 dead `error` state | ✅ fixed | removed |
| LOW-6 Dashboard memoize | 🚫 skipped | perf, not a bug |
| is_modified_instance drift | 🚫 deferred | awaiting user decision (explanation provided in chat) |

### Verification

**Backend (against Postgres 16 in Docker):**
- Pure-Python tests: 56/56 pass.
- DB-bound tests for each fix-related case, run in isolation (the project test suite has a pre-existing async/greenlet engine-reuse issue that causes spurious failures when files are run as a batch — single-test runs are reliable):
  - `test_patch_transaction` ✅ pass (HIGH-1, HIGH-2)
  - `test_confirm_creates_transaction` ✅ pass (HIGH-5)
  - `test_confirm_force_flag_confirms_duplicates` ✅ pass (HIGH-5)
  - `test_purge_soft_deleted` ✅ pass (HIGH-7)
  - `test_soft_delete_account` ✅ pass (HIGH-8)
  - `test_logout_succeeds` ✅ pass (MED-5)
  - `test_logout_invalidates_refresh_token` ✅ pass (MED-5)
  - `test_subscription_dates` ✅ 19/19 pass (LOW-3 revert)
- One-off e2e scripts against real Postgres:
  - **HIGH-3** Partial-forgiveness `net_expense`: built a split (own=200, partial-forgiven=500 with 100 written off, fully-forgiven=300). Result = `Decimal('600.00')` ✅ matches expected.
  - **HIGH-4** Export table list: confirmed `split_share_settlements` is present and ordered after `split_shares` in `_EXPORT_TABLES`. ✅
- Pre-existing test failures **not introduced by these fixes** (verified by `git stash` baseline comparison): `test_expense_calculator.py` (5 fail — stale `settled_at=` kwarg from before the split refactor), `test_splits.py::test_create_split_happy_path`, `test_splits.py::test_get_split_cross_user_404`, several `test_export.py` cases, `test_accounts.py::test_create_account_basic` (Decimal `'0'` vs `'0.00'` string mismatch).
- Backend lint baseline: same 6 ruff errors before/after — none introduced.
- Backend import-check on all 8 modified modules: clean.

**Frontend:**
- `tsc -b --noEmit`: same 3 pre-existing errors, none in changed files.
- Vitest: same baseline (46 failed / 216 passed). The 16 tests for files I changed (`SplitSharesEditor`, `AuthGuard`, `TransactionForm`, `BundleAsSplitModal`) all pass.
- **Live browser verification (`localhost:5173`, MSW-mocked dev server):**
  - **HIGH-10** auto-refresh on 401: injected one-shot 401 on a `GET /transactions`, observed `[GET 401 → POST /auth/refresh → GET retry 200]` sequence, `apiGet` returned data transparently. ✅
  - **HIGH-11** split mutation invalidates transactions: forgave ₹100 on a share, observed network re-fetched both `/splits` and `/transactions?type=income` after the mutation. ✅
  - **MED-10** typed `Link` to piggy bank: rendered `href="/piggy-banks/pig-1"`, click navigated correctly, page rendered. ✅
  - **MED-11** AuthGuard reactivity: `useSyncExternalStore`/`subscribeToAuth` wiring present in served bundle, unit tests pass. (Note: `AuthGuard` isn't currently wired into any route — separate pre-existing issue.)
  - **LOW-4/5** SplitSharesEditor: `round2` + `BALANCE_TOLERANCE` present in served bundle, dead `useState('')` removed.
  - **MED-7/8** filters & delete body parsing: source confirmed present in served bundle.
  - No console errors on any page visited.

## Suggested fix order

1. HIGH-1 (budget link wipe) — silent data loss on common path; one-line fix.
2. HIGH-4 (export missing settlements) — data loss across self-host migrations.
3. HIGH-3 + drift item on partial forgiveness — decide model, then fix.
4. HIGH-5 (re-import confirmed records) — duplicates in ledger.
5. HIGH-2 (PATCH cannot clear fields) — needs API shape change; do at the same time as a Pydantic v2 cleanup pass.
6. HIGH-10/11 (auth refresh + split cache invalidation) — UX-only, but constant friction.
7. Remaining MED/LOW items as cleanup.
