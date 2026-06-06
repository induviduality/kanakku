# Plan: M6 — Remove Split Creation from TransactionForm

**Goal:** Splits can only be created by bundling existing transactions.
Remove the inline split flow from the transaction creation/edit form entirely.

---

## What exists today

### Two separate split creation paths

1. **In-form path** (to remove):
   - `TransactionForm.tsx` has a "Split this expense" checkbox
   - When checked, renders `SplitSharesEditor` to define shares + payees
   - On submit: creates transaction first (`POST /transactions`), then immediately
     calls `POST /splits` with the new transaction's ID
   - Non-atomic: if the second call fails, transaction exists without a split

2. **Bundle path** (keep, this becomes the only path):
   - `BundleAsSplitModal.tsx` — triggered from `Transactions.tsx` via
     "Bundle as Split" button on selected expense rows
   - Calls `POST /splits/bundle` with one or more existing expense IDs,
     optional income transaction IDs (settlement legs), and forgiven amounts
   - Already atomic server-side

---

## Changes

### 1. `frontend/src/components/forms/TransactionForm.tsx`

Remove all split-related code:

| Lines | What to remove |
|-------|---------------|
| 8–9   | `useCreateSplit` and `SplitShareCreate` imports |
| 11    | `SplitSharesEditor` import |
| 56–57 | `isSplit` and `splitShares` state |
| 63    | `createSplit` mutation |
| 85    | `setIsSplit(initial.is_split ?? false)` in useEffect |
| 145–151 | Split share sum validation in handleSubmit |
| 156–161 | `createSplit.mutateAsync(...)` call after transaction creation |
| 421–447 | "Split this expense" toggle checkbox + conditional `SplitSharesEditor` |

The `handleSubmit` function after cleanup should only create/patch the
transaction and call `onSubmit`. No second API call.

### 2. `frontend/src/api/splits.ts`

Remove `useCreateSplit` hook (calls `POST /splits` — only used by the form).
Keep everything else: `useBundleSplit`, `useGetSplit`, `useListSplits`, etc.

### 3. `frontend/src/components/SplitSharesEditor.tsx`

Delete the file. It is only used by `TransactionForm` and has no other consumers.

### 4. `frontend/src/pages/Transactions.tsx`

No changes needed. The "Bundle as Split" button and `BundleAsSplitModal` stay
exactly as they are — this is now the sole entry point for split creation.

### 5. `docs/review-todo.md`

Cross off M6.

---

## What does NOT change

- `BundleAsSplitModal.tsx` — untouched
- `SplitDrawer.tsx` — untouched
- All backend split endpoints — untouched
- `POST /splits` backend endpoint stays (it's still valid API; we're only
  removing the frontend path that called it from the form)

---

## Validation

```
bun run build    # zero new TS errors in touched files
```

Manually verify:
- Create a new expense transaction — no "Split this expense" checkbox visible
- Edit an existing transaction — same, no split toggle
- Select one or more expense rows on Transactions page → "Bundle as Split"
  button appears → modal opens → split is created successfully

---

## Files touched

```
frontend/src/components/forms/TransactionForm.tsx   (edit)
frontend/src/api/splits.ts                          (edit)
frontend/src/components/SplitSharesEditor.tsx       (delete)
docs/review-todo.md                                 (cross off M6)
```
