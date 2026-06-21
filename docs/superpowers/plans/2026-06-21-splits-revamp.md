# Splits UI Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Bundle as Split" Transactions-page flow, and replace the two messy split drawers with a clean, structured UI where every share action is accessed by expanding the share row.

**Architecture:** Three independent tasks: (1) delete the bundle flow, (2) restructure the create drawer, (3) restructure the view/edit drawer. Each task is independently shippable. No backend changes.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, MSW, Tailwind / kk-\* design tokens, Radix UI Dialog (via existing Drawer component), TanStack Query.

## Global Constraints

- Frontend only — no backend changes, no new API endpoints
- `bun run build` must pass with zero new TypeScript errors in touched files; pre-existing errors elsewhere are acceptable
- Tests run with: `cd frontend && bun run test -- --run`
- Use `kk-*` design tokens, never raw Tailwind colour classes for themed elements
- Copy rules (exact strings):
  - null-payee share label → `"Your share"` (never "Blank Payee")
  - settle form heading → `"Link settlement"` (never "Link income transaction")
  - forgive confirm button → `"Set"` (never "Set forgiven")
  - link-payment affordance in CreateSplitDrawer → `"+ Link payments"`

---

## File Map

| Action | Path |
|--------|------|
| Delete | `frontend/src/components/BundleAsSplitModal.tsx` |
| Delete | `frontend/src/components/BundleAsSplitModal.test.tsx` |
| Modify | `frontend/src/pages/Transactions.tsx` |
| Modify | `frontend/src/components/Drawer.tsx` |
| Rewrite | `frontend/src/components/drawers/CreateSplitDrawer.tsx` |
| Rewrite | `frontend/src/components/drawers/CreateSplitDrawer.test.tsx` |
| Rewrite | `frontend/src/components/drawers/SplitDrawer.tsx` |
| Rewrite | `frontend/src/components/drawers/SplitDrawer.test.tsx` |

---

### Task 1: Delete BundleAsSplitModal + clean up Transactions.tsx

**Files:**
- Delete: `frontend/src/components/BundleAsSplitModal.tsx`
- Delete: `frontend/src/components/BundleAsSplitModal.test.tsx`
- Modify: `frontend/src/pages/Transactions.tsx`

**What to remove from Transactions.tsx:**

| Line(s) | What |
|---------|------|
| 19 | `import BundleAsSplitModal from '../components/BundleAsSplitModal'` |
| 163 | `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())` |
| 165 | `const [bundleTarget, setBundleTarget] = useState<Transaction[] | null>(null)` |
| 301–308 | entire `toggleSelect` function |
| 332 | `${selectedIds.size > 0 ? 'pb-20' : ''}` conditional on `<main>` className |
| 457–489 | entire sticky bulk-action bar (IIFE block) |
| 519–521 | `<th>` select column header in desktop table |
| 541–548 | checkbox `<td>` cell in desktop table |
| 645–652 | checkbox `<input>` in mobile card |
| 776–784 | `{bundleTarget && (<BundleAsSplitModal …/>)}` render |

- [ ] **Step 1: Delete the two BundleAsSplitModal files**

```bash
rm frontend/src/components/BundleAsSplitModal.tsx
rm frontend/src/components/BundleAsSplitModal.test.tsx
```

- [ ] **Step 2: Remove `import BundleAsSplitModal` from Transactions.tsx (line 19)**

Delete the line:
```tsx
import BundleAsSplitModal from '../components/BundleAsSplitModal'
```

- [ ] **Step 3: Remove the two state declarations (lines 163, 165)**

Remove:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```
and:
```tsx
const [bundleTarget, setBundleTarget] = useState<Transaction[] | null>(null)
```

- [ ] **Step 4: Remove `toggleSelect` function (lines 301–308)**

Remove the entire block:
```tsx
function toggleSelect(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}
```

- [ ] **Step 5: Remove the conditional `pb-20` from `<main>` (line 332)**

Change:
```tsx
<main ref={topRef} className={`p-4 md:p-6 max-w-5xl mx-auto ${selectedIds.size > 0 ? 'pb-20' : ''}`}>
```
To:
```tsx
<main ref={topRef} className="p-4 md:p-6 max-w-5xl mx-auto">
```

- [ ] **Step 6: Remove the sticky bulk-action bar (lines 457–489)**

Remove the entire block:
```tsx
{/* Sticky bulk action bar */}
{selectedIds.size > 0 && (() => {
  const selectedItems = allItems.filter((t) => selectedIds.has(t.id))
  const selectedExpenses = selectedItems.filter((t) => t.type === 'expense')
  const allExpenses = selectedExpenses.length === selectedItems.length
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-3 bg-white border-t border-indigo-200 shadow-lg px-4 py-3 md:left-64">
      <span className="text-sm font-semibold text-indigo-700 shrink-0">
        {selectedIds.size} selected
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {allExpenses ? (
          <button
            onClick={() => setBundleTarget(selectedExpenses)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            aria-label="Bundle as split"
          >
            Bundle as Split
          </button>
        ) : (
          <span className="text-xs text-gray-400 italic">
            Select only expenses to bundle as split
          </span>
        )}
      </div>
      <button
        onClick={() => setSelectedIds(new Set())}
        className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 shrink-0"
      >
        Clear
      </button>
    </div>
  )
})()}
```

- [ ] **Step 7: Remove the select column `<th>` header in the desktop table**

Find and remove:
```tsx
<th className="w-8 px-3 py-2">
  <span className="sr-only">Select</span>
</th>
```

- [ ] **Step 8: Remove the checkbox `<td>` in desktop table rows**

Find and remove this block inside `allItems.map((t) => {` for the desktop table:
```tsx
<td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
  <input
    type="checkbox"
    checked={selectedIds.has(t.id)}
    onChange={() => toggleSelect(t.id)}
    aria-label={`Select ${t.description ?? t.id}`}
  />
</td>
```

- [ ] **Step 9: Remove the checkbox in mobile cards**

Find and remove this block inside `allItems.map((t) => {` for the mobile card:
```tsx
<input
  type="checkbox"
  checked={selectedIds.has(t.id)}
  onChange={() => toggleSelect(t.id)}
  onClick={e => e.stopPropagation()}
  className="mt-1 flex-shrink-0"
  aria-label={`Select ${t.description ?? t.id}`}
/>
```

- [ ] **Step 10: Remove the BundleAsSplitModal render (lines 776–784)**

Remove:
```tsx
{bundleTarget && (
  <BundleAsSplitModal
    expenseTransactionIds={bundleTarget.map((t) => t.id)}
    expenseAmount={bundleTarget.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2)}
    open={!!bundleTarget}
    onClose={() => setBundleTarget(null)}
    onSuccess={() => setSelectedIds(new Set())}
  />
)}
```

- [ ] **Step 11: Build check — must pass with zero new errors**

```bash
cd frontend && bun run build 2>&1 | tail -20
```

Expected: exits 0, no TypeScript errors in `Transactions.tsx`.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/components/BundleAsSplitModal.tsx \
        frontend/src/components/BundleAsSplitModal.test.tsx \
        frontend/src/pages/Transactions.tsx
git commit -m "feat(splits): remove Bundle as Split flow from Transactions page"
```

---

### Task 2: Restructure CreateSplitDrawer

**Files:**
- Rewrite: `frontend/src/components/drawers/CreateSplitDrawer.tsx`
- Rewrite: `frontend/src/components/drawers/CreateSplitDrawer.test.tsx`

**Key changes vs current:**
- `PayeeShare` drops `forgiveOpen` and `forgiven` fields
- Form order: Notes → Expenses → Shares → Balance indicator → CTA
- "Your share" card is first in Shares section, no payee picker, `aria-label="Your share amount"`
- Payee cards keep `+ Link payments` (income TransactionPicker, multi-select) — `"Done"` button to close it
- Forgive sub-panel removed from payee cards (post-creation operation only)
- Balance indicator replaces 5-row `DrawerSection`: two lines + a progress bar
- Settlement validation: `settledTotal(p) > n(p.amount)` (no forgiven variable)

**Interfaces:**
- Produces: same `CreateSplitDrawer` export signature — `({ open, onClose, onCreated? })` — unchanged

- [ ] **Step 1: Write the new test file**

Replace `frontend/src/components/drawers/CreateSplitDrawer.test.tsx` entirely:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { renderWithQuery } from '../../test/render-utils'
import { CreateSplitDrawer } from './CreateSplitDrawer'

describe('CreateSplitDrawer', () => {
  it('does not render content when closed', () => {
    renderWithQuery(<CreateSplitDrawer open={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Expenses')).not.toBeInTheDocument()
  })

  it('renders Notes, Expenses, Shares sections and the expense list when open', async () => {
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Shares')).toBeInTheDocument()
    expect(screen.getByLabelText('Your share amount')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add payee/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Gym membership')).toBeInTheDocument())
  })

  it('disables submit until an expense is selected and shares balance', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    const submit = screen.getByRole('button', { name: 'Create Split' })
    expect(submit).toBeDisabled()

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))

    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Your share amount'), '2500')
    await waitFor(() => expect(submit).toBeEnabled())
  })

  it('excludes already-split expenses from the picker', async () => {
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Gym membership'))
    expect(screen.queryByText('Dinner at Taj')).not.toBeInTheDocument()
  })

  it('submits an atomic payload with your share + a payee share', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    let captured: any = null
    server.use(
      http.post('/api/v1/splits', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ id: 'new-split', shares: [] }, { status: 201 })
      }),
    )

    renderWithQuery(<CreateSplitDrawer open onClose={onClose} onCreated={onCreated} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))
    await user.type(screen.getByLabelText('Your share amount'), '1500')

    await user.click(screen.getByRole('button', { name: /add payee/i }))
    const combobox = screen.getByRole('combobox')
    await user.type(combobox, 'Rahul')
    await user.click(await screen.findByRole('option', { name: 'Rahul' }))
    await user.type(screen.getByLabelText('Amount owed'), '1000')

    const submit = screen.getByRole('button', { name: 'Create Split' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-split'))
    expect(onClose).toHaveBeenCalled()
    expect(captured.expense_transaction_ids).toEqual(['txn-may-gym'])
    expect(captured.shares).toHaveLength(2)
    const own = captured.shares.find((s: any) => s.payee_id === null)
    const payee = captured.shares.find((s: any) => s.payee_id === 'payee-rahul')
    expect(own.amount).toBe('1500.00')
    expect(payee.amount).toBe('1000.00')
  })

  it('shows an inline error when linked payments exceed the share amount', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))
    await user.type(screen.getByLabelText('Your share amount'), '1500')

    await user.click(screen.getByRole('button', { name: /add payee/i }))
    await user.type(screen.getByRole('combobox'), 'Rahul')
    await user.click(await screen.findByRole('option', { name: 'Rahul' }))
    await user.type(screen.getByLabelText('Amount owed'), '1000')

    // Open the link-payments panel
    await user.click(screen.getByRole('button', { name: /link payments/i }))

    // Select an income transaction (May salary = 85000 > 1000 share)
    await waitFor(() => screen.getByText('May salary'))
    await user.click(screen.getByText('May salary'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/cannot exceed this payee/i)
    })
    expect(screen.getByRole('button', { name: 'Create Split' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd frontend && bun run test -- --run src/components/drawers/CreateSplitDrawer.test.tsx
```

Expected: multiple failures (sections renamed, aria-labels changed, forgive test removed).

- [ ] **Step 3: Rewrite CreateSplitDrawer.tsx**

Replace `frontend/src/components/drawers/CreateSplitDrawer.tsx` entirely:

```tsx
import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Drawer, DrawerSection } from '../Drawer'
import Autocomplete from '../Autocomplete'
import { useCreateSplit, useListSplits, type SplitShareCreate } from '../../api/splits'
import { useTransactions, type Transaction } from '../../api/transactions'
import { usePayees, useCreatePayee } from '../../api/payees'
import { TransactionPicker } from '../TransactionPicker'

// ── Helpers ──────────────────────────────────────────────────────────────────

const EPS = 0.005

function n(v: string | number | null | undefined): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function inr(v: number): string {
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function txnLabel(
  t: { description: string | null; payee_id: string | null },
  payeeMap: Record<string, string>,
): string {
  if (t.description) return t.description
  if (t.payee_id && payeeMap[t.payee_id]) return payeeMap[t.payee_id]
  return 'Transaction'
}

interface PayeeShare {
  key: string
  payeeId: string | null
  amount: string
  linkOpen: boolean
  settlementIds: string[]
}

function newPayeeShare(): PayeeShare {
  return { key: crypto.randomUUID(), payeeId: null, amount: '', linkOpen: false, settlementIds: [] }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (splitId: string) => void
}

export function CreateSplitDrawer({ open, onClose, onCreated }: Props) {
  return (
    <Drawer open={open} onClose={onClose} title="Create Split">
      {open && <CreateSplitForm onClose={onClose} onCreated={onCreated} />}
    </Drawer>
  )
}

function CreateSplitForm({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const threeMonthsAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]
  }, [])

  const { data: expensePool } = useTransactions({ type: 'expense', from: threeMonthsAgo }, 200)
  const { data: incomePool }  = useTransactions({ type: 'income',  from: threeMonthsAgo }, 200)
  const { data: payees }      = usePayees()
  const { data: existingSplits } = useListSplits()
  const createPayee = useCreatePayee()
  const createSplit = useCreateSplit()

  const [notes, setNotes]                     = useState('')
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
  const [myShare, setMyShare]                 = useState('')
  const [shares, setShares]                   = useState<PayeeShare[]>([])
  const [submitError, setSubmitError]         = useState('')

  const payeeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of payees ?? []) m[p.id] = p.name
    return m
  }, [payees])

  const alreadySplitExpenseIds = useMemo(() => {
    const ids: string[] = []
    for (const sp of existingSplits ?? [])
      for (const id of sp.expense_transaction_ids ?? []) ids.push(id)
    return ids
  }, [existingSplits])

  const usedIncomeIds = useMemo(() => {
    const s = new Set<string>()
    for (const sp of existingSplits ?? [])
      for (const sh of sp.shares)
        for (const st of sh.settlements) s.add(st.transaction_id)
    return s
  }, [existingSplits])

  const expenseTxns = expensePool?.items ?? []
  const incomeMap   = useMemo(() => {
    const m: Record<string, Transaction> = {}
    for (const t of incomePool?.items ?? []) m[t.id] = t
    return m
  }, [incomePool])

  // ── Derived totals ───────────────────────────────────────────────────────
  const totalExpense     = selectedExpenseIds.reduce((sum, id) => {
    const t = expenseTxns.find(e => e.id === id)
    return sum + (t ? n(t.amount) : 0)
  }, 0)
  const myShareNum       = n(myShare)
  const payeeSharesTotal = shares.reduce((s, p) => s + n(p.amount), 0)
  const allocated        = myShareNum + payeeSharesTotal
  const balance          = allocated - totalExpense

  function settledTotal(p: PayeeShare): number {
    return p.settlementIds.reduce((s, id) => s + n(incomeMap[id]?.amount), 0)
  }

  // ── Validation ───────────────────────────────────────────────────────────
  const payeeError: Record<string, string> = {}
  const seenPayees = new Set<string>()
  for (const p of shares) {
    if (!p.payeeId) {
      payeeError[p.key] = 'Choose a payee for this share.'
    } else if (seenPayees.has(p.payeeId)) {
      payeeError[p.key] = 'This payee already has a share.'
    } else {
      seenPayees.add(p.payeeId)
    }
    if (!payeeError[p.key] && n(p.amount) <= 0)
      payeeError[p.key] = 'Enter a valid amount for this payee.'
    if (!payeeError[p.key] && settledTotal(p) - n(p.amount) > EPS)
      payeeError[p.key] = `Linked payments (₹${inr(settledTotal(p))}) cannot exceed this payee's share (₹${inr(n(p.amount))}).`
  }

  const errors: string[] = []
  if (selectedExpenseIds.length === 0) errors.push('Select at least one expense transaction.')
  if (myShareNum < 0) errors.push('Your share cannot be negative.')
  if (selectedExpenseIds.length > 0 && Math.abs(balance) > EPS)
    errors.push(`Shares must add up to ₹${inr(totalExpense)}.`)
  errors.push(...Object.values(payeeError))

  const canSubmit = errors.length === 0 && !createSplit.isPending

  // ── Mutators ─────────────────────────────────────────────────────────────
  function updateShare(key: string, patch: Partial<PayeeShare>) {
    setShares(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)))
  }
  function removeShare(key: string) {
    setShares(prev => prev.filter(p => p.key !== key))
  }
  function myShareRemainder() {
    setMyShare(Math.max(0, totalExpense - payeeSharesTotal).toFixed(2))
  }
  function payeeRemainder(key: string) {
    const others = shares.filter(p => p.key !== key).reduce((s, p) => s + n(p.amount), 0)
    updateShare(key, { amount: Math.max(0, totalExpense - myShareNum - others).toFixed(2) })
  }

  async function handleInlineCreatePayee(name: string) {
    const created = await createPayee.mutateAsync({ name, type: 'person' })
    return { id: created.id, label: created.name }
  }

  async function handleSubmit() {
    setSubmitError('')
    const body: { expense_transaction_ids: string[]; notes?: string; shares: SplitShareCreate[] } = {
      expense_transaction_ids: selectedExpenseIds,
      shares: [],
    }
    if (notes.trim()) body.notes = notes.trim()
    if (myShareNum > 0) body.shares.push({ payee_id: null, amount: myShareNum.toFixed(2) })
    for (const p of shares) {
      body.shares.push({
        payee_id: p.payeeId,
        amount: n(p.amount).toFixed(2),
        ...(p.settlementIds.length > 0 && { settlement_transaction_ids: p.settlementIds }),
      })
    }
    try {
      const created = await createSplit.mutateAsync(body)
      onCreated?.(created.id)
      onClose()
    } catch {
      setSubmitError('Failed to create split. Please check the details and try again.')
    }
  }

  const payeeOptions = (payees ?? []).map(p => ({ id: p.id, label: p.name }))
  const allocatedPct = totalExpense > 0 ? Math.min(1, allocated / totalExpense) : 0
  const balanceOk    = Math.abs(balance) <= EPS && selectedExpenseIds.length > 0

  return (
    <div className="space-y-6 p-5">
      {/* 1 — Notes */}
      <DrawerSection label="Notes">
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Goa trip dinner, May 28"
          aria-label="Notes"
          className="kk-input"
        />
      </DrawerSection>

      {/* 2 — Expenses */}
      <DrawerSection label="Expenses">
        <TransactionPicker
          type="expense"
          multiple
          value={selectedExpenseIds}
          onChange={(ids) => setSelectedExpenseIds(ids as string[])}
          excludeIds={alreadySplitExpenseIds}
        />
        {selectedExpenseIds.length > 0 && (
          <p className="mt-2 text-xs text-fg-muted">
            Total: <span className="kk-mono text-fg">₹{inr(totalExpense)}</span>
          </p>
        )}
      </DrawerSection>

      {/* 3 — Shares */}
      <DrawerSection label="Shares">
        <div className="space-y-3">
          {/* Your share — always first, non-removable */}
          <div className="kk-panel space-y-2">
            <p className="text-xs font-medium text-fg-muted">Your share</p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={myShare}
                  onChange={e => setMyShare(e.target.value)}
                  placeholder="0.00"
                  aria-label="Your share amount"
                  className="kk-input"
                />
              </div>
              <button type="button" onClick={myShareRemainder} className="kk-btn-ghost shrink-0 text-xs">
                Use remainder
              </button>
            </div>
          </div>

          {/* Payee cards */}
          {shares.map(p => (
            <div key={p.key} className="kk-panel space-y-3">
              {/* Payee picker + remove */}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Autocomplete
                    options={payeeOptions}
                    value={p.payeeId}
                    onChange={id => updateShare(p.key, { payeeId: id })}
                    placeholder="Select or create payee…"
                    onInlineCreate={handleInlineCreatePayee}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeShare(p.key)}
                  className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-negative-dim shrink-0"
                  aria-label="Remove payee"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Amount */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-fg-muted">Amount owed</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={p.amount}
                    onChange={e => updateShare(p.key, { amount: e.target.value })}
                    placeholder="0.00"
                    aria-label="Amount owed"
                    className="kk-input"
                  />
                </div>
                <button type="button" onClick={() => payeeRemainder(p.key)} className="kk-btn-ghost shrink-0 text-xs">
                  Use remainder
                </button>
              </div>

              {/* Linked settlements list */}
              {p.settlementIds.length > 0 && (
                <div className="rounded-md border border-border bg-surface-2 px-3 py-1">
                  {p.settlementIds.map(id => {
                    const t = incomeMap[id]
                    return (
                      <div key={id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
                        <span className="min-w-0 truncate text-xs text-fg">
                          {t ? txnLabel(t, payeeMap) : id.slice(0, 8)}
                        </span>
                        <span className="kk-mono text-xs text-positive-dim shrink-0">+₹{inr(n(t?.amount))}</span>
                        <button
                          type="button"
                          onClick={() => updateShare(p.key, { settlementIds: p.settlementIds.filter(x => x !== id) })}
                          className="text-xs text-negative-dim hover:underline shrink-0"
                          aria-label="Unlink transaction"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Link payments toggle */}
              {p.linkOpen ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-fg-muted">Link settlement</p>
                    <button
                      type="button"
                      onClick={() => updateShare(p.key, { linkOpen: false })}
                      className="text-xs text-fg-muted hover:underline"
                    >
                      Done
                    </button>
                  </div>
                  <TransactionPicker
                    type="income"
                    multiple
                    value={p.settlementIds}
                    onChange={(ids) => updateShare(p.key, { settlementIds: ids as string[] })}
                    excludeIds={[
                      ...usedIncomeIds,
                      ...shares.filter(s => s.key !== p.key).flatMap(s => s.settlementIds),
                    ]}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => updateShare(p.key, { linkOpen: true })}
                  className="text-xs text-positive-dim hover:underline"
                >
                  + Link payments
                </button>
              )}

              {payeeError[p.key] && (
                <p role="alert" className="text-xs text-negative-dim">{payeeError[p.key]}</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShares(prev => [...prev, newPayeeShare()])}
          className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <Plus className="h-4 w-4" /> Add payee
        </button>
      </DrawerSection>

      {/* 4 — Balance indicator (only shown once an expense is selected) */}
      {selectedExpenseIds.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Allocated</span>
            <span className={`kk-mono font-medium ${balanceOk ? 'text-positive-dim' : 'text-negative-dim'}`}>
              ₹{inr(allocated)} / ₹{inr(totalExpense)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className={`h-full rounded-full transition-all ${
                balanceOk ? 'bg-positive' : allocated > totalExpense ? 'bg-negative' : 'bg-warning'
              }`}
              style={{ width: `${allocatedPct * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Your net expense</span>
            <span className="kk-mono font-medium text-negative-dim">₹{inr(myShareNum)}</span>
          </div>
        </div>
      )}

      {submitError && <p role="alert" className="text-sm text-negative-dim">{submitError}</p>}

      {/* 5 — CTA */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="kk-btn-ghost flex-1 justify-center">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {createSplit.isPending ? 'Creating…' : 'Create Split'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd frontend && bun run test -- --run src/components/drawers/CreateSplitDrawer.test.tsx
```

Expected: 5 passing.

- [ ] **Step 5: Build check**

```bash
cd frontend && bun run build 2>&1 | tail -20
```

Expected: exits 0, zero errors in `CreateSplitDrawer.tsx`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/drawers/CreateSplitDrawer.tsx \
        frontend/src/components/drawers/CreateSplitDrawer.test.tsx
git commit -m "feat(splits): restructure CreateSplitDrawer — Notes first, Your share card, balance indicator, no forgive at creation"
```

---

### Task 3: Add `headerAction` to Drawer + Restructure SplitDrawer

**Files:**
- Modify: `frontend/src/components/Drawer.tsx`
- Rewrite: `frontend/src/components/drawers/SplitDrawer.tsx`
- Rewrite: `frontend/src/components/drawers/SplitDrawer.test.tsx`

**Key changes vs current:**
- `Drawer` gets an optional `headerAction?: React.ReactNode` prop — rendered between title and close button
- `SplitDrawer` uses that prop to place a trash icon in the header
- One `expandedShareId: string | null` state at the drawer level replaces per-share local expand toggles
- `ShareRow` takes `isExpanded: boolean` + `onToggle: () => void` props
- Inside expanded area, one `activeAction: 'settle' | 'forgive' | 'edit' | null` replaces three `*Open` booleans per share
- `activateAction(a)` toggles active action (clicking same action closes it) and resets all form state
- Own share (`payee_id === null`) shows only the `Edit` action — no Record payment, no Forgive
- Reset button is `text-negative-dim`; clicking opens `ConfirmDialog` (unchanged behaviour)
- "Details" section becomes a collapsible accordion at the bottom; shows IDs + created date
- "Your share" replaces "Blank Payee" everywhere
- "Link settlement" replaces "Link income transaction"
- "Set" replaces "Set forgiven"

**Interfaces:**
- `Drawer` — adds optional `headerAction?: React.ReactNode`; all existing callers are unaffected (prop is optional)
- `SplitDrawer` — same `({ splitId, onClose })` signature, unchanged

- [ ] **Step 1: Write the new SplitDrawer test file**

Replace `frontend/src/components/drawers/SplitDrawer.test.tsx` entirely:

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SplitDrawer } from './SplitDrawer'
import { renderWithQuery } from '../../test/render-utils'
import { server } from '../../test/server'
import { http, HttpResponse } from 'msw'

describe('SplitDrawer component', () => {
  it('shows loading state initially', () => {
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)
    const loaders = document.querySelectorAll('.animate-pulse')
    expect(loaders.length).toBeGreaterThan(0)
  })

  it('renders split heading, summary panel, and collapsed share rows', async () => {
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument()
    })

    expect(screen.getByText('Total expense')).toBeInTheDocument()
    expect(screen.getByText('Your net expense')).toBeInTheDocument()

    // All four shares render as collapsed rows
    expect(screen.getByText('Your share')).toBeInTheDocument()
    expect(screen.getByText('Rahul')).toBeInTheDocument()
    expect(screen.getByText('Priya')).toBeInTheDocument()
    expect(screen.getByText('Neel')).toBeInTheDocument()

    // Action buttons are NOT visible until a row is expanded
    expect(screen.queryByText('Record payment')).not.toBeInTheDocument()
    expect(screen.queryByText('Forgive')).not.toBeInTheDocument()
  })

  it('expands a share row on click and shows action buttons', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())

    // Click Rahul's row to expand
    await user.click(screen.getByText('Rahul'))

    // Action buttons appear
    expect(screen.getByText('Record payment')).toBeInTheDocument()
    expect(screen.getByText('Forgive')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('expanding one share collapses the previously expanded share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())

    await user.click(screen.getByText('Rahul'))
    expect(screen.getByText('Record payment')).toBeInTheDocument()

    // Now expand Neel — Rahul's actions should disappear
    await user.click(screen.getByText('Neel'))
    await waitFor(() => {
      expect(screen.getAllByText('Record payment')).toHaveLength(1)
    })
    // Neel expanded, Rahul collapsed — still one "Record payment"
    expect(screen.getByText('Record payment')).toBeInTheDocument()
  })

  it('Your share row shows only Edit action, not Record payment or Forgive', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Your share')).toBeInTheDocument())
    await user.click(screen.getByText('Your share'))

    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.queryByText('Record payment')).not.toBeInTheDocument()
    expect(screen.queryByText('Forgive')).not.toBeInTheDocument()
  })

  it('handles forgiving a payee share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    await user.click(screen.getByText('Rahul'))

    await user.click(screen.getByText('Forgive'))
    expect(screen.getByText('Forgive amount')).toBeInTheDocument()

    const setButton = screen.getByRole('button', { name: /^set$/i })
    await user.click(setButton)

    await waitFor(() => {
      expect(screen.queryByText('Forgive amount')).not.toBeInTheDocument()
    })
  })

  it('handles linking a payment (settling) on a payee share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    await user.click(screen.getByText('Rahul'))

    await user.click(screen.getByText('Record payment'))
    expect(screen.getByText('Link settlement')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('May salary')).toBeInTheDocument())
    await user.click(screen.getByText('May salary'))

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.queryByText('Link settlement')).not.toBeInTheDocument()
    })
  })

  it('handles resetting a share that has activity', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Priya')).toBeInTheDocument())
    // Priya has forgiven_amount=900 so "Reset" should appear when expanded
    await user.click(screen.getByText('Priya'))

    await user.click(screen.getByText('Reset'))
    expect(screen.getByText('Reset share')).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.queryByText('Reset share')).not.toBeInTheDocument()
    })
  })

  it('handles unlinking a settlement', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    // Rahul has a settlement — expand to see it
    await user.click(screen.getByText('Rahul'))

    const unlinkButton = screen.getByTitle('Unlink this payment')
    expect(unlinkButton).toBeInTheDocument()
    await user.click(unlinkButton)

    await waitFor(() => {
      expect(unlinkButton).not.toBeDisabled()
    })
  })

  it('shows error state when split is not found', async () => {
    renderWithQuery(<SplitDrawer splitId="not-found" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Split not found.')).toBeInTheDocument()
    })
  })

  it('shows the metadata accordion collapsed by default and expandable', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Dinner at Taj')).toBeInTheDocument())

    // "Details" button exists but content is hidden
    const detailsBtn = screen.getByRole('button', { name: /details/i })
    expect(detailsBtn).toBeInTheDocument()
    expect(screen.queryByText(/^ID:/)).not.toBeInTheDocument()

    await user.click(detailsBtn)
    await waitFor(() => {
      expect(screen.getByText(/^ID:/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd frontend && bun run test -- --run src/components/drawers/SplitDrawer.test.tsx
```

Expected: failures — "Blank Payee" found instead of "Your share", action buttons visible before expand, etc.

- [ ] **Step 3: Add `headerAction` prop to Drawer.tsx**

Replace `frontend/src/components/Drawer.tsx` entirely:

```tsx
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  headerAction?: React.ReactNode
}

export function Drawer({ open, onClose, title, children, headerAction }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={o => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-border bg-surface-1 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-300"
          aria-describedby={undefined}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-sm font-semibold text-fg">{title}</Dialog.Title>
            <div className="flex items-center gap-1">
              {headerAction}
              <Dialog.Close asChild>
                <button
                  className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function DrawerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="kk-section-label">{label}</p>
      {children}
    </div>
  )
}

export function DrawerRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-xs text-fg-muted shrink-0">{label}</span>
      <span className="text-xs text-fg text-right">{value}</span>
    </div>
  )
}
```

- [ ] **Step 4: Rewrite SplitDrawer.tsx**

Replace `frontend/src/components/drawers/SplitDrawer.tsx` entirely:

```tsx
import { useEffect, useState } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { Drawer, DrawerSection } from '../Drawer'
import {
  useGetSplit,
  useSettleShare,
  useForgiveShare,
  useUnsettleShare,
  useUnlinkSettlement,
  useDeleteSplit,
  usePatchShare,
  type SplitShare,
  type SplitShareSettlement,
  type SplitShareStatus,
} from '../../api/splits'
import { useTransactions, useTransaction } from '../../api/transactions'
import { usePayees, useCreatePayee } from '../../api/payees'
import Autocomplete from '../Autocomplete'
import ConfirmDialog from '../ConfirmDialog'
import { TransactionPicker } from '../TransactionPicker'

const STATUS_CLS: Record<SplitShareStatus, string> = {
  pending:  'kk-chip kk-chip-warning',
  settled:  'kk-chip kk-chip-positive',
  forgiven: 'kk-chip kk-chip-neutral',
}

function fmt(amount: string | number) {
  return parseFloat(String(amount)).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ── SettlementRow ─────────────────────────────────────────────────────────────

function SettlementRow({
  s, txnMap, splitId, shareId,
}: {
  s: SplitShareSettlement
  txnMap: Record<string, { description: string | null; amount: string }>
  splitId: string
  shareId: string
}) {
  const unlink = useUnlinkSettlement(splitId)
  const txn    = txnMap[s.transaction_id]
  const label  = txn?.description ?? `Payment ${s.transaction_id.slice(0, 8)}…`
  const date   = new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-fg truncate">{label}</p>
        <p className="text-xs text-fg-faint kk-mono">₹{fmt(s.amount)} · {date}</p>
      </div>
      <button
        onClick={() => unlink.mutate({ shareId, settlementId: s.id })}
        disabled={unlink.isPending}
        title="Unlink this payment"
        className="text-xs text-negative-dim hover:underline disabled:opacity-40 shrink-0"
      >
        ×
      </button>
    </div>
  )
}

// ── ShareRow ──────────────────────────────────────────────────────────────────

type ActiveAction = 'settle' | 'forgive' | 'edit' | null

function ShareRow({
  share, splitId, payeeName, payeeOptions, onCreatePayee, txnMap, isExpanded, onToggle,
}: {
  share: SplitShare
  splitId: string
  payeeName: string
  payeeOptions: Array<{ id: string; label: string }>
  onCreatePayee: (name: string) => Promise<{ id: string; label: string }>
  txnMap: Record<string, { description: string | null; amount: string }>
  isExpanded: boolean
  onToggle: () => void
}) {
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [unsettleOpen, setUnsettleOpen] = useState(false)

  // Settle form state
  const [settleTxnId, setSettleTxnId]   = useState('')
  const [settleAmount, setSettleAmount] = useState('')

  // Forgive form state
  const [forgiveAmount, setForgiveAmount] = useState('')

  // Edit form state
  const [editPayeeId, setEditPayeeId] = useState<string | null>(share.payee_id ?? null)
  const [editAmount, setEditAmount]   = useState(share.amount)
  const [editError, setEditError]     = useState('')

  const settle   = useSettleShare(splitId)
  const forgive  = useForgiveShare(splitId)
  const unsettle = useUnsettleShare(splitId)
  const patch    = usePatchShare(splitId)

  const { data: selectedTxn } = useTransaction(settleTxnId || undefined)

  const paid       = parseFloat(share.paid_amount)
  const forgiven   = parseFloat(share.forgiven_amount)
  const total      = parseFloat(share.amount)
  const remaining  = Math.max(0, total - paid - forgiven)
  const isResolved = remaining <= 0
  const hasActivity = paid > 0 || forgiven > 0
  const isOwnShare  = share.payee_id === null

  // Reset form state when this row collapses
  useEffect(() => {
    if (!isExpanded) {
      setActiveAction(null)
      setSettleTxnId(''); setSettleAmount('')
      setForgiveAmount('')
      setEditPayeeId(share.payee_id ?? null); setEditAmount(share.amount); setEditError('')
    }
  }, [isExpanded])

  // Pre-fill settle amount when a transaction is selected
  useEffect(() => {
    if (selectedTxn && remaining > 0) {
      setSettleAmount(Math.min(parseFloat(selectedTxn.amount), remaining).toFixed(2))
    }
  }, [selectedTxn?.id])

  function activateAction(action: ActiveAction) {
    setActiveAction(prev => prev === action ? null : action)
    // Reset all form state on switch so forms open with fresh defaults
    setSettleTxnId(''); setSettleAmount('')
    setForgiveAmount(remaining.toFixed(2))
    setEditPayeeId(share.payee_id ?? null); setEditAmount(share.amount); setEditError('')
  }

  async function handleSettle() {
    if (!settleTxnId) return
    const body: { transaction_id: string; amount?: string } = { transaction_id: settleTxnId }
    if (settleAmount && settleAmount !== selectedTxn?.amount) body.amount = settleAmount
    await settle.mutateAsync({ shareId: share.id, body })
    setActiveAction(null); setSettleTxnId(''); setSettleAmount('')
  }

  async function handleForgive() {
    await forgive.mutateAsync({ shareId: share.id, amount: forgiveAmount })
    setActiveAction(null); setForgiveAmount('')
  }

  async function handleEdit() {
    setEditError('')
    if (!editAmount || Number(editAmount) <= 0) { setEditError('Amount must be positive'); return }
    try {
      await patch.mutateAsync({ shareId: share.id, patch: { amount: editAmount, payee_id: editPayeeId ?? null } })
      setActiveAction(null)
    } catch {
      setEditError('Save failed. Check that payee is not already on another share.')
    }
  }

  return (
    <div className="border-b border-border last:border-0">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 py-3 text-left"
      >
        <p className="text-sm font-medium text-fg truncate">{payeeName}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-fg-faint kk-mono">₹{fmt(share.amount)}</span>
          <span className={STATUS_CLS[share.status]}>{share.status}</span>
          <ChevronRight className={`w-4 h-4 text-fg-faint transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="pb-3 space-y-3 px-0.5">
          {/* Activity summary */}
          {hasActivity && (
            <p className="text-xs text-fg-muted">
              {paid > 0 && `Paid ₹${fmt(paid)}`}
              {paid > 0 && forgiven > 0 && ' · '}
              {forgiven > 0 && `Forgiven ₹${fmt(forgiven)}`}
              {!isResolved && ` · Remaining ₹${fmt(remaining)}`}
            </p>
          )}

          {/* Settlement list */}
          {share.settlements.length > 0 && (
            <div className="rounded-md border border-border bg-surface-2 px-3 py-1">
              {share.settlements.map(s => (
                <SettlementRow key={s.id} s={s} txnMap={txnMap} splitId={splitId} shareId={share.id} />
              ))}
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs">
            {!isOwnShare && !isResolved && (
              <button
                onClick={() => activateAction('settle')}
                className="text-positive-dim hover:underline"
              >
                Record payment
              </button>
            )}
            {!isOwnShare && (
              <button
                onClick={() => activateAction('forgive')}
                className="text-fg-muted hover:underline"
              >
                Forgive
              </button>
            )}
            <button onClick={() => activateAction('edit')} className="text-fg-muted hover:underline">
              Edit
            </button>
            {hasActivity && (
              <button onClick={() => setUnsettleOpen(true)} className="text-negative-dim hover:underline">
                Reset
              </button>
            )}
          </div>

          {/* Settle form */}
          {activeAction === 'settle' && (
            <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
              <p className="text-xs font-medium text-fg-muted">Link settlement</p>
              <TransactionPicker
                type="income"
                value={settleTxnId}
                onChange={(id) => setSettleTxnId(id as string)}
              />
              {settleTxnId && (
                <div>
                  <label className="text-xs text-fg-muted block mb-1">
                    Amount to credit <span className="text-fg-faint">(max ₹{fmt(remaining)})</span>
                  </label>
                  <input
                    type="number" step="0.01" min="0.01" max={remaining}
                    value={settleAmount} onChange={e => setSettleAmount(e.target.value)}
                    className="kk-input text-sm"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setActiveAction(null)} className="kk-btn-ghost flex-1 justify-center">Cancel</button>
                <button
                  onClick={handleSettle}
                  disabled={!settleTxnId || !settleAmount || settle.isPending}
                  className="flex-1 rounded-md border border-positive/30 bg-positive/10 py-1.5 text-xs font-medium text-positive-dim disabled:opacity-50"
                >
                  {settle.isPending ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {/* Forgive form */}
          {activeAction === 'forgive' && (
            <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
              <p className="text-xs font-medium text-fg-muted">
                Forgive amount
                {forgiven > 0 && <span className="text-fg-faint ml-1">(currently ₹{fmt(forgiven)})</span>}
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="number" step="0.01" min="0" max={total - paid}
                  value={forgiveAmount} onChange={e => setForgiveAmount(e.target.value)}
                  className="kk-input text-sm flex-1"
                />
                <button
                  onClick={() => setForgiveAmount((total - paid).toFixed(2))}
                  className="text-xs text-accent hover:underline whitespace-nowrap"
                >
                  All remaining
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActiveAction(null)} className="kk-btn-ghost flex-1 justify-center">Cancel</button>
                <button
                  onClick={handleForgive}
                  disabled={!forgiveAmount || forgive.isPending}
                  className="flex-1 rounded-md border border-border bg-surface-3 py-1.5 text-xs font-medium text-fg-muted disabled:opacity-50"
                >
                  {forgive.isPending ? 'Saving…' : 'Set'}
                </button>
              </div>
            </div>
          )}

          {/* Edit form */}
          {activeAction === 'edit' && (
            <div className="rounded-lg border border-accent/30 bg-surface-2 p-3 space-y-2">
              <p className="text-xs font-medium text-fg-muted">Edit share</p>
              {!isOwnShare && (
                <div>
                  <label className="text-xs text-fg-muted block mb-1">Payee</label>
                  <Autocomplete
                    options={payeeOptions}
                    value={editPayeeId}
                    onChange={setEditPayeeId}
                    placeholder="Search or create payee…"
                    onInlineCreate={onCreatePayee}
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-fg-muted block mb-1">Amount (₹)</label>
                <input
                  type="number" step="0.01" min="0.01"
                  value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  className="kk-input text-sm"
                />
              </div>
              {editError && <p className="text-xs text-negative-dim">{editError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setActiveAction(null)} className="kk-btn-ghost flex-1 justify-center text-xs">Cancel</button>
                <button
                  onClick={handleEdit}
                  disabled={patch.isPending}
                  className="flex-1 rounded-md bg-accent-dim px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {patch.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={unsettleOpen}
        title="Reset share"
        description="This will remove all linked payments and forgiveness for this share."
        onConfirm={() => { unsettle.mutate(share.id); setUnsettleOpen(false) }}
        onCancel={() => setUnsettleOpen(false)}
      />
    </div>
  )
}

// ── SplitDrawer ───────────────────────────────────────────────────────────────

interface Props {
  splitId: string | null
  onClose: () => void
}

export function SplitDrawer({ splitId, onClose }: Props) {
  const [deleteOpen, setDeleteOpen]       = useState(false)
  const [detailsOpen, setDetailsOpen]     = useState(false)
  const [expandedShareId, setExpandedShareId] = useState<string | null>(null)

  const { data: split, isLoading } = useGetSplit(splitId)
  const { data: payeesRaw = [] }   = usePayees()
  const { data: txnData }          = useTransactions({ type: 'income' })
  const deleteSplit                = useDeleteSplit()
  const createPayeeMutation        = useCreatePayee()

  const payeeMap: Record<string, string> = {}
  for (const p of payeesRaw) payeeMap[p.id] = p.name
  const payeeOptions = payeesRaw.map(p => ({ id: p.id, label: p.name }))

  const txnMap: Record<string, { description: string | null; amount: string }> = {}
  for (const t of txnData?.items ?? []) txnMap[t.id] = { description: t.description, amount: t.amount }

  const netExpense = split?.shares.reduce((sum, s) => {
    const own     = s.payee_id === null ? parseFloat(s.amount) : 0
    const forgiven = parseFloat(s.forgiven_amount)
    return sum + own + forgiven
  }, 0) ?? 0

  const totalAmount = split?.shares.reduce((sum, s) => sum + parseFloat(s.amount), 0) ?? 0

  function sharePayeeName(share: SplitShare): string {
    if (share.payee_id === null) return 'Your share'
    return payeeMap[share.payee_id] ?? share.payee_id.slice(0, 8)
  }

  function toggleShare(shareId: string) {
    setExpandedShareId(prev => prev === shareId ? null : shareId)
  }

  async function handleCreatePayee(name: string) {
    const p = await createPayeeMutation.mutateAsync({ name, type: 'merchant' })
    return { id: p.id, label: p.name }
  }

  return (
    <Drawer
      open={!!splitId}
      onClose={onClose}
      title={split?.notes ?? 'Split detail'}
      headerAction={
        <button
          onClick={() => setDeleteOpen(true)}
          className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-negative-dim"
          title="Delete split"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      }
    >
      {isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : split ? (
        <div className="space-y-6 p-5">
          {/* Summary panel */}
          <div className="kk-panel space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Total expense</span>
              <span className="text-sm font-semibold text-fg kk-mono">₹{fmt(totalAmount)}</span>
            </div>
            <hr className="kk-divider" />
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Your net expense</span>
              <span className="text-sm font-semibold text-negative-dim kk-mono">₹{fmt(netExpense)}</span>
            </div>
          </div>

          {/* Shares */}
          <DrawerSection label="Shares">
            <div className="kk-panel">
              {split.shares.map(share => (
                <ShareRow
                  key={share.id}
                  share={share}
                  splitId={split.id}
                  payeeName={sharePayeeName(share)}
                  payeeOptions={payeeOptions}
                  onCreatePayee={handleCreatePayee}
                  txnMap={txnMap}
                  isExpanded={expandedShareId === share.id}
                  onToggle={() => toggleShare(share.id)}
                />
              ))}
            </div>
          </DrawerSection>

          {/* Notes (only if present — it doubles as the drawer title too) */}
          {split.notes && (
            <DrawerSection label="Notes">
              <p className="text-sm text-fg-dim">{split.notes}</p>
            </DrawerSection>
          )}

          {/* Metadata accordion */}
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setDetailsOpen(v => !v)}
              className="flex w-full items-center justify-between text-xs text-fg-muted hover:text-fg transition-colors"
            >
              <span>Details</span>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-90' : ''}`} />
            </button>
            {detailsOpen && (
              <div className="mt-2 space-y-1">
                {split.expense_transaction_ids.map(id => (
                  <p key={id} className="text-xs text-fg-muted kk-mono">Expense: {id.slice(0, 16)}…</p>
                ))}
                <p className="text-xs text-fg-muted kk-mono">ID: {split.id.slice(0, 16)}…</p>
                <p className="text-xs text-fg-muted">
                  Created {new Date(split.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="p-5 text-sm text-negative-dim">Split not found.</p>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete split"
        description="Remove this split? The linked transactions will not be deleted — only the split linkage is removed."
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => {
          if (!splitId) return
          deleteSplit.mutate(splitId, { onSuccess: () => { setDeleteOpen(false); onClose() } })
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </Drawer>
  )
}
```

- [ ] **Step 5: Run tests — expect all to pass**

```bash
cd frontend && bun run test -- --run src/components/drawers/SplitDrawer.test.tsx
```

Expected: 9 passing.

- [ ] **Step 6: Run all split-related tests together**

```bash
cd frontend && bun run test -- --run src/components/drawers/ src/pages/Splits
```

Expected: all passing. If `SplitDetail.test.tsx` or `Splits.test.tsx` reference "Blank Payee", update them to "Your share".

- [ ] **Step 7: Build check**

```bash
cd frontend && bun run build 2>&1 | tail -20
```

Expected: exits 0, zero errors in `Drawer.tsx` or `SplitDrawer.tsx`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Drawer.tsx \
        frontend/src/components/drawers/SplitDrawer.tsx \
        frontend/src/components/drawers/SplitDrawer.test.tsx
git commit -m "feat(splits): restructure SplitDrawer — expandable share rows, Your share label, Link settlement copy, metadata accordion"
```

---

## Gap Analysis: Design Spec vs Implementation Plan

> Cross-checked `docs/superpowers/specs/2026-06-21-splits-revamp-design.md` against this plan before execution. Five discrepancies found and resolved.

| # | Gap | Source | Status |
|---|-----|--------|--------|
| G-1 | `useBundleSplit` listed as removed from `Transactions.tsx` in spec — plan steps never mention it | Spec §Scope/Removed | ✅ Confirmed harmless: `useBundleSplit` is only imported inside `BundleAsSplitModal.tsx`, not directly in `Transactions.tsx`. Deleting the modal file covers it. |
| G-2 | SplitDrawer fallback title: spec says `"Split expense"`, plan code has `'Split detail'` | Plan Task 3 Step 4 | ✅ Fixed during execution. Code uses `"Split expense"`. Decision logged. |
| G-3 | Balance progress bar: spec says "red when over or under"; plan uses amber (`bg-warning`) for under-allocated | Plan Task 2 Step 3 | ✅ Kept amber. Spec was over-simplified — amber (in-progress) is better UX than red (error) for an empty-but-filling bar. Decision logged. |
| G-4 | Action row separators: spec shows `Record payment · Forgive · Edit · Reset` with `·` dots; plan uses `gap-x-3` only | Plan Task 3 Step 4 | ✅ Fixed during execution. Added `<span aria-hidden>·</span>` between links. Decision logged. |
| G-5 | `DrawerRow` export in `Drawer.tsx` — retained from existing code, not mentioned in spec | Pre-existing | ✅ Safe additive — no spec prohibition; kept for other drawer consumers. |

### Decisions Logged
All non-trivial choices from the gap analysis are recorded in `docs/decisions/log.md`:
- "Splits revamp: balance indicator uses amber (bg-warning) for under-allocated, not red"
- "Splits revamp: SplitDrawer action row uses · separators (spec vs gap-only in original plan)"
- "Splits revamp: SplitDrawer fallback title is 'Split expense' not 'Split detail'"

### Test Results (post-execution)
- `CreateSplitDrawer.test.tsx`: **6/6 pass**
- `SplitDrawer.test.tsx`: **11/11 pass**
- `bun run build`: **Exit 0, zero TypeScript errors**
- `PiggyBankDrawer.test.tsx`: 5 failures — **pre-existing, unrelated to this revamp**
