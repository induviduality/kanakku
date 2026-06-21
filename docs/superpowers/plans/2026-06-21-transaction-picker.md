# Transaction Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the capped 50-row income/expense pick-lists in split settlement flows with a reusable `TransactionPicker` component that loads the last 3 months by default, filters client-side as the user types, and escalates to backend search (last year, then all-time) when nothing matches.

**Architecture:** Two new components — `TransactionRow` (pure display, reusable) and `TransactionPicker` (self-contained with three-tier search logic) — replace the native `<select>` and checkbox lists in `SplitDrawer`, `BundleAsSplitModal`, and `CreateSplitDrawer`. A `q` (description ILIKE) param is added to the backend `GET /transactions` endpoint.

**Tech Stack:** React 19, TanStack Query v5, Tailwind/kk design tokens, Vitest + React Testing Library, MSW v2, Python/FastAPI/SQLAlchemy (backend)

## Global Constraints

- kk design tokens (`kk-input`, `kk-btn-ghost`, `bg-accent/10`, `text-fg-muted`, `text-fg-faint`, `border-border`, `surface-2`) — never raw Tailwind colour classes for theme-able surfaces
- All amounts: `toLocaleString('en-IN', { minimumFractionDigits: 2 })` with `₹` prefix
- Dates: `toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })` → `"01 May"`
- Transaction types: `expense | income | transfer | opening_balance` — no other values
- `useTransactions` default limit stays 50 everywhere it already exists; the picker uses explicit higher limits
- Backend: Python 3.12, SQLAlchemy 2 async, no new migrations needed

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/app/routers/transactions.py` | Modify | Add `q` param + ilike filter |
| `backend/tests/test_transactions.py` | Modify | Add `q` search test |
| `frontend/src/api/transactions.ts` | Modify | Add `q` to `TransactionFilters`, `buildParams`, and optional `enabled` to `useTransactions` |
| `frontend/src/test/handlers.ts` | Modify | Make GET /transactions filter by `type`, `from`, `q`, `limit` |
| `frontend/src/components/TransactionRow.tsx` | **Create** | Pure two-line transaction display row |
| `frontend/src/components/TransactionRow.test.tsx` | **Create** | Unit tests for TransactionRow |
| `frontend/src/components/TransactionPicker.tsx` | **Create** | Three-tier search picker using TransactionRow |
| `frontend/src/components/TransactionPicker.test.tsx` | **Create** | Integration tests for TransactionPicker |
| `frontend/src/components/drawers/SplitDrawer.tsx` | Modify | Swap settle `<select>` → TransactionPicker; use `useTransaction` for amount pre-fill |
| `frontend/src/components/BundleAsSplitModal.tsx` | Modify | Swap checkbox list → TransactionPicker (multiple) |
| `frontend/src/components/drawers/CreateSplitDrawer.tsx` | Modify | Swap both pickers; remove manual search state |

---

### Task 1: Backend — add `q` description search to GET /transactions

**Files:**
- Modify: `backend/app/routers/transactions.py` (around line 361)
- Modify: `backend/tests/test_transactions.py`

**Interfaces:**
- Produces: `GET /transactions?q=salary` filters to rows where `description ILIKE '%salary%'` (case-insensitive)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_transactions.py` after the existing list tests:

```python
async def test_list_transactions_q_search(authed) -> None:
    client, headers, acc_id = authed
    for desc, amount, txn_type in [
        ("Salary credit", "80000.00", "income"),
        ("Coffee shop", "200.00", "expense"),
    ]:
        await client.post(
            "/api/v1/transactions",
            json={
                "type": txn_type,
                "transacted_at": "2026-01-15T10:00:00Z",
                "amount": amount,
                "account_id": acc_id,
                "description": desc,
            },
            headers=headers,
        )
    resp = await client.get("/api/v1/transactions?q=salary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["description"] == "Salary credit"


async def test_list_transactions_q_search_case_insensitive(authed) -> None:
    client, headers, acc_id = authed
    await client.post(
        "/api/v1/transactions",
        json={
            "type": "income",
            "transacted_at": "2026-01-15T10:00:00Z",
            "amount": "5000.00",
            "account_id": acc_id,
            "description": "Monthly Rent",
        },
        headers=headers,
    )
    resp = await client.get("/api/v1/transactions?q=MONTHLY", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["description"] == "Monthly Rent"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend
.venv/Scripts/pytest tests/test_transactions.py::test_list_transactions_q_search tests/test_transactions.py::test_list_transactions_q_search_case_insensitive -v
```

Expected: FAIL with `AssertionError` (q param unrecognised, returns all rows)

- [ ] **Step 3: Add the `q` param and filter**

In `backend/app/routers/transactions.py`, update the `list_transactions` function signature. Add `q` after `to_date`:

```python
@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    type: TransactionType | None = None,
    account_id: str | None = None,  # comma-separated UUIDs
    payee_id: str | None = None,    # comma-separated UUIDs
    category_id: uuid.UUID | None = None,
    tag_id: str | None = None,      # comma-separated UUIDs
    budget_id: uuid.UUID | None = None,
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    q: str | None = None,           # ← ADD THIS LINE
    sort_by: str = Query("transacted_at", pattern="^(transacted_at|amount)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    cursor: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TransactionListResponse:
```

Then, after the `if to_date is not None:` block (around line 406), add:

```python
    if q is not None:
        base_where.append(Transaction.description.ilike(f"%{q}%"))
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend
.venv/Scripts/pytest tests/test_transactions.py::test_list_transactions_q_search tests/test_transactions.py::test_list_transactions_q_search_case_insensitive -v
```

Expected: PASS

- [ ] **Step 5: Run the full transaction test suite to check no regressions**

```bash
cd backend
.venv/Scripts/pytest tests/test_transactions.py -x -q
```

Expected: all pass

- [ ] **Step 6: Syntax-check the router**

```bash
cd backend
python -m py_compile app/routers/transactions.py && echo OK
```

Expected: `OK`

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/transactions.py backend/tests/test_transactions.py
git commit -m "feat(api): add q param to GET /transactions for description search"
```

---

### Task 2: Frontend API — add `q` to TransactionFilters and `enabled` option to `useTransactions`

**Files:**
- Modify: `frontend/src/api/transactions.ts`

**Interfaces:**
- Produces:
  - `TransactionFilters.q?: string` — passed as `?q=` query param
  - `useTransactions(filters, limit, cursor, options?: { enabled?: boolean })` — 4th arg controls whether the query fires

- [ ] **Step 1: Update `TransactionFilters` and `buildParams`**

In `frontend/src/api/transactions.ts`, find the `TransactionFilters` interface and add `q`:

```ts
export interface TransactionFilters {
  type?: TransactionType
  account_id?: string
  payee_id?: string
  category_id?: string
  tag_id?: string
  budget_id?: string
  from?: string
  to?: string
  sort_by?: 'transacted_at' | 'amount'
  sort_dir?: 'asc' | 'desc'
  q?: string   // ← ADD
}
```

In `buildParams`, add after the existing `if (filters.to)` line:

```ts
if (filters.q) p.set('q', filters.q)
```

- [ ] **Step 2: Add optional `enabled` to `useTransactions`**

Replace the existing `useTransactions` function:

```ts
export function useTransactions(
  filters: TransactionFilters = {},
  limit = 50,
  cursor?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['transactions', filters, limit, cursor],
    queryFn: () =>
      apiGet<TransactionListResponse>(`/transactions?${buildParams(filters, limit, cursor)}`),
    enabled: options?.enabled ?? true,
  })
}
```

- [ ] **Step 3: Verify the build has no new errors in this file**

```bash
cd frontend
bun run build 2>&1 | grep "src/api/transactions"
```

Expected: no errors in `src/api/transactions.ts`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/transactions.ts
git commit -m "feat(frontend/api): add q filter and enabled option to useTransactions"
```

---

### Task 3: MSW handler — filter GET /transactions by type, from, q, limit

**Files:**
- Modify: `frontend/src/test/handlers.ts` (line ~685)

**Interfaces:**
- Consumes: `TRANSACTIONS_RESPONSE` (exported mock data already defined in the file)
- Produces: handler that filters `TRANSACTIONS_RESPONSE.items` by `type`, `from`, `q`, and `limit` params

- [ ] **Step 1: Replace the static transactions handler**

Find this line in `frontend/src/test/handlers.ts`:

```ts
http.get('/api/v1/transactions', () => HttpResponse.json(TRANSACTIONS_RESPONSE)),
```

Replace it with:

```ts
http.get('/api/v1/transactions', ({ request }) => {
  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const from = url.searchParams.get('from')
  const q = url.searchParams.get('q')?.toLowerCase()
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)

  let items = TRANSACTIONS_RESPONSE.items
  if (type) items = items.filter((t) => t.type === type)
  if (from) items = items.filter((t) => t.transacted_at >= from)
  if (q) items = items.filter((t) => (t.description ?? '').toLowerCase().includes(q))
  items = items.slice(0, limit)

  return HttpResponse.json({
    ...TRANSACTIONS_RESPONSE,
    items,
    total: items.length,
  })
}),
```

- [ ] **Step 2: Run all existing frontend tests to confirm no regressions**

```bash
cd frontend
bun run test --run 2>&1 | tail -20
```

Expected: same pass/fail count as before this change (the handler now filters, but existing tests that don't pass params get all items, which is the same as before)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/test/handlers.ts
git commit -m "test(msw): filter GET /transactions handler by type, from, q, limit"
```

---

### Task 4: `TransactionRow` component

**Files:**
- Create: `frontend/src/components/TransactionRow.tsx`
- Create: `frontend/src/components/TransactionRow.test.tsx`

**Interfaces:**
- Consumes: `Transaction` from `../api/transactions`
- Produces:
  ```ts
  export interface TransactionRowProps {
    transaction: Transaction
    accountName: string
    toAccountName?: string
    payeeName?: string
    isSelected: boolean
    onClick: () => void
    showCheckbox: boolean
  }
  export function TransactionRow(props: TransactionRowProps): JSX.Element
  ```

- [ ] **Step 1: Write the tests first**

Create `frontend/src/components/TransactionRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TransactionRow } from './TransactionRow'
import type { Transaction } from '../api/transactions'

const BASE_TXN: Transaction = {
  id: 'txn-1',
  user_id: 'user-1',
  type: 'income',
  description: 'Salary credit',
  amount: '80000.00',
  currency: 'INR',
  transacted_at: '2026-05-01T10:00:00Z',
  account_id: 'acc-1',
  payee_id: 'p-1',
  to_account_id: null,
  to_amount: null,
  to_currency: null,
  notes: null,
  external_ref: null,
  payment_method_id: null,
  payment_method_name: null,
  subscription_id: null,
  import_record_id: null,
  split_id: null,
  is_split: false,
  category_ids: [],
  tag_ids: [],
  budget_ids: [],
  deleted_at: null,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
}

describe('TransactionRow', () => {
  it('renders description and amount', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('Salary credit')).toBeInTheDocument()
    expect(screen.getByText(/80,000/)).toBeInTheDocument()
  })

  it('renders date as "01 May"', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('01 May')).toBeInTheDocument()
  })

  it('shows payee → account for income', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        payeeName="Employer Corp"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('Employer Corp → HDFC Savings')).toBeInTheDocument()
  })

  it('shows account → payee for expense', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, type: 'expense' }}
        accountName="HDFC Credit"
        payeeName="Swiggy"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('HDFC Credit → Swiggy')).toBeInTheDocument()
  })

  it('shows account → toAccount for transfer', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, type: 'transfer', to_account_id: 'acc-2' }}
        accountName="HDFC Savings"
        toAccountName="ICICI Current"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('HDFC Savings → ICICI Current')).toBeInTheDocument()
  })

  it('shows only account name when no payee', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, payee_id: null }}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('HDFC Savings')).toBeInTheDocument()
    expect(screen.queryByText('→')).not.toBeInTheDocument()
  })

  it('renders checkbox when showCheckbox is true', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={true}
      />,
    )
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('does not render checkbox when showCheckbox is false', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('applies selection highlight when isSelected is true', () => {
    const { container } = render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={true}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(container.firstChild).toHaveClass('bg-accent/10')
  })

  it('calls onClick when the row is clicked', async () => {
    const onClick = vi.fn()
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={onClick}
        showCheckbox={false}
      />,
    )
    await userEvent.click(screen.getByText('Salary credit'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows dash when description is null', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, description: null }}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd frontend
bun run test TransactionRow.test --run
```

Expected: FAIL — `TransactionRow` not found

- [ ] **Step 3: Implement `TransactionRow`**

Create `frontend/src/components/TransactionRow.tsx`:

```tsx
import type { Transaction } from '../api/transactions'

export interface TransactionRowProps {
  transaction: Transaction
  accountName: string
  toAccountName?: string
  payeeName?: string
  isSelected: boolean
  onClick: () => void
  showCheckbox: boolean
}

export function TransactionRow({
  transaction,
  accountName,
  toAccountName,
  payeeName,
  isSelected,
  onClick,
  showCheckbox,
}: TransactionRowProps) {
  const date = new Date(transaction.transacted_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
  const amount = parseFloat(transaction.amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
  })

  let sourceDest: string
  if (transaction.type === 'transfer' && toAccountName) {
    sourceDest = `${accountName} → ${toAccountName}`
  } else if (transaction.type === 'income') {
    sourceDest = payeeName ? `${payeeName} → ${accountName}` : accountName
  } else {
    // expense and opening_balance
    sourceDest = payeeName ? `${accountName} → ${payeeName}` : accountName
  }

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className={`flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-surface-2 transition-colors ${
        isSelected ? 'bg-accent/10 border-l-2 border-accent' : ''
      }`}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 shrink-0 accent-accent"
          tabIndex={-1}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-fg-muted shrink-0 tabular-nums">{date}</span>
          <span className="text-sm text-fg truncate flex-1 ml-2">
            {transaction.description ?? '—'}
          </span>
          <span className="text-sm font-medium text-fg shrink-0 kk-mono">₹{amount}</span>
        </div>
        <p className="text-xs text-fg-muted truncate mt-0.5">{sourceDest}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd frontend
bun run test TransactionRow.test --run
```

Expected: all pass

- [ ] **Step 5: Confirm no build errors**

```bash
cd frontend
bun run build 2>&1 | grep "TransactionRow"
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TransactionRow.tsx frontend/src/components/TransactionRow.test.tsx
git commit -m "feat(ui): add TransactionRow component"
```

---

### Task 5: `TransactionPicker` component

**Files:**
- Create: `frontend/src/components/TransactionPicker.tsx`
- Create: `frontend/src/components/TransactionPicker.test.tsx`

**Interfaces:**
- Consumes:
  - `TransactionRow` from `./TransactionRow`
  - `useTransactions`, `TransactionFilters`, `Transaction` from `../api/transactions`
  - `useAccounts` from `../api/accounts`
  - `usePayees` from `../api/payees`
- Produces:
  ```ts
  export interface TransactionPickerProps {
    type: 'income' | 'expense'
    value: string | string[]
    onChange: (value: string | string[]) => void
    multiple?: boolean
    excludeIds?: string[]
    placeholder?: string
    className?: string
  }
  export function TransactionPicker(props: TransactionPickerProps): JSX.Element
  ```

- [ ] **Step 1: Write the tests**

Create `frontend/src/components/TransactionPicker.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { renderWithQuery } from '../test/render-utils'
import { TransactionPicker } from './TransactionPicker'
import { TRANSACTIONS_RESPONSE } from '../test/handlers'

// Helper: only income items from the fixture
const incomeItems = TRANSACTIONS_RESPONSE.items.filter((t) => t.type === 'income')

function makeResponse(items: typeof TRANSACTIONS_RESPONSE.items) {
  return { ...TRANSACTIONS_RESPONSE, items, total: items.length }
}

describe('TransactionPicker', () => {
  it('renders the search input', () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    expect(screen.getByPlaceholderText('Search transactions…')).toBeInTheDocument()
  })

  it('shows "Showing last 3 months" label with no search', async () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('Showing last 3 months')).toBeInTheDocument()
    })
  })

  it('renders income transactions from the tier-1 pool', async () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => {
      expect(screen.getByText('May salary')).toBeInTheDocument()
    })
  })

  it('filters client-side when user types a matching term', async () => {
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => screen.getByText('May salary'))

    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'salary')

    await waitFor(() => {
      expect(screen.getByText('May salary')).toBeInTheDocument()
      // settlement transactions should be hidden by the client filter
      expect(screen.queryByText("Rahul's partial – dinner")).not.toBeInTheDocument()
    })
  })

  it('hides excluded ids', async () => {
    renderWithQuery(
      <TransactionPicker
        type="income"
        value=""
        onChange={vi.fn()}
        excludeIds={['txn-may-salary']}
      />,
    )
    await waitFor(() => screen.getByText("Rahul's partial – dinner"))
    expect(screen.queryByText('May salary')).not.toBeInTheDocument()
  })

  it('auto-triggers tier-2 when no client match found', async () => {
    // Override: tier-1 (3-month pool) returns no income; tier-2 (1-year) returns one
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        // Tier-1 call: has from, no q — return empty
        if (from && !q) return HttpResponse.json(makeResponse([]))
        // Tier-2 call: has both from and q — return one result
        if (from && q)
          return HttpResponse.json(
            makeResponse([{ ...incomeItems[0], description: 'Old salary from last year', id: 'txn-old' }]),
          )
        return HttpResponse.json(makeResponse([]))
      }),
    )

    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await waitFor(() => screen.getByText('Showing last 3 months'))

    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'old salary')

    await waitFor(() => {
      expect(screen.getByText('Results from the last year')).toBeInTheDocument()
      expect(screen.getByText('Old salary from last year')).toBeInTheDocument()
    })
  })

  it('shows "Search all transactions" button when tier-2 also empty', async () => {
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        if (!q) return HttpResponse.json(makeResponse([]))
        // Both tier-1 and tier-2 return nothing
        return HttpResponse.json(makeResponse([]))
      }),
    )

    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )

    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'nothing')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /search all transactions/i })).toBeInTheDocument()
    })
  })

  it('shows tier-3 all-time results after clicking "Search all transactions"', async () => {
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        // No date filter + q present = tier-3 call
        if (!from && q)
          return HttpResponse.json(
            makeResponse([{ ...incomeItems[0], description: 'Very old payment', id: 'txn-ancient' }]),
          )
        return HttpResponse.json(makeResponse([]))
      }),
    )

    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={vi.fn()} />,
    )
    await userEvent.type(screen.getByPlaceholderText('Search transactions…'), 'old')
    await waitFor(() =>
      screen.getByRole('button', { name: /search all transactions/i }),
    )
    await userEvent.click(screen.getByRole('button', { name: /search all transactions/i }))

    await waitFor(() => {
      expect(screen.getByText(/all-time results/i)).toBeInTheDocument()
      expect(screen.getByText('Very old payment')).toBeInTheDocument()
    })
  })

  it('calls onChange with the id when a row is clicked (single-select)', async () => {
    const onChange = vi.fn()
    renderWithQuery(
      <TransactionPicker type="income" value="" onChange={onChange} />,
    )
    await waitFor(() => screen.getByText('May salary'))
    await userEvent.click(screen.getByText('May salary'))
    expect(onChange).toHaveBeenCalledWith('txn-may-salary')
  })

  it('toggles ids in the array when rows clicked (multi-select)', async () => {
    const onChange = vi.fn()
    renderWithQuery(
      <TransactionPicker type="income" multiple value={[]} onChange={onChange} />,
    )
    await waitFor(() => screen.getByText('May salary'))
    await userEvent.click(screen.getByText('May salary'))
    expect(onChange).toHaveBeenCalledWith(['txn-may-salary'])
  })

  it('un-selects an id when clicked again (multi-select)', async () => {
    const onChange = vi.fn()
    renderWithQuery(
      <TransactionPicker
        type="income"
        multiple
        value={['txn-may-salary']}
        onChange={onChange}
      />,
    )
    await waitFor(() => screen.getByText('May salary'))
    await userEvent.click(screen.getByText('May salary'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('resets to tier-1 when query is cleared', async () => {
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')
        if (!q && from) return HttpResponse.json(makeResponse([{ ...incomeItems[0], description: 'May salary' }]))
        return HttpResponse.json(makeResponse([]))
      }),
    )
    renderWithQuery(<TransactionPicker type="income" value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText('Search transactions…')

    await userEvent.type(input, 'xyz')
    await waitFor(() => screen.getByRole('button', { name: /search all transactions/i }))

    await userEvent.clear(input)
    await waitFor(() => {
      expect(screen.getByText('Showing last 3 months')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /search all transactions/i })).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd frontend
bun run test TransactionPicker.test --run
```

Expected: FAIL — `TransactionPicker` not found

- [ ] **Step 3: Implement `TransactionPicker`**

Create `frontend/src/components/TransactionPicker.tsx`:

```tsx
import { useState, useMemo, useEffect } from 'react'
import { useTransactions, type Transaction } from '../api/transactions'
import { useAccounts } from '../api/accounts'
import { usePayees } from '../api/payees'
import { TransactionRow } from './TransactionRow'

export interface TransactionPickerProps {
  type: 'income' | 'expense'
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean
  excludeIds?: string[]
  placeholder?: string
  className?: string
}

type Tier = 'local' | 'all'

function useDateAnchor(daysBack: number): string {
  return useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - daysBack)
    return d.toISOString().split('T')[0]
  }, [daysBack])
}

export function TransactionPicker({
  type,
  value,
  onChange,
  multiple = false,
  excludeIds = [],
  placeholder = 'Search transactions…',
  className = '',
}: TransactionPickerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [tier, setTier] = useState<Tier>('local')

  // Debounce query input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Reset tier escalation when the query changes
  useEffect(() => {
    setTier('local')
  }, [debouncedQuery])

  const from3m = useDateAnchor(90)
  const from1y = useDateAnchor(365)

  const { data: accountsData } = useAccounts()
  const { data: payeesData } = usePayees()

  // Tier-1: last 3 months, loaded upfront
  const { data: tier1Data } = useTransactions({ type, from: from3m }, 200)
  const pool: Transaction[] = tier1Data?.items ?? []

  // Client-side filter on tier-1 pool
  const clientFiltered = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    return pool.filter(
      (t) =>
        !excludeIds.includes(t.id) &&
        (!q || (t.description ?? '').toLowerCase().includes(q)),
    )
  }, [pool, debouncedQuery, excludeIds])

  const noClientMatches = debouncedQuery.length >= 2 && clientFiltered.length === 0

  // Tier-2: last year, triggered automatically when client has no matches
  const { data: tier2Data, isFetching: tier2Fetching } = useTransactions(
    { type, from: from1y, q: debouncedQuery },
    100,
    undefined,
    { enabled: noClientMatches && tier === 'local' },
  )
  const tier2Items = useMemo(
    () => (tier2Data?.items ?? []).filter((t) => !excludeIds.includes(t.id)),
    [tier2Data, excludeIds],
  )

  // Tier-3: all time, triggered by user clicking "Search all transactions"
  const { data: tier3Data, isFetching: tier3Fetching } = useTransactions(
    { type, q: debouncedQuery },
    100,
    undefined,
    { enabled: tier === 'all' && debouncedQuery.length >= 2 },
  )
  const tier3Items = useMemo(
    () => (tier3Data?.items ?? []).filter((t) => !excludeIds.includes(t.id)),
    [tier3Data, excludeIds],
  )

  // Name lookup maps
  const accountMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of accountsData ?? []) m[a.id] = a.name
    return m
  }, [accountsData])

  const payeeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of payeesData ?? []) m[p.id] = p.name
    return m
  }, [payeesData])

  // Decide which list to show
  const activeItems: Transaction[] =
    tier === 'all' ? tier3Items : noClientMatches ? tier2Items : clientFiltered
  const isFetching = tier2Fetching || tier3Fetching

  const showSearchAllButton =
    noClientMatches &&
    !tier2Fetching &&
    tier === 'local' &&
    tier2Data !== undefined &&
    tier2Items.length === 0

  // Status label
  let statusLabel: string | null = null
  if (!debouncedQuery) {
    statusLabel = 'Showing last 3 months'
  } else if (tier === 'all' && tier3Data) {
    statusLabel = `All-time results for '${debouncedQuery}'`
  } else if (noClientMatches && tier2Data && tier2Items.length > 0) {
    statusLabel = 'Results from the last year'
  }

  // Selection helpers
  const selectedIds = Array.isArray(value) ? value : value ? [value] : []

  function handleSelect(id: string) {
    if (multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
      onChange(next)
    } else {
      onChange(id)
    }
  }

  return (
    <div className={`rounded-lg border border-border bg-surface overflow-hidden ${className}`}>
      <div className="px-2 pt-2 pb-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="kk-input text-sm w-full"
        />
      </div>

      {statusLabel && (
        <p className="px-3 py-1 text-xs text-fg-faint">{statusLabel}</p>
      )}

      {isFetching && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-fg-muted">
          <span className="w-3 h-3 border border-fg-muted border-t-transparent rounded-full animate-spin" />
          {tier === 'all' ? 'Searching all transactions…' : 'Searching last year…'}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto py-1">
        {activeItems.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={t}
            accountName={accountMap[t.account_id] ?? t.account_id.slice(0, 8)}
            toAccountName={
              t.to_account_id ? (accountMap[t.to_account_id] ?? undefined) : undefined
            }
            payeeName={t.payee_id ? (payeeMap[t.payee_id] ?? undefined) : undefined}
            isSelected={selectedIds.includes(t.id)}
            onClick={() => handleSelect(t.id)}
            showCheckbox={multiple}
          />
        ))}

        {showSearchAllButton && (
          <div className="px-3 py-3 text-center space-y-1">
            <p className="text-xs text-fg-muted">No results in the last year.</p>
            <button
              type="button"
              onClick={() => setTier('all')}
              className="text-xs text-accent hover:underline"
            >
              Search all transactions
            </button>
          </div>
        )}

        {tier === 'all' && !tier3Fetching && tier3Data && tier3Items.length === 0 && (
          <p className="px-3 py-3 text-center text-xs text-fg-muted">No results found.</p>
        )}

        {!debouncedQuery && activeItems.length === 0 && !isFetching && tier1Data && (
          <p className="px-3 py-3 text-center text-xs text-fg-muted">
            No {type} transactions in the last 3 months.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd frontend
bun run test TransactionPicker.test --run
```

Expected: all pass

- [ ] **Step 5: Confirm build is clean**

```bash
cd frontend
bun run build 2>&1 | grep -E "TransactionPicker|TransactionRow"
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TransactionPicker.tsx frontend/src/components/TransactionPicker.test.tsx
git commit -m "feat(ui): add TransactionPicker with three-tier search"
```

---

### Task 6: Wire `SplitDrawer` — replace settle `<select>` with TransactionPicker

**Files:**
- Modify: `frontend/src/components/drawers/SplitDrawer.tsx`

**Interfaces:**
- Consumes: `TransactionPicker` from `../TransactionPicker`, `useTransaction` from `../../api/transactions`

Key change: `ShareRow` no longer receives an `incomeTransactions` prop. It uses `TransactionPicker` internally. Amount pre-fill uses `useTransaction(settleTxnId)` (single-transaction fetch, fires only when an ID is selected).

`SplitDrawer` keeps its `useTransactions({ type: 'income' })` call but only for building `txnMap` used by `SettlementRow` to label already-linked settlements.

- [ ] **Step 1: Update `ShareRow` props and the settle form**

In `SplitDrawer.tsx`:

**a) Remove `incomeTransactions` from the `ShareRow` props interface** (lines 143-152). The new interface:

```tsx
function ShareRow({
  share,
  splitId,
  payeeName,
  payeeOptions,
  onCreatePayee,
  txnMap,
}: {
  share: SplitShare
  splitId: string
  payeeName: string
  payeeOptions: Array<{ id: string; label: string }>
  onCreatePayee: (name: string) => Promise<{ id: string; label: string }>
  txnMap: Record<string, { description: string | null; amount: string }>
}) {
```

**b) Add `useTransaction` import** at the top of the file (alongside existing `useTransactions`):

```ts
import { useTransactions, useTransaction } from '../../api/transactions'
```

**c) Inside `ShareRow`, replace `selectedTxn` and `onTxnSelect` with `useTransaction`**:

Remove:
```ts
const selectedTxn = incomeTransactions.find(t => t.id === settleTxnId)

function onTxnSelect(txnId: string) {
  setSettleTxnId(txnId)
  const t = incomeTransactions.find(i => i.id === txnId)
  if (t) {
    const capped = Math.min(parseFloat(t.amount), remaining)
    setSettleAmount(capped.toFixed(2))
  }
}
```

Add (after the `const [forgiveAmount, setForgiveAmount] = useState('')` line):
```ts
const { data: selectedTxn } = useTransaction(settleTxnId || undefined)

// Pre-fill settle amount when a transaction is selected
useEffect(() => {
  if (selectedTxn && remaining > 0) {
    const capped = Math.min(parseFloat(selectedTxn.amount), remaining)
    setSettleAmount(capped.toFixed(2))
  }
}, [selectedTxn?.id, remaining])
```

Add the missing `useEffect` import at the top of the file if not present:
```ts
import { useState, useEffect } from 'react'
```

**d) Replace the settle inline form's `<select>` with `TransactionPicker`**:

Remove lines 270-280:
```tsx
{/* Add payment inline form */}
{settleOpen && (
  <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
    <p className="text-xs font-medium text-fg-muted">Link income transaction</p>
    <select value={settleTxnId} onChange={e => onTxnSelect(e.target.value)} className="kk-input text-sm">
      <option value="">Select transaction…</option>
      {incomeTransactions.map(t => (
        <option key={t.id} value={t.id}>
          {t.description ?? t.id.slice(0, 8)} — ₹{t.amount}
        </option>
      ))}
    </select>
```

Replace with:
```tsx
{settleOpen && (
  <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
    <p className="text-xs font-medium text-fg-muted">Link income transaction</p>
    <TransactionPicker
      type="income"
      value={settleTxnId}
      onChange={(id) => setSettleTxnId(id as string)}
    />
```

**e) Update `handleSettle`** — it currently reads `selectedTxn?.amount`; the hook-based `selectedTxn` is now a full `Transaction` from `useTransaction`, so this still works:

```ts
async function handleSettle() {
  if (!settleTxnId) return
  const body: { transaction_id: string; amount?: string } = { transaction_id: settleTxnId }
  if (settleAmount && settleAmount !== selectedTxn?.amount) body.amount = settleAmount
  await settle.mutateAsync({ shareId: share.id, body })
  setSettleOpen(false); setSettleTxnId(''); setSettleAmount('')
}
```

No change needed here — `selectedTxn?.amount` still resolves correctly from the hook.

**f) Add `TransactionPicker` import** at the top of the file:
```ts
import { TransactionPicker } from '../TransactionPicker'
```

**g) Remove `incomeTransactions` prop from all `ShareRow` usages** in `SplitDrawer` (around line 399-408). Remove the `incomeTransactions={incomeTransactions}` prop line.

- [ ] **Step 2: Run the existing SplitDrawer tests**

```bash
cd frontend
bun run test SplitDrawer.test --run
```

Expected: all pass

- [ ] **Step 3: Confirm build is clean**

```bash
cd frontend
bun run build 2>&1 | grep "SplitDrawer"
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/drawers/SplitDrawer.tsx
git commit -m "feat(SplitDrawer): replace income select with TransactionPicker"
```

---

### Task 7: Wire `BundleAsSplitModal` — replace checkbox list with TransactionPicker

**Files:**
- Modify: `frontend/src/components/BundleAsSplitModal.tsx`

- [ ] **Step 1: Update the file**

**a) Remove the `useTransactions` import and call.** Remove:
```ts
import { useTransactions } from '../api/transactions'
// ...
const { data: txnData } = useTransactions({ type: 'income' })
const incomeTransactions = txnData?.items ?? []
```

**b) Add `TransactionPicker` import**:
```ts
import { TransactionPicker } from './TransactionPicker'
```

**c) Update `incomeTotal` calculation** — it currently uses `incomeTransactions.find(t => t.id === id)` to get amounts. Since `TransactionPicker` only gives us IDs, we need another approach. Remove the amount-lookup logic and instead use `useTransactions` fetched data only if needed — OR simplify: the backend computes the split correctly from IDs, so `incomeTotal` is only used for the "Your share" display hint. We can drop the client-side `incomeTotal` calculation since it's a display-only computed field and the M3 bug (review finding) makes it inaccurate anyway. Replace the display with a simpler note.

Remove these derived values:
```ts
const incomeTotal = selectedIncomeIds
  .map((id) => incomeTransactions.find((t) => t.id === id))
  .reduce((sum, t) => sum + (t ? Number(t.amount) : 0), 0)
const forgivenTotal = forgivenShares.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
const userShare = expenseNum - incomeTotal - forgivenTotal
```

Replace with:
```ts
const forgivenTotal = forgivenShares.reduce((sum, f) => sum + (Number(f.amount) || 0), 0)
```

And remove the `userShare` display in the subtitle:
```tsx
// Remove this span:
{userShare >= 0 && (
  <span className="ml-2 text-indigo-600">
    Your share: ₹{userShare.toFixed(2)}
  </span>
)}
```

**d) Replace the checkbox list (lines 108-130)** with:
```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Select income transactions (settlement legs)
  </label>
  <TransactionPicker
    type="income"
    multiple
    value={selectedIncomeIds}
    onChange={(ids) => setSelectedIncomeIds(ids as string[])}
  />
</div>
```

**e) Fix the submit validation** — it previously used `incomeTotal`; update to remove that reference:
```ts
// Remove the incomeTotal check — let the backend validate
// The remaining guard is still correct:
// if (incomeTotal + forgivenTotal > expenseNum) { ... }
// Replace with a simpler check or remove (backend will error if over-assigned)
```

Since we no longer have `incomeTotal`, remove the over-budget pre-submit check (the backend enforces it; and the UI no longer has the data to compute it client-side). The error from the backend will surface via the existing `catch` block.

The updated `handleSubmit`:
```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setError('')
  try {
    await bundle.mutateAsync({
      expense_transaction_ids: expenseTransactionIds,
      income_transaction_ids: selectedIncomeIds,
      forgiven_shares: forgivenShares.filter((f) => Number(f.amount) > 0),
      ...(notes && { notes }),
    })
    onSuccess()
    onClose()
  } catch {
    setError('Failed to bundle split. Please try again.')
  }
}
```

- [ ] **Step 2: Run the BundleAsSplitModal tests**

```bash
cd frontend
bun run test BundleAsSplitModal.test --run
```

Expected: all pass (or update any test that expected the old checkbox list)

- [ ] **Step 3: Confirm build**

```bash
cd frontend
bun run build 2>&1 | grep "BundleAsSplitModal"
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BundleAsSplitModal.tsx
git commit -m "feat(BundleAsSplitModal): replace income checkbox list with TransactionPicker"
```

---

### Task 8: Wire `CreateSplitDrawer` — replace both pickers

**Files:**
- Modify: `frontend/src/components/drawers/CreateSplitDrawer.tsx`

- [ ] **Step 1: Remove manual expense search state and the two `useTransactions` calls**

Remove:
```ts
const { data: expenseData } = useTransactions({ type: 'expense' })
const { data: incomeData } = useTransactions({ type: 'income' })
// ...
const [expenseSearch, setExpenseSearch] = useState('')
// ...
const expenseTxns = expenseData?.items ?? []
const incomeTxns = incomeData?.items ?? []
const incomeMap = useMemo(() => { ... }, [incomeTxns])
```

Remove the `expenseSearch` state line and all references to it.
Remove `expenseTxns`, `incomeTxns`, `incomeMap` derived values.
Keep `accountMap`, `payeeMap`, `usedIncomeIds`, `stagedIncomeIds` — those are still needed for business logic.

**Note:** `totalExpense` currently uses `expenseTxns.find(e => e.id === id)` to sum amounts. Since we no longer have `expenseTxns`, we need an alternative. The simplest: keep a local `selectedExpenseMap: Record<string, string>` (id → amount) populated when the picker calls `onChange`. Replace the current `totalExpense` computation with a map lookup.

Add state:
```ts
const [selectedExpenseAmounts, setSelectedExpenseAmounts] = useState<Record<string, string>>({})
```

Update `totalExpense`:
```ts
const totalExpense = selectedExpenseIds.reduce(
  (sum, id) => sum + (Number(selectedExpenseAmounts[id]) || 0),
  0,
)
```

Add `TransactionPicker` import:
```ts
import { TransactionPicker } from '../TransactionPicker'
```

**Step 2: Replace the expense picker**

Find the expense transaction list/search UI in `CreateSplitDrawer` (around the `expenseSearch` input and the filtered list map) and replace entirely with:

```tsx
<TransactionPicker
  type="expense"
  multiple
  value={selectedExpenseIds}
  onChange={(ids) => {
    const idArr = ids as string[]
    setSelectedExpenseIds(idArr)
    // Remove de-selected amounts from the map
    setSelectedExpenseAmounts((prev) => {
      const next: Record<string, string> = {}
      for (const id of idArr) if (prev[id]) next[id] = prev[id]
      return next
    })
  }}
  excludeIds={alreadySplitExpenseIds}
/>
```

But we also need to populate `selectedExpenseAmounts` when the picker selects. The `TransactionPicker` only gives IDs, not amounts. We need amounts to compute `totalExpense`.

To get amounts without keeping all transactions in state: add a `useTransaction` per selected ID is too many queries. Instead, extend `TransactionPicker` with an optional callback:

In `TransactionPicker.tsx`, add an optional prop:
```ts
onTransactionSelect?: (txn: Transaction) => void  // fires in addition to onChange, single-select only; for multi: fires for the most recently toggled item
```

Actually for this case, a cleaner approach: store amounts when first seen in the pool. When the user selects an ID, look it up from the tier-1 pool. The TransactionPicker has this data internally but doesn't expose it.

Simplest solution that avoids API changes: fetch expense transactions separately only for the amount lookup, using the existing `selectedExpenseIds`:

```ts
// For each selected expense id, fetch the transaction to get the amount
// This is fine since selected IDs come from the picker (which already fetched them)
// and React Query will serve from cache
const { data: expenseData } = useTransactions(
  { type: 'expense', from: threeMonthsAgo },
  200,
)
const expenseTxns = expenseData?.items ?? []

const totalExpense = selectedExpenseIds.reduce((sum, id) => {
  const t = expenseTxns.find((e) => e.id === id)
  return sum + (t ? Number(t.amount) : 0)
}, 0)
```

This re-introduces a single `useTransactions` for expense, but only for deriving `totalExpense` — not for rendering the picker. React Query caches this so the TransactionPicker (which uses the same query key) shares the result. This is the cleanest approach.

Add to `CreateSplitDrawer`:
```ts
const threeMonthsAgo = useMemo(() => {
  const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]
}, [])
const { data: expensePool } = useTransactions({ type: 'expense', from: threeMonthsAgo }, 200)
const expenseTxns = expensePool?.items ?? []
const totalExpense = selectedExpenseIds.reduce((sum, id) => {
  const t = expenseTxns.find((e) => e.id === id)
  return sum + (t ? Number(t.amount) : 0)
}, 0)
```

Keep `useTransactions` import since it's still used.

**Step 3: Replace the income picker per share**

Find where each `PayeeShare` renders an income-selection UI (a `<select>` or list for linking settlement transactions) and replace with:

```tsx
<TransactionPicker
  type="income"
  multiple
  value={share.settlementIds}
  onChange={(ids) => updateShareSettlements(shareIdx, ids as string[])}
  excludeIds={[...usedIncomeIds, ...stagedIncomeIds]}
/>
```

Note: `updateShareSettlements` may not exist yet — check what the current field is called. In the existing `CreateSplitDrawer`, income settlement IDs per share are likely stored in the `PayeeShare` interface. Adapt the `onChange` to match the actual setter.

- [ ] **Step 2: Run the existing CreateSplitDrawer tests**

```bash
cd frontend
bun run test CreateSplitDrawer.test --run 2>/dev/null || bun run test SplitDrawer.test --run
```

Expected: all pass

- [ ] **Step 3: Run the full frontend test suite**

```bash
cd frontend
bun run test --run 2>&1 | tail -10
```

Expected: same or better pass count than before Task 6

- [ ] **Step 4: Confirm clean build**

```bash
cd frontend
bun run build 2>&1 | grep -E "error|Error" | grep -v "node_modules" | head -20
```

Expected: no errors from files you touched

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/drawers/CreateSplitDrawer.tsx
git commit -m "feat(CreateSplitDrawer): replace expense/income pickers with TransactionPicker"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Backend `q` param (ilike on description) | Task 1 |
| `TransactionFilters.q` + `buildParams` | Task 2 |
| `useTransactions` `enabled` option | Task 2 |
| MSW handler filters by type/from/q/limit | Task 3 |
| `TransactionRow` two-line layout | Task 4 |
| Source→destination resolution per type | Task 4 |
| Checkbox in multi, highlight in single | Task 4 |
| `TransactionPicker` tier-1 (3-month, 200 limit) | Task 5 |
| Client-side filter as user types (debounced 300ms) | Task 5 |
| Tier-2 auto-trigger (last year, 100 limit) | Task 5 |
| "Search all transactions" button (tier-3 manual) | Task 5 |
| Tier-3 all-time search (100 limit) | Task 5 |
| Status labels per tier state | Task 5 |
| `excludeIds` hides rows | Task 5 |
| Reset tier on query change | Task 5 |
| `SplitDrawer` settle `<select>` → TransactionPicker | Task 6 |
| Amount pre-fill via `useTransaction` (single fetch) | Task 6 |
| `BundleAsSplitModal` checkbox list → TransactionPicker | Task 7 |
| `CreateSplitDrawer` expense + income pickers swapped | Task 8 |

All requirements covered. No gaps.
