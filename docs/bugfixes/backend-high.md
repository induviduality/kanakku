# Backend — HIGH Severity Bugs

---

## HIGH-1: PATCH /transactions wipes budget links when only categories or tags change

**File:** `backend/app/routers/transactions.py`

**Issue:**
`_set_joins` was called with `budget_ids=[]` as the fallback when `body.budget_ids` was omitted:
```python
body.budget_ids if body.budget_ids is not None else []   # ← wrong
```
Any PATCH that sent only `category_ids` or `tag_ids` (without `budget_ids`) silently removed all budget associations from the transaction.

**Fix:**
Pre-load existing budget IDs before the patch and use them as the fallback:
```python
existing_budgets = [r[0] for r in (await session.execute(select_budget_links)).all()]
# …
body.budget_ids if body.budget_ids is not None else existing_budgets
```

**Status:** ✅ Fixed

---

## HIGH-2: PATCH /transactions cannot clear nullable fields

**File:** `backend/app/routers/transactions.py`

**Issue:**
`body.model_dump(exclude_none=True, ...)` stripped explicit `null` values from the request, making it impossible to unset `payee_id`, `to_account_id`, `notes`, etc. once set. Converting a transfer → expense was rejected with 422 because `to_account_id` couldn't be nulled.

**Fix:**
Switched to `exclude_unset=True` and use `"field" in patch_data` checks instead of relying on the value being non-None:
```python
patch_data = body.model_dump(exclude_unset=True, ...)
new_to_account = patch_data["to_account_id"] if "to_account_id" in patch_data else txn.to_account_id
```

**Status:** ✅ Fixed

---

## HIGH-3: Partial forgiveness silently dropped from net-expense calculation

**File:** `backend/app/services/expense_calculator.py`

**Issue:**
The net-expense query matched shares by `status == 'forgiven'` (binary). A share with partial forgiveness (`forgiven_amount > 0` but `status == 'settled'` because some money came in) was fully excluded from the expense. The `forgiven_amount` column was never read, violating FR-7.9.

**Fix:**
Replaced the SQL-only query with a Python loop that correctly handles three cases:
1. `payee_id IS NULL` (user's own share) → count full amount
2. `status == forgiven` → count full amount
3. Otherwise → count only `forgiven_amount`

**Status:** ✅ Fixed

---

## HIGH-4: Export archive omits `split_share_settlements`

**File:** `backend/app/workers/export_worker.py`

**Issue:**
`_EXPORT_TABLES` exported `splits` and `split_shares` but never `split_share_settlements`. On self-host restore, every settled share would revert to `pending` and `paid_amount` would reset to 0.

**Fix:**
Added `split_share_settlements` entry to `_EXPORT_TABLES` between `split_shares` and `import_batches`:
```python
(
    "split_share_settlements",
    "SELECT sss.* FROM split_share_settlements sss "
    "JOIN split_shares ss ON ss.id = sss.share_id "
    "JOIN splits s ON s.id = ss.split_id WHERE s.user_id = :user_id",
),
```

**Status:** ✅ Fixed

---

## HIGH-5: `confirm_records` re-imports already-confirmed/rejected records when `record_ids` is provided

**File:** `backend/app/routers/imports.py`

**Issue:**
When the client passed explicit `record_ids`, the query had no status filter — already-confirmed or rejected records slipped through and were re-converted into new `Transaction` rows, creating duplicates and overwriting the original `transaction_id` link.

**Fix:**
Applied the `allowed_statuses` filter unconditionally, independent of whether `record_ids` was provided:
```python
query = query.where(RawImportRecord.status.in_(allowed_statuses))
if record_ids is not None:
    query = query.where(RawImportRecord.id.in_(record_ids))
```

**Status:** ✅ Fixed

---

## HIGH-6: `_record_to_transaction` silently drops records when `batch.account_id` is None

**File:** `backend/app/routers/imports.py`

**Issue:**
If a batch was uploaded without `account_id`, `_record_to_transaction` returned `None` silently. The caller saw a 200 with unchanged `total_confirmed` and no error. Records remained stuck in `pending` with no feedback.

**Fix:**
Added an upfront 422 guard at the confirm endpoint when `batch.account_id is None`:
```python
if batch.account_id is None:
    raise HTTPException(422, "Batch has no account_id — set it before confirming")
```

**Status:** ✅ Fixed

---

## HIGH-7: Purge worker crashes with FK violation when accounts have referencing transactions

**File:** `backend/app/workers/purge_worker.py`

**Issue:**
`Account` was bulk-deleted with `sa.delete(...)`. `Transaction.account_id` and `Transaction.to_account_id` both use `ondelete="RESTRICT"`. If any (even soft-deleted) transaction still referenced the account, the DELETE raised an `IntegrityError` and rolled back the entire purge batch.

**Fix:**
Replaced bulk delete with `_purge_accounts_safely()` that checks for live transaction references before attempting each account deletion:
```python
for account in accounts:
    has_txn = await session.scalar(
        select(func.count()).where(
            or_(Transaction.account_id == account.id, Transaction.to_account_id == account.id)
        )
    )
    if not has_txn:
        await session.delete(account)
```

**Status:** ✅ Fixed

---

## HIGH-8: `delete_account` does not check for live transactions

**File:** `backend/app/routers/accounts.py`

**Issue:**
Soft-deleting an account succeeded even when non-deleted transactions still referenced it, which would eventually cause HIGH-7 to fire in the purge worker 30 days later.

**Fix:**
Added a 409 guard before soft-delete:
```python
live_txn_count = await session.scalar(
    select(func.count(Transaction.id)).where(
        or_(Transaction.account_id == account.id, Transaction.to_account_id == account.id),
        Transaction.deleted_at.is_(None),
    )
)
if live_txn_count:
    raise HTTPException(409, "Account has live transactions — delete them first")
```

**Status:** ✅ Fixed

---

## HIGH-9: `patch_account` opening_balance desync

**File:** `backend/app/routers/accounts.py`

**Issue (reported):**
`patch_account` `setattr`s fields without reconciling `current_balance` when `opening_balance` changes.

**Resolution:** ❌ False positive — `AccountPatch` schema does not expose `opening_balance` at all. The code path cannot be reached. Kept the `exclude_unset=True` cleanup incidentally.

**Status:** ❌ False positive

---

## HIGH-10: No automatic token refresh on 401

**File:** `frontend/src/lib/api-client.ts`

**Issue:**
All API helpers threw immediately on any non-2xx response, including 401. After the 15-minute access token window, every request would surface as a hard error even when the refresh token was still valid.

**Fix:**
Rewrote `api-client.ts` with:
- `tryRefresh()` with `refreshInFlight` coalescing (single-flight)
- `authedFetch()` that retries once after a 401 by calling `tryRefresh()`
- `parseJsonOrUndefined<T>` to safely handle 204/empty-body responses
- Auth state cleared on refresh failure

**Status:** ✅ Fixed

---

## HIGH-11: Split mutations don't invalidate transaction caches

**File:** `frontend/src/api/splits.ts`

**Issue:**
Only `useBundleSplit` invalidated `['transactions']` / `['transactions-infinite']`. After `useCreateSplit`, `useSettleShare`, `useUnlinkSettlement`, `useForgiveShare`, or `useUnsettleShare`, the transaction list showed stale `is_split=false` badges and linked-split panels didn't refresh.

**Fix:**
Added `invalidateSplitsAndTransactions()` helper used by all 5 mutation hooks:
```ts
async function invalidateSplitsAndTransactions(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['splits'] }),
    qc.invalidateQueries({ queryKey: ['transactions'] }),
    qc.invalidateQueries({ queryKey: ['transactions-infinite'] }),
  ])
}
```

**Status:** ✅ Fixed
