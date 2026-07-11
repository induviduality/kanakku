import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { DrawerSection } from './Drawer'
import Autocomplete from './Autocomplete'
import {
  useCreateSplit,
  useUpdateSplit,
  useListSplits,
  type Split,
  type SplitShareCreate,
} from '../api/splits'
import { type Transaction } from '../api/transactions'
import { apiGet } from '../lib/api-client'
import { usePayees, useCreatePayee } from '../api/payees'
import { TransactionPicker } from './TransactionPicker'

// ── Helpers ──────────────────────────────────────────────────────────────────

const EPS = 0.005

function n(v: string | number | null | undefined): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function inr(v: number): string {
  return v.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function txnLabel(
  t: { description: string | null; payee_id: string | null },
  payeeMap: Record<string, string>,
): string {
  if (t.description) return t.description
  if (t.payee_id && payeeMap[t.payee_id]) return payeeMap[t.payee_id]
  return 'Transaction'
}

function txnDate(t: Transaction): string {
  return new Date(t.transacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

interface PayeeShare {
  key: string
  payeeId: string | null
  amount: string
  /** Errors are only shown once the user has interacted with this card. */
  touched: boolean
  linkOpen: boolean
  settlementIds: string[]
}

function newPayeeShare(): PayeeShare {
  return { key: crypto.randomUUID(), payeeId: null, amount: '', touched: false, linkOpen: false, settlementIds: [] }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialSplit?: Split
  onClose: () => void
  onSuccess?: (splitId: string) => void
}

export function SplitForm({ initialSplit, onClose, onSuccess }: Props) {
  const { data: payees } = usePayees()
  const { data: existingSplits } = useListSplits()
  const createPayee = useCreatePayee()
  const createSplit = useCreateSplit()
  const updateSplit = useUpdateSplit()

  // Picker opens by default when creating (nothing selected yet), collapsed when editing.
  const [pickerOpen, setPickerOpen] = useState(() => !initialSplit)
  const [notes, setNotes] = useState(() => initialSplit?.notes ?? '')
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>(() => initialSplit?.expense_transaction_ids ?? [])
  const [myShare, setMyShare] = useState(() => {
    if (!initialSplit) return ''
    const own = initialSplit.shares.find(s => s.payee_id === null)
    return own ? own.amount : ''
  })
  const [shares, setShares] = useState<PayeeShare[]>(() => {
    if (!initialSplit) return []
    return initialSplit.shares
      .filter(s => s.payee_id !== null)
      .map(s => ({
        key: crypto.randomUUID(),
        payeeId: s.payee_id,
        amount: s.amount,
        touched: true,
        linkOpen: false,
        settlementIds: s.settlements.map(st => st.transaction_id),
      }))
  })
  const [submitError, setSubmitError] = useState('')

  const payeeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of payees ?? []) m[p.id] = p.name
    return m
  }, [payees])

  const alreadySplitExpenseIds = useMemo(() => {
    const ids: string[] = []
    for (const sp of existingSplits ?? []) {
      if (initialSplit && sp.id === initialSplit.id) continue
      for (const id of sp.expense_transaction_ids ?? []) ids.push(id)
    }
    return ids
  }, [existingSplits, initialSplit])

  const usedIncomeIds = useMemo(() => {
    const s = new Set<string>()
    for (const sp of existingSplits ?? []) {
      if (initialSplit && sp.id === initialSplit.id) continue
      for (const sh of sp.shares)
        for (const st of sh.settlements) s.add(st.transaction_id)
    }
    return s
  }, [existingSplits, initialSplit])

  // ── Transaction resolution ─────────────────────────────────────────────────
  // Resolve every referenced transaction by id. The picker primes the
  // ['transaction', id] cache on select, so these queries usually hit cache;
  // fetching per id also covers pre-selected ids from edit mode. This is the
  // single source of truth — no date-window pool, so transactions picked from
  // "last year" / "all time" search results always resolve correctly.
  const referencedIds = useMemo(
    () => [...new Set([...selectedExpenseIds, ...shares.flatMap(s => s.settlementIds)])],
    [selectedExpenseIds, shares],
  )
  const txnQueries = useQueries({
    queries: referencedIds.map(id => ({
      queryKey: ['transaction', id] as const,
      queryFn: () => apiGet<Transaction>(`/transactions/${id}`),
      staleTime: 5 * 60 * 1000,
    })),
  })
  const txnMap = useMemo(() => {
    const m: Record<string, Transaction> = {}
    for (const q of txnQueries) {
      if (q.data) m[q.data.id] = q.data
    }
    return m
  }, [txnQueries])
  const isResolving = txnQueries.some(q => q.isLoading)

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalExpense = useMemo(() =>
    selectedExpenseIds.reduce((sum, id) => sum + n(txnMap[id]?.amount), 0)
  , [selectedExpenseIds, txnMap])
  const myShareNum       = n(myShare)
  const payeeSharesTotal = shares.reduce((s, p) => s + n(p.amount), 0)
  const allocated        = myShareNum + payeeSharesTotal
  const balance          = allocated - totalExpense

  function settledTotal(p: PayeeShare): number {
    return p.settlementIds.reduce((s, id) => s + n(txnMap[id]?.amount), 0)
  }

  // ── Validation ─────────────────────────────────────────────────────────────
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

  const isPending = createSplit.isPending || updateSplit.isPending
  const canSubmit = errors.length === 0 && !isPending && !isResolving

  // ── Mutators ───────────────────────────────────────────────────────────────
  function updateShare(key: string, patch: Partial<PayeeShare>) {
    setShares(prev => prev.map(p => (p.key === key ? { ...p, ...patch } : p)))
  }
  function removeShare(key: string) {
    setShares(prev => prev.filter(p => p.key !== key))
  }
  function removeExpense(id: string) {
    setSelectedExpenseIds(prev => prev.filter(x => x !== id))
  }
  function myShareRemainder() {
    setMyShare(Math.max(0, totalExpense - payeeSharesTotal).toFixed(2))
  }
  function payeeRemainder(key: string) {
    const others = shares.filter(p => p.key !== key).reduce((s, p) => s + n(p.amount), 0)
    updateShare(key, { amount: Math.max(0, totalExpense - myShareNum - others).toFixed(2), touched: true })
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
      if (initialSplit) {
        const updated = await updateSplit.mutateAsync({ splitId: initialSplit.id, body })
        onSuccess?.(updated.id)
      } else {
        const created = await createSplit.mutateAsync(body)
        onSuccess?.(created.id)
      }
      onClose()
    } catch {
      setSubmitError(
        initialSplit
          ? 'Failed to update split. Please check the details and try again.'
          : 'Failed to create split. Please check the details and try again.'
      )
    }
  }

  const payeeOptions = (payees ?? []).map(p => ({ id: p.id, label: p.name }))
  const allocatedPct = totalExpense > 0 ? Math.min(1, allocated / totalExpense) : 0
  const balanceOk    = Math.abs(balance) <= EPS && selectedExpenseIds.length > 0
  const remaining    = Math.max(0, totalExpense - allocated)

  // Shared row renderer for a resolved (or still loading) transaction.
  function txnRow(id: string, onRemove: () => void, sign: '' | '+' = '') {
    const txn = txnMap[id]
    return (
      <div key={id} className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border last:border-0">
        {txn ? (
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 text-xs text-fg-muted tabular-nums">{txnDate(txn)}</span>
            <span className="min-w-0 truncate text-sm text-fg">{txnLabel(txn, payeeMap)}</span>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-36 animate-pulse rounded bg-surface-3" />
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {txn && (
            <span className={`kk-mono text-sm ${sign === '+' ? 'text-positive-dim' : 'text-fg'}`}>
              {sign}₹{inr(n(txn.amount))}
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-fg-muted hover:text-negative-dim"
            aria-label={sign === '+' ? 'Unlink payment' : 'Remove expense'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-5">
      {/* 1 — Expenses */}
      <DrawerSection label="Expenses">
        {/* Selected expenses — always visible, in both create and edit mode */}
        {selectedExpenseIds.length > 0 && (
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            {selectedExpenseIds.map(id => txnRow(id, () => removeExpense(id)))}
            <div className="flex items-center justify-between bg-surface-2 px-3 py-2 text-xs">
              <span className="text-fg-muted">Total to split</span>
              <span className="kk-mono font-medium text-fg">
                {isResolving ? '…' : `₹${inr(totalExpense)}`}
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setPickerOpen(v => !v)}
          className={`inline-flex items-center gap-1 text-xs text-accent hover:underline ${selectedExpenseIds.length > 0 ? 'mt-2' : ''}`}
        >
          <Plus className="h-3.5 w-3.5" />
          {pickerOpen ? 'Done adding' : 'Add expense'}
        </button>

        {pickerOpen && (
          <div className="mt-2">
            <TransactionPicker
              type="expense"
              multiple
              value={selectedExpenseIds}
              onChange={(ids) => setSelectedExpenseIds(ids as string[])}
              excludeIds={[...alreadySplitExpenseIds, ...selectedExpenseIds]}
            />
          </div>
        )}
      </DrawerSection>

      {/* 2 — Shares */}
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
                    onChange={e => updateShare(p.key, { amount: e.target.value, touched: true })}
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
                <div>
                  <p className="mb-1 text-xs text-fg-muted">Payments received</p>
                  <div className="rounded-lg border border-border bg-surface overflow-hidden">
                    {p.settlementIds.map(id =>
                      txnRow(id, () => updateShare(p.key, { settlementIds: p.settlementIds.filter(x => x !== id) }), '+'),
                    )}
                  </div>
                </div>
              )}

              {/* Link payments toggle */}
              {p.linkOpen ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-fg-muted">Link a payment they made back to you</p>
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
                      ...shares.flatMap(s => s.settlementIds),
                    ]}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => updateShare(p.key, { linkOpen: true })}
                  className="text-xs text-positive-dim hover:underline"
                  aria-label="+ Link payments"
                >
                  + Link payments
                </button>
              )}

              {payeeError[p.key] && p.touched && (
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

      {/* 3 — Balance indicator (only shown once an expense is selected) */}
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
          {!balanceOk && !isResolving && (
            <p className="text-xs text-fg-muted">
              {allocated > totalExpense
                ? `Over-allocated by ₹${inr(allocated - totalExpense)}.`
                : `₹${inr(remaining)} left to allocate.`}
            </p>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Your net expense</span>
            <span className="kk-mono font-medium text-negative-dim">₹{inr(myShareNum)}</span>
          </div>
        </div>
      )}

      {submitError && <p role="alert" className="text-sm text-negative-dim">{submitError}</p>}

      {/* 4 — Notes */}
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
          {initialSplit ? (updateSplit.isPending ? 'Saving…' : 'Save Changes') : (createSplit.isPending ? 'Creating…' : 'Create Split')}
        </button>
      </div>
    </div>
  )
}
