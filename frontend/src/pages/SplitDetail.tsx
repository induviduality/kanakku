import { useState, useMemo } from 'react'
import { Pencil } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import {
  useGetSplit,
  useSettleShare,
  useForgiveShare,
  useUnsettleShare,
  useUnlinkSettlement,
  usePatchShare,
  type SplitShare,
  type SplitShareSettlement,
  type SplitShareStatus,
} from '../api/splits'
import { useTransactions, type Transaction } from '../api/transactions'
import { usePayees, useCreatePayee } from '../api/payees'
import { apiGet } from '../lib/api-client'
import Autocomplete from '../components/Autocomplete'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUS_BADGES: Record<SplitShareStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  settled: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  forgiven: 'bg-surface-3 text-fg-muted',
}

function fmt(v: string | number) {
  return parseFloat(String(v)).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function SettlementItem({
  s, txnMap, splitId, shareId,
}: {
  s: SplitShareSettlement
  txnMap: Record<string, Transaction>
  splitId: string
  shareId: string
}) {
  const unlink = useUnlinkSettlement(splitId)
  const txn = txnMap[s.transaction_id]
  const label = txn?.description ?? `Payment ${s.transaction_id.slice(0, 8)}…`
  const date = new Date(txn?.transacted_at ?? s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <li className="flex items-center justify-between gap-2 py-1 text-xs">
      <div className="min-w-0">
        <span className="text-fg truncate block">{label}</span>
        <span className="text-fg-faint kk-mono">₹{fmt(s.amount)} · {date}</span>
      </div>
      <button
        onClick={() => unlink.mutate({ shareId, settlementId: s.id })}
        disabled={unlink.isPending}
        className="text-negative-dim hover:underline disabled:opacity-40"
      >×</button>
    </li>
  )
}

function EditShareForm({
  share,
  splitId,
  payeeOptions,
  onCreatePayee,
  onDone,
}: {
  share: SplitShare
  splitId: string
  payeeOptions: Array<{ id: string; label: string }>
  onCreatePayee: (name: string) => Promise<{ id: string; label: string }>
  onDone: () => void
}) {
  const patch = usePatchShare(splitId)
  const [payeeId, setPayeeId] = useState<string | null>(share.payee_id ?? null)
  const [amount, setAmount] = useState(share.amount)
  const [error, setError] = useState('')

  async function handleSave() {
    setError('')
    if (!amount || Number(amount) <= 0) { setError('Amount must be positive'); return }
    try {
      await patch.mutateAsync({ shareId: share.id, patch: { amount, payee_id: payeeId ?? null } })
      onDone()
    } catch {
      setError('Save failed. Check that payee is not already on another share.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-xl p-6 w-80 space-y-3">
        <h3 className="text-base font-semibold text-fg">Edit share</h3>
        <div>
          <label className="block text-sm text-fg-muted mb-1">Payee</label>
          <Autocomplete
            options={payeeOptions}
            value={payeeId}
            onChange={setPayeeId}
            placeholder="Search or create payee…"
            onInlineCreate={onCreatePayee}
          />
        </div>
        <div>
          <label className="block text-sm text-fg-muted mb-1">Amount (₹)</label>
          <input
            type="number" step="0.01" min="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="kk-input"
          />
        </div>
        {error && <p className="text-xs text-negative-dim">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onDone}
            className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm text-fg">
            Cancel
          </button>
          <button onClick={handleSave} disabled={patch.isPending}
            className="flex-1 rounded-md bg-accent-dim px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {patch.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShareRow({
  share, splitId, payeeName, payeeOptions, onCreatePayee, txnMap, incomeTransactions,
}: {
  share: SplitShare
  splitId: string
  payeeName: string
  payeeOptions: Array<{ id: string; label: string }>
  onCreatePayee: (name: string) => Promise<{ id: string; label: string }>
  txnMap: Record<string, Transaction>
  incomeTransactions: Array<{ id: string; description: string | null; amount: string }>
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [settleOpen, setSettleOpen] = useState(false)
  const [forgiveOpen, setForgiveOpen] = useState(false)
  const [unsettleOpen, setUnsettleOpen] = useState(false)
  const [settleTxnId, setSettleTxnId] = useState('')
  const [settleAmount, setSettleAmount] = useState('')
  const [forgiveAmount, setForgiveAmount] = useState('')

  const settle   = useSettleShare(splitId)
  const forgive  = useForgiveShare(splitId)
  const unsettle = useUnsettleShare(splitId)

  const paid      = parseFloat(share.paid_amount)
  const forgiven  = parseFloat(share.forgiven_amount)
  const total     = parseFloat(share.amount)
  const remaining = Math.max(0, total - paid - forgiven)
  const isResolved  = remaining <= 0
  const hasActivity = paid > 0 || forgiven > 0

  function onTxnSelect(id: string) {
    setSettleTxnId(id)
    const t = incomeTransactions.find(i => i.id === id)
    if (t) setSettleAmount(Math.min(parseFloat(t.amount), remaining).toFixed(2))
  }

  async function handleSettle() {
    if (!settleTxnId) return
    const body: { transaction_id: string; amount?: string } = { transaction_id: settleTxnId }
    if (settleAmount && settleAmount !== incomeTransactions.find(t => t.id === settleTxnId)?.amount)
      body.amount = settleAmount
    await settle.mutateAsync({ shareId: share.id, body })
    setSettleOpen(false); setSettleTxnId(''); setSettleAmount('')
  }

  async function handleForgive() {
    await forgive.mutateAsync({ shareId: share.id, amount: forgiveAmount })
    setForgiveOpen(false); setForgiveAmount('')
  }

  return (
    <>
      {editOpen && (
        <EditShareForm
          share={share}
          splitId={splitId}
          payeeOptions={payeeOptions}
          onCreatePayee={onCreatePayee}
          onDone={() => setEditOpen(false)}
        />
      )}
      <tr className="border-t border-gray-200 dark:border-border align-top">
        {/* Payee */}
        <td className="py-3 px-4 text-sm">
          <div className="flex items-center gap-1.5">
            {share.payee_id
              ? <span className="font-medium text-fg">{payeeName}</span>
              : <span className="text-fg-muted italic">Your share</span>}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              title="Edit share"
              className="text-fg-faint hover:text-accent transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        </td>
        {/* Amount + breakdown */}
        <td className="py-3 px-4 text-sm text-right kk-mono">
          <div>₹{fmt(share.amount)}</div>
          {hasActivity && (
            <div className="text-xs text-fg-faint space-y-0.5 mt-0.5">
              {paid > 0 && <div className="text-positive-dim">Paid ₹{fmt(paid)}</div>}
              {forgiven > 0 && <div>Forgiven ₹{fmt(forgiven)}</div>}
              {!isResolved && <div className="text-warning-dim">Due ₹{fmt(remaining)}</div>}
            </div>
          )}
        </td>
        {/* Status */}
        <td className="py-3 px-4 text-center">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[share.status]}`}>
            {share.status}
          </span>
        </td>
        {/* Settlements + Actions */}
        <td className="py-3 px-4">
          {share.settlements.length > 0 && (
            <ul className="mb-2 space-y-0.5">
              {share.settlements.map(s => (
                <SettlementItem key={s.id} s={s} txnMap={txnMap} splitId={splitId} shareId={share.id} />
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {share.payee_id !== null && !isResolved && (
              <>
                <button onClick={() => { setSettleAmount(remaining.toFixed(2)); setSettleOpen(true) }}
                  className="text-xs text-green-700 hover:underline">
                  + Payment
                </button>
                <button onClick={() => { setForgiveAmount(remaining.toFixed(2)); setForgiveOpen(true) }}
                  className="text-xs text-gray-500 hover:underline">
                  {forgiven > 0 ? 'Edit forgiven' : 'Forgive'}
                </button>
              </>
            )}
            {share.payee_id !== null && hasActivity && (
              <button onClick={() => setUnsettleOpen(true)} className="text-xs text-amber-600 hover:underline">
                Reset
              </button>
            )}
          </div>

          {settleOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-surface rounded-xl shadow-xl p-6 w-80 space-y-3">
                <h3 className="text-base font-semibold text-fg">Link payment</h3>
                <label className="block text-sm text-fg-muted">Income transaction</label>
                <select value={settleTxnId} onChange={e => onTxnSelect(e.target.value)} className="kk-input">
                  <option value="">Select…</option>
                  {incomeTransactions.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.description ?? t.id.slice(0, 8)} — ₹{t.amount}
                    </option>
                  ))}
                </select>
                {settleTxnId && (
                  <div>
                    <label className="block text-sm text-fg-muted mb-1">
                      Credit amount <span className="text-fg-faint text-xs">(max ₹{fmt(remaining)})</span>
                    </label>
                    <input type="number" step="0.01" min="0.01" max={remaining}
                      value={settleAmount} onChange={e => setSettleAmount(e.target.value)} className="kk-input" />
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setSettleOpen(false); setSettleTxnId(''); setSettleAmount('') }}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm text-fg">
                    Cancel
                  </button>
                  <button onClick={handleSettle} disabled={!settleTxnId || !settleAmount || settle.isPending}
                    className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
                    {settle.isPending ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {forgiveOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-surface rounded-xl shadow-xl p-6 w-80 space-y-3">
                <h3 className="text-base font-semibold text-fg">Forgive share</h3>
                {forgiven > 0 && <p className="text-sm text-fg-muted">Currently forgiven: ₹{fmt(forgiven)}</p>}
                <div>
                  <label className="block text-sm text-fg-muted mb-1">
                    Forgiven amount <span className="text-fg-faint text-xs">(max ₹{fmt(total - paid)})</span>
                  </label>
                  <input type="number" step="0.01" min="0" max={total - paid}
                    value={forgiveAmount} onChange={e => setForgiveAmount(e.target.value)} className="kk-input" />
                  <button onClick={() => setForgiveAmount((total - paid).toFixed(2))}
                    className="text-xs text-accent hover:underline mt-1">
                    Set to full remaining
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setForgiveOpen(false); setForgiveAmount('') }}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm text-fg">
                    Cancel
                  </button>
                  <button onClick={handleForgive} disabled={!forgiveAmount || forgive.isPending}
                    className="flex-1 rounded-md border border-border bg-surface-3 px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                    {forgive.isPending ? 'Saving…' : 'Set forgiven'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={unsettleOpen}
            title="Reset share"
            description="Remove all linked payments and forgiveness for this share."
            onConfirm={() => { unsettle.mutate(share.id); setUnsettleOpen(false) }}
            onCancel={() => setUnsettleOpen(false)}
          />
        </td>
      </tr>
    </>
  )
}

export default function SplitDetail() {
  const { splitId } = useParams({ strict: false }) as { splitId: string }
  const { data: split, isLoading, isError } = useGetSplit(splitId)
  const { data: payeesRaw = [] } = usePayees()
  const { data: txnData } = useTransactions({ type: 'income' })
  const createPayeeMutation = useCreatePayee()

  // Collect settlement transaction IDs so we can fetch each individually
  const settlementTxnIds = useMemo(() => {
    if (!split) return []
    return [...new Set(split.shares.flatMap(s => s.settlements.map(st => st.transaction_id)))]
  }, [split])

  // Fetch each settlement transaction by ID so labels work regardless of page/date
  const settlementTxnQueries = useQueries({
    queries: settlementTxnIds.map(id => ({
      queryKey: ['transaction', id] as const,
      queryFn: () => apiGet<Transaction>(`/transactions/${id}`),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const txnMap = useMemo(() => {
    const m: Record<string, Transaction> = {}
    for (const q of settlementTxnQueries) {
      if (q.data) m[q.data.id] = q.data
    }
    return m
  }, [settlementTxnQueries])

  const payeeMap: Record<string, string> = {}
  for (const p of payeesRaw) payeeMap[p.id] = p.name
  const payeeOptions = payeesRaw.map(p => ({ id: p.id, label: p.name }))

  const incomeTransactions: Array<{ id: string; description: string | null; amount: string }> = []
  for (const t of txnData?.items ?? []) {
    incomeTransactions.push({ id: t.id, description: t.description, amount: t.amount })
  }

  async function handleCreatePayee(name: string) {
    const p = await createPayeeMutation.mutateAsync({ name, type: 'merchant' })
    return { id: p.id, label: p.name }
  }

  if (isLoading) return <div className="p-8 text-fg-muted">Loading…</div>
  if (isError || !split) return <div className="p-8 text-negative-dim">Split not found.</div>

  const totalAmount = split.shares.reduce((sum, s) => sum + parseFloat(s.amount), 0)
  const netExpense  = split.shares.reduce((sum, s) => {
    return sum + (s.payee_id === null ? parseFloat(s.amount) : 0) + parseFloat(s.forgiven_amount)
  }, 0)

  return (
    <main className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-fg mb-1">{split.notes ?? 'Split Detail'}</h1>
      <p className="text-sm text-fg-muted mb-6">
        {split.expense_transaction_ids.map((id, i) => (
          <span key={id}>{i > 0 ? ', ' : 'Expense: '}<span className="kk-mono">{id.slice(0, 16)}…</span></span>
        ))}
      </p>

      <div className="rounded-lg border border-border overflow-hidden mb-6">
        <div className="bg-surface-2 px-4 py-3 flex justify-between text-sm border-b border-border">
          <span className="font-medium text-fg">Total: <span className="kk-mono">₹{fmt(totalAmount)}</span></span>
          <span className="text-negative-dim font-medium">Net expense: <span className="kk-mono">₹{fmt(netExpense)}</span></span>
        </div>
        <table className="w-full">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="py-2 px-4 text-left text-xs font-medium text-fg-muted uppercase tracking-wide">Payee</th>
              <th className="py-2 px-4 text-right text-xs font-medium text-fg-muted uppercase tracking-wide">Amount</th>
              <th className="py-2 px-4 text-center text-xs font-medium text-fg-muted uppercase tracking-wide">Status</th>
              <th className="py-2 px-4 text-left text-xs font-medium text-fg-muted uppercase tracking-wide">Payments / Actions</th>
            </tr>
          </thead>
          <tbody>
            {split.shares.map(share => (
              <ShareRow
                key={share.id}
                share={share}
                splitId={split.id}
                payeeName={share.payee_id ? (payeeMap[share.payee_id] ?? share.payee_id.slice(0, 8)) : 'Your share'}
                payeeOptions={payeeOptions}
                onCreatePayee={handleCreatePayee}
                txnMap={txnMap}
                incomeTransactions={incomeTransactions}
              />
            ))}
          </tbody>
        </table>
      </div>

      {split.notes && (
        <p className="text-sm text-fg-muted italic">Notes: {split.notes}</p>
      )}
    </main>
  )
}
