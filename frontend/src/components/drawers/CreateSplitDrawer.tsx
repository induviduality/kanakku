import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Drawer, DrawerSection } from '../Drawer'
import Autocomplete from '../Autocomplete'
import { useCreateSplit, useListSplits, type SplitShareCreate } from '../../api/splits'
import { useTransactions, type Transaction } from '../../api/transactions'
import { usePayees, useCreatePayee } from '../../api/payees'
import { useAccounts } from '../../api/accounts'

// ── Helpers ─────────────────────────────────────────────────────────────────

const EPS = 0.005

function n(v: string | number | null | undefined): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function inr(v: number): string {
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function txnLabel(t: { description: string | null; payee_id: string | null }, payeeMap: Record<string, string>): string {
  if (t.description) return t.description
  if (t.payee_id && payeeMap[t.payee_id]) return payeeMap[t.payee_id]
  return 'Transaction'
}

interface PayeeShare {
  key: string
  payeeId: string | null
  amount: string
  forgiveOpen: boolean
  forgiven: string
  linkOpen: boolean
  settlementIds: string[]
}

function newPayeeShare(): PayeeShare {
  return {
    key: crypto.randomUUID(),
    payeeId: null,
    amount: '',
    forgiveOpen: false,
    forgiven: '',
    linkOpen: false,
    settlementIds: [],
  }
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
  const { data: expenseData } = useTransactions({ type: 'expense' })
  const { data: incomeData } = useTransactions({ type: 'income' })
  const { data: payees } = usePayees()
  const { data: accounts } = useAccounts()
  const { data: existingSplits } = useListSplits()
  const createPayee = useCreatePayee()
  const createSplit = useCreateSplit()

  const [expenseSearch, setExpenseSearch] = useState('')
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([])
  const [myShare, setMyShare] = useState('')
  const [shares, setShares] = useState<PayeeShare[]>([])
  const [notes, setNotes] = useState('')
  const [submitError, setSubmitError] = useState('')

  const payeeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of payees ?? []) m[p.id] = p.name
    return m
  }, [payees])

  const accountMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of accounts ?? []) m[a.id] = a.name
    return m
  }, [accounts])

  // Income transactions already used as settlements in any existing split.
  const usedIncomeIds = useMemo(() => {
    const s = new Set<string>()
    for (const sp of existingSplits ?? [])
      for (const sh of sp.shares)
        for (const st of sh.settlements) s.add(st.transaction_id)
    return s
  }, [existingSplits])

  const expenseTxns = expenseData?.items ?? []
  const incomeTxns = incomeData?.items ?? []
  const incomeMap = useMemo(() => {
    const m: Record<string, Transaction> = {}
    for (const t of incomeTxns) m[t.id] = t
    return m
  }, [incomeTxns])

  // Income txn ids already linked to a card in this form.
  const stagedIncomeIds = useMemo(() => {
    const s = new Set<string>()
    for (const sh of shares) for (const id of sh.settlementIds) s.add(id)
    return s
  }, [shares])

  // ── Derived totals ──
  const totalExpense = selectedExpenseIds.reduce((sum, id) => {
    const t = expenseTxns.find(e => e.id === id)
    return sum + (t ? n(t.amount) : 0)
  }, 0)
  const myShareNum = n(myShare)
  const payeeSharesTotal = shares.reduce((s, p) => s + n(p.amount), 0)
  const sharesTotal = myShareNum + payeeSharesTotal
  const balance = sharesTotal - totalExpense
  const forgivenTotal = shares.reduce((s, p) => s + n(p.forgiven), 0)
  const netExpense = myShareNum + forgivenTotal

  function settledTotal(p: PayeeShare): number {
    return p.settlementIds.reduce((s, id) => s + n(incomeMap[id]?.amount), 0)
  }

  // ── Per-card validation ──
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
    if (!payeeError[p.key] && n(p.amount) <= 0) {
      payeeError[p.key] = 'Enter a valid amount for this payee.'
    }
    if (!payeeError[p.key]) {
      const over = settledTotal(p) + n(p.forgiven) - n(p.amount)
      if (over > EPS) {
        payeeError[p.key] = `Paid + forgiven (₹${inr(settledTotal(p) + n(p.forgiven))}) cannot exceed this payee's share (₹${inr(n(p.amount))}).`
      }
    }
  }

  // ── Global validation ──
  const errors: string[] = []
  if (selectedExpenseIds.length === 0) errors.push('Select at least one expense transaction.')
  if (myShareNum < 0) errors.push('Your share cannot be negative.')
  if (selectedExpenseIds.length > 0 && Math.abs(balance) > EPS)
    errors.push(`Shares must add up to ₹${inr(totalExpense)}.`)
  errors.push(...Object.values(payeeError))

  const canSubmit = errors.length === 0 && !createSplit.isPending

  // ── Mutators ──
  function toggleExpense(id: string) {
    setSelectedExpenseIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }
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
        ...(n(p.forgiven) > 0 && { forgiven_amount: n(p.forgiven).toFixed(2) }),
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

  const filteredExpenses = expenseTxns.filter(t => {
    if (!expenseSearch.trim()) return true
    const q = expenseSearch.toLowerCase()
    return txnLabel(t, payeeMap).toLowerCase().includes(q)
  })

  const payeeOptions = (payees ?? []).map(p => ({ id: p.id, label: p.name }))

  return (
    <div className="space-y-6 p-5">
      {/* Section 1 — Expense transactions */}
      <DrawerSection label="Expense transactions">
        <input
          type="text"
          value={expenseSearch}
          onChange={e => setExpenseSearch(e.target.value)}
          placeholder="Search expenses…"
          aria-label="Search expenses"
          className="kk-input mb-2"
        />
        <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-surface-2">
          {filteredExpenses.length === 0 ? (
            <p className="p-3 text-xs text-fg-faint">No expense transactions found.</p>
          ) : (
            filteredExpenses.map(t => {
              const disabled = t.is_split
              const checked = selectedExpenseIds.includes(t.id)
              const date = new Date(t.transacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 text-sm ${
                    disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-3'
                  }`}
                  title={disabled ? 'Already in a split' : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleExpense(t.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-fg">{txnLabel(t, payeeMap)}</p>
                    <p className="text-xs text-fg-faint">
                      {date} · {accountMap[t.account_id] ?? '—'}
                      {disabled && <span className="ml-1">· in a split</span>}
                    </p>
                  </div>
                  <span className="kk-mono text-negative-dim shrink-0">₹{inr(n(t.amount))}</span>
                </label>
              )
            })
          )}
        </div>
        {selectedExpenseIds.length > 0 && (
          <p className="mt-2 text-xs text-fg-muted">
            Total selected: <span className="kk-mono text-fg">₹{inr(totalExpense)}</span>
          </p>
        )}
      </DrawerSection>

      {/* Section 2 — My share */}
      <DrawerSection label="My share">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="my-share" className="mb-1 block text-xs text-fg-muted">My share amount</label>
            <input
              id="my-share"
              type="number"
              step="0.01"
              min="0"
              value={myShare}
              onChange={e => setMyShare(e.target.value)}
              placeholder="0.00"
              className="kk-input"
            />
          </div>
          <button type="button" onClick={myShareRemainder} className="kk-btn-ghost shrink-0">
            Use remainder
          </button>
        </div>
        <p className="mt-1 text-xs text-fg-faint">
          Your net expense = my share + forgiven amounts (FR-7.9).
        </p>
      </DrawerSection>

      {/* Section 3 — Payee shares */}
      <DrawerSection label="Payee shares">
        <div className="space-y-3">
          {shares.map(p => (
            <div key={p.key} className="kk-panel space-y-3">
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
                <button type="button" onClick={() => payeeRemainder(p.key)} className="kk-btn-ghost shrink-0">
                  Use remainder
                </button>
              </div>

              {/* Forgive */}
              {p.forgiveOpen ? (
                <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.forgiven}
                      onChange={e => updateShare(p.key, { forgiven: e.target.value })}
                      placeholder="Forgiven amount"
                      aria-label="Forgiven amount"
                      className="kk-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => updateShare(p.key, { forgiven: Math.max(0, n(p.amount) - settledTotal(p)).toFixed(2) })}
                      className="text-xs text-accent hover:underline whitespace-nowrap"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => updateShare(p.key, { forgiveOpen: false, forgiven: '' })}
                      className="text-xs text-fg-muted hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  {n(p.forgiven) > 0 && (
                    <p className="text-xs text-fg-faint">
                      Payee effectively owes ₹{inr(Math.max(0, n(p.amount) - n(p.forgiven)))} after forgiveness.
                    </p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => updateShare(p.key, { forgiveOpen: true })}
                  className="text-xs text-fg-muted hover:underline"
                >
                  Forgive part of this share
                </button>
              )}

              {/* Settlement transactions */}
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

              {p.linkOpen ? (
                <LinkTransactionPanel
                  incomeTxns={incomeTxns}
                  payeeMap={payeeMap}
                  accountMap={accountMap}
                  isExcluded={id => usedIncomeIds.has(id) || stagedIncomeIds.has(id)}
                  onPick={id => updateShare(p.key, { settlementIds: [...p.settlementIds, id], linkOpen: false })}
                  onCancel={() => updateShare(p.key, { linkOpen: false })}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => updateShare(p.key, { linkOpen: true })}
                  className="text-xs text-positive-dim hover:underline"
                >
                  + Link transaction
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

      {/* Section 4 — Balance */}
      <DrawerSection label="Balance check">
        <div className="kk-panel space-y-1.5 text-xs">
          <Row label="Total expense" value={`₹${inr(totalExpense)}`} />
          <Row label="My share" value={`₹${inr(myShareNum)}`} />
          <Row label="Payee shares" value={`₹${inr(payeeSharesTotal)}`} />
          <hr className="kk-divider" />
          <Row
            label="Balance"
            value={`₹${inr(balance)}`}
            valueClass={Math.abs(balance) <= EPS ? 'text-positive-dim' : 'text-negative-dim'}
          />
          {forgivenTotal > 0 && <Row label="Forgiven (total)" value={`₹${inr(forgivenTotal)}`} />}
          <Row label="Your net expense" value={`₹${inr(netExpense)}`} valueClass="text-negative-dim font-semibold" />
        </div>
      </DrawerSection>

      {/* Section 5 — Notes */}
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

      {submitError && <p role="alert" className="text-sm text-negative-dim">{submitError}</p>}

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

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-fg-muted">{label}</span>
      <span className={`kk-mono ${valueClass ?? 'text-fg'}`}>{value}</span>
    </div>
  )
}

function LinkTransactionPanel({
  incomeTxns,
  payeeMap,
  accountMap,
  isExcluded,
  onPick,
  onCancel,
}: {
  incomeTxns: Transaction[]
  payeeMap: Record<string, string>
  accountMap: Record<string, string>
  isExcluded: (id: string) => boolean
  onPick: (id: string) => void
  onCancel: () => void
}) {
  const [search, setSearch] = useState('')
  const results = incomeTxns.filter(t => {
    if (isExcluded(t.id)) return false
    if (!search.trim()) return true
    return txnLabel(t, payeeMap).toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-muted">Link income transaction</p>
        <button type="button" onClick={onCancel} className="text-xs text-fg-muted hover:underline">
          Cancel
        </button>
      </div>
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search income…"
        aria-label="Search income"
        className="kk-input"
      />
      <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-surface-1">
        {results.length === 0 ? (
          <p className="p-2 text-xs text-fg-faint">No available income transactions.</p>
        ) : (
          results.map(t => {
            const date = new Date(t.transacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t.id)}
                className="flex w-full items-center gap-2 px-3 py-2 border-b border-border last:border-0 text-left text-sm hover:bg-surface-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-fg">{txnLabel(t, payeeMap)}</p>
                  <p className="text-xs text-fg-faint">{date} · {accountMap[t.account_id] ?? '—'}</p>
                </div>
                <span className="kk-mono text-positive-dim shrink-0">+₹{inr(n(t.amount))}</span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
