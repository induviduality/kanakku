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
  const expenseMap = useMemo(() => {
    const m: Record<string, Transaction> = {}
    for (const t of expenseTxns) m[t.id] = t
    return m
  }, [expenseTxns])

  const incomeMap   = useMemo(() => {
    const m: Record<string, Transaction> = {}
    for (const t of incomePool?.items ?? []) m[t.id] = t
    return m
  }, [incomePool])

  // ── Derived totals ───────────────────────────────────────────────────────
  const totalExpense = useMemo(() =>
    selectedExpenseIds.reduce((sum, id) => {
      const t = expenseMap[id]
      return sum + (t ? n(t.amount) : 0)
    }, 0)
  , [selectedExpenseIds, expenseMap])
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
                  aria-label="+ Link payments"
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
