# Frontend Bugs

---

## MED-7: `useTransactions` filters don't include `budget_id`

**File:** `frontend/src/api/transactions.ts`

**Issue:**
The backend accepts a `budget_id` filter on `GET /transactions`, but `TransactionFilters` didn't include the field and `buildParams()` never set it. Any UI passing `budget_id` would be silently ignored.

**Fix:**
Added `budget_id?: string` to `TransactionFilters` and the corresponding `if (f.budget_id) params.append(...)` line in `buildParams`.

**Status:** ✅ Fixed

---

## MED-8: `apiDelete` calls `res.json()` on non-204 success (throws on empty body)

**File:** `frontend/src/lib/api-client.ts`

**Issue:**
The old `apiDelete` only short-circuited on 204. A DELETE endpoint returning 200 with no body (e.g. some restore handlers) would throw when `res.json()` was called on an empty body.

**Fix:**
Replaced with the shared `parseJsonOrUndefined<T>` helper that handles both 204 and empty `Content-Length: 0` cases safely for all verbs.

**Status:** ✅ Fixed

---

## MED-9: `TransactionFormPage` calls `setDone`/`navigate` twice on create path

**File:** `frontend/src/pages/TransactionForm.tsx`

**Issue:**
The create branch returned `{ id }` after calling `setDone` and `navigate`, but the code after the `if (isEditing)` block also called both again. While the early `return` protected against this today, the structure was brittle.

**Fix:**
Restructured to capture the result and call `navigate` exactly once at the end:
```ts
let result: { id: string } | undefined
if (isEditing) {
  await patchTxn.mutateAsync(...)
} else {
  const txn = await createTxn.mutateAsync(...)
  result = { id: txn.id }
}
setDone(true)
navigate({ to: '/transactions' })
return result
```

**Status:** ✅ Fixed

---

## MED-10: `Link to={...} as any}` bypasses TanStack Router type safety

**File:** `frontend/src/pages/Dashboard.tsx`

**Issue:**
```tsx
<Link to={`/piggy-banks/${p.id}` as any} …>
```
The string interpolation bypassed route param type checking entirely. If the route definition changed, this wouldn't be caught at compile time.

**Fix:**
Replaced with typed params:
```tsx
<Link to="/piggy-banks/$piggyId" params={{ piggyId: p.id }}>
```

**Status:** ✅ Fixed

---

## MED-11: `AuthGuard` redirects are not reactive to token changes

**File:** `frontend/src/components/AuthGuard.tsx`

**Issue:**
`isAuthenticated()` is a plain function, not reactive state. After the api-client cleared tokens on a failed refresh, `AuthGuard` would not re-render or redirect — the user stayed on the protected page with broken data.

**Fix:**
1. Added pub-sub to `auth-storage.ts`: `subscribeToAuth()` / `_emit()` / `_listeners`
2. Replaced the static check in `AuthGuard` with `useSyncExternalStore`:
```tsx
const authed = useSyncExternalStore(subscribeToAuth, isAuthenticated, isAuthenticated)
useEffect(() => {
  if (!authed) navigate({ to: '/login' })
}, [authed, navigate])
```

**Status:** ✅ Fixed

---

## LOW-3: `subscription_dates` only advances one cycle regardless of elapsed time

**File:** `backend/app/services/subscription_dates.py`

**Issue (reported):**
If `last_billed_at` is months in the past, `compute_next_billing_date` returns `last_billed + one cycle` rather than rolling forward to the next unpaid cycle ≥ today.

**Resolution:** 🚫 Reverted — existing tests (`test_weekly_with_last_billed`) explicitly assert "first unpaid cycle" semantics. The proposed roll-forward logic was incorrect for this codebase. Restored original behavior and added a clarifying docstring.

**Status:** 🚫 Reverted (existing semantics intentional)

---

## LOW-4: `SplitSharesEditor` uses raw float addition for balance check

**File:** `frontend/src/components/SplitSharesEditor.tsx`

**Issue:**
`0.1 + 0.2 === 0.30000000000000004` in JS. The "Shares must sum to X" alert and the "✓ Balanced" badge could flicker when amounts that should add up exactly don't due to float noise.

**Fix:**
Added `round2()` helper and `BALANCE_TOLERANCE = 0.005`. All comparisons go through `round2()` before checking against the threshold.

**Status:** ✅ Fixed

---

## LOW-5: Dead `error` state in `SplitSharesEditor`

**File:** `frontend/src/components/SplitSharesEditor.tsx`

**Issue:**
`const [error, setError] = useState('')` was declared and cleared in three handlers, but `setError(nonEmpty)` was never called. The state variable was entirely dead.

**Fix:**
Removed the state declaration and the three `setError('')` calls.

**Status:** ✅ Fixed

---

## LOW-6: `Dashboard` re-parses numeric strings on every render

**File:** `frontend/src/pages/Dashboard.tsx`

**Issue:**
`parseFloat(t.amount).toLocaleString(...)` and similar calls run on every render for every item in the transactions/accounts lists.

**Resolution:** 🚫 Skipped — perf concern only, not a correctness bug. Worth addressing if list sizes grow.

**Status:** 🚫 Skipped
