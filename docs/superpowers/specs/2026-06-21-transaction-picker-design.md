# Transaction Picker — Design Spec
**Date:** 2026-06-21  
**Status:** Approved  

## Problem

Split settlement flows (`SplitDrawer`, `BundleAsSplitModal`, `CreateSplitDrawer`) call
`useTransactions({ type: 'income' | 'expense' })` with the default `limit=50`. Users with
more than 50 transactions of that type cannot find older entries. The pickers also show
only description + amount — no date, no account context — making it impossible to
disambiguate transactions with the same description.

## Solution

Two new reusable components:

- **`TransactionRow`** — pure display component for a single transaction. Reusable in any
  list or drawer context.
- **`TransactionPicker`** — self-contained dropdown picker with three-tier search
  escalation, built from `TransactionRow`.

Both live in `frontend/src/components/`.

---

## Components

### `TransactionRow`

Pure display. No data fetching.

```ts
interface TransactionRowProps {
  transaction: Transaction
  accountName: string
  toAccountName?: string   // present for transfers
  payeeName?: string       // present when payee_id is set
  isSelected: boolean
  onClick: () => void
  showCheckbox: boolean    // true = multi-select mode
}
```

**Layout — two lines:**

```
[☐]  21 Jun  Swiggy Order               ₹450.00    ← line 1: prominent
     HDFC Credit → Swiggy                           ← line 2: subdued
```

- **Line 1** (full weight): `[checkbox if showCheckbox]  date · description · amount`
  - Date: `transacted_at` → `"21 Jun"` (day + short-month, `en-IN` locale)
  - Description: truncated with `truncate` class
  - Amount: right-aligned, `toLocaleString('en-IN', { minimumFractionDigits: 2 })`
- **Line 2** (`text-xs text-fg-muted`): source → destination
  - Resolves per type (see table below)
  - Arrow `→` only rendered when both entities are present

**Source → Destination resolution:**

| Transaction type | Source | Destination |
|-----------------|--------|-------------|
| `income` | payee name (who paid you) | account name (where it landed) |
| `expense` | account name (paid from) | payee name (who you paid) |
| `transfer` | account name | to-account name |
| any, no payee | account name | *(omit — no arrow)* |

**Selection state:**  
`isSelected` → `bg-accent/10 border border-accent/20` highlight.  
In single-select mode `showCheckbox=false`, the whole row is clickable with no visual checkbox.  
In multi-select mode `showCheckbox=true`, a checkbox appears on the left.

---

### `TransactionPicker`

Manages tiers, search state, and selection. Renders search input + scrollable list of
`TransactionRow` + tier status labels + "Search all transactions" CTA.

```ts
interface TransactionPickerProps {
  type: 'income' | 'expense'
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean          // false (default) = single select, true = multi-checkbox
  excludeIds?: string[]       // rows to hide entirely (already-linked settlements)
  placeholder?: string        // defaults to "Search transactions…"
  className?: string
}
```

**Internal data fetching:**

- `useAccounts()` — to build `accountMap: Record<id, name>`
- `usePayees()` — to build `payeeMap: Record<id, name>`
- Tier-1 query: `useTransactions({ type, from: today−90d }, limit=200)`
- Tier-2 query: `useTransactions({ type, from: today−365d, q: debouncedQuery }, limit=100)`,
  `enabled` only when tier-1 yields no client matches and `debouncedQuery.length >= 2`
- Tier-3 query: `useTransactions({ type, q: debouncedQuery }, limit=100)`,
  `enabled` only when user clicks "Search all transactions"

All three `useAccounts` / `usePayees` / tier-1 results are cached by React Query; callers
that already fetched these (e.g. `CreateSplitDrawer`) pay no extra network cost.

**Search & tier escalation:**

```
[Mount]
  Tier-1 fetch: type + from=(today−90d) + limit=200
  Display pool sorted by transacted_at desc

[User types in search box]
  Debounce 300 ms
  Client filter: pool.filter(t => t.description?.toLowerCase().includes(query.toLowerCase()))
  ├─ match(es) found → render filtered list, no backend call
  └─ no matches + query.length >= 2
       └─ auto-trigger Tier-2: type + from=(today−365d) + q=query + limit=100
            ├─ results → render with label "Results from the last year"
            └─ no results →
                 ┌─────────────────────────────────┐
                 │  No results in the last year.   │
                 │  [Search all transactions]      │  ← button, one-click
                 └─────────────────────────────────┘
                      └─ Tier-3: type + q=query + limit=100 (no date filter)
                           ├─ results → label "All-time results for '<query>'"
                           └─ empty → "No results found"

[query cleared OR query changes]
  Reset to Tier-1 pool, cancel any active Tier-2/3 fetch, hide "Search all" CTA
  (user must re-escalate for the new query if needed)
```

**Status labels** (rendered above the list, `text-xs text-fg-muted`):

| State | Label |
|-------|-------|
| no search active | "Showing last 3 months" |
| client filter active, has matches | *(no label — results speak for themselves)* |
| tier-2 in flight | spinner + "Searching last year…" |
| tier-2 returned results | "Results from the last year" |
| tier-3 in flight | spinner + "Searching all transactions…" |
| tier-3 returned results | "All-time results for '{query}'" |
| all tiers exhausted | "No results found" |

**Empty state (no search, tier-1 empty):**  
"No income transactions in the last 3 months." (or "expense" depending on type).

---

## Backend change

File: `backend/app/routers/transactions.py`

Add one query parameter and one filter clause to `list_transactions`:

```python
q: str | None = None,          # free-text description search (new)
# ...existing params...

if q is not None:
    base_where.append(Transaction.description.ilike(f"%{q}%"))
```

File: `frontend/src/api/transactions.ts`

Add to `TransactionFilters`:
```ts
q?: string    // description search, passed through to ?q=
```

Add to `buildParams`:
```ts
if (filters.q) p.set('q', filters.q)
```

---

## Callers — what changes

### `SplitDrawer.tsx`
- Remove `useTransactions({ type: 'income' })` at line 347
- Remove `incomeTransactions` / `txnMap` construction and prop-threading into `ShareRow`
- Replace the native `<select>` (lines 273-280) with:
  ```tsx
  <TransactionPicker
    type="income"
    value={settleTxnId}
    onChange={(id) => onTxnSelect(id as string)}
  />
  ```
- `txnMap` (used by `SettlementRow` to show labels for already-linked settlements) is
  still needed for display of past settlements — keep a separate `useTransactions` fetch
  scoped to the specific settlement transaction IDs, or accept that linked settlements
  outside the 3-month window show the truncated-ID fallback label. **Decision: keep
  the existing `txnMap` fetch for `SettlementRow` labels; remove only the picker fetch.**

### `BundleAsSplitModal.tsx`
- Remove `useTransactions({ type: 'income' })` at line 22 and `incomeTransactions`
- Replace the checkbox list (lines 115-129) with:
  ```tsx
  <TransactionPicker
    type="income"
    multiple
    value={selectedIncomeIds}
    onChange={(ids) => setSelectedIncomeIds(ids as string[])}
  />
  ```

### `CreateSplitDrawer.tsx`
- Remove `useTransactions({ type: 'expense' })` and `useTransactions({ type: 'income' })`
  (lines 68-69) and the manual `expenseSearch` state + filter logic
- Expense picker (selecting expenses to split):
  ```tsx
  <TransactionPicker
    type="expense"
    multiple
    value={selectedExpenseIds}
    onChange={(ids) => setSelectedExpenseIds(ids as string[])}
    excludeIds={alreadySplitExpenseIds}
  />
  ```
- Income picker per payee share (settlement legs):
  ```tsx
  <TransactionPicker
    type="income"
    multiple
    value={share.settlementIds}
    onChange={(ids) => updateShareSettlements(shareIdx, ids as string[])}
    excludeIds={[...usedIncomeIds, ...stagedIncomeIds]}
  />
  ```

---

## Test handler update

`frontend/src/test/handlers.ts` — the MSW `GET /transactions` handler needs to filter by
the `q` param when present:

```ts
const q = url.searchParams.get('q')?.toLowerCase()
if (q) items = items.filter(t => t.description?.toLowerCase().includes(q))
```

---

## Files changed

| File | Change |
|------|--------|
| `backend/app/routers/transactions.py` | Add `q` param + `ilike` filter |
| `frontend/src/api/transactions.ts` | Add `q?: string` to `TransactionFilters` + `buildParams` |
| `frontend/src/components/TransactionRow.tsx` | **New** |
| `frontend/src/components/TransactionPicker.tsx` | **New** |
| `frontend/src/components/drawers/SplitDrawer.tsx` | Swap picker, keep txnMap for SettlementRow |
| `frontend/src/components/BundleAsSplitModal.tsx` | Swap picker |
| `frontend/src/components/drawers/CreateSplitDrawer.tsx` | Swap both pickers, remove manual search state |
| `frontend/src/test/handlers.ts` | Wire `q` filter in MSW handler |

---

## Out of scope

- Pagination within the picker (100-row tier-3 cap is sufficient for a personal finance app)
- Backend tests for the `q` param (trivial ilike, covered by existing transaction test suite pattern)
- Changing any other transaction list UI (main Transactions page manages its own pagination independently)
