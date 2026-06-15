import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
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
import { useTransactions } from '../../api/transactions'
import { usePayees, useCreatePayee } from '../../api/payees'
import Autocomplete from '../Autocomplete'
import ConfirmDialog from '../ConfirmDialog'

const STATUS_CLS: Record<SplitShareStatus, string> = {
  pending:  'kk-chip kk-chip-warning',
  settled:  'kk-chip kk-chip-positive',
  forgiven: 'kk-chip kk-chip-neutral',
}

function fmt(amount: string | number) {
  return parseFloat(String(amount)).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function SettlementRow({
  s,
  txnMap,
  splitId,
  shareId,
}: {
  s: SplitShareSettlement
  txnMap: Record<string, { description: string | null; amount: string }>
  splitId: string
  shareId: string
}) {
  const unlink = useUnlinkSettlement(splitId)
  const txn = txnMap[s.transaction_id]
  const label = txn?.description ?? `Payment ${s.transaction_id.slice(0, 8)}…`
  const date = new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

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
      const body: Record<string, unknown> = { amount }
      // Always send payee_id so we can explicitly null it out
      body.payee_id = payeeId ?? null
      await patch.mutateAsync({ shareId: share.id, patch: body })
      onDone()
    } catch {
      setError('Save failed. Check that payee is not already on another share.')
    }
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-surface-2 p-3 space-y-2 mt-2">
      <p className="text-xs font-medium text-fg-muted">Edit share</p>
      <div>
        <label className="text-xs text-fg-muted block mb-1">Payee</label>
        <Autocomplete
          options={payeeOptions}
          value={payeeId}
          onChange={setPayeeId}
          placeholder="Search or create payee…"
          onInlineCreate={onCreatePayee}
        />
      </div>
      <div>
        <label className="text-xs text-fg-muted block mb-1">Amount (₹)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="kk-input text-sm"
        />
      </div>
      {error && <p className="text-xs text-negative-dim">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onDone} className="kk-btn-ghost flex-1 justify-center text-xs">Cancel</button>
        <button
          onClick={handleSave}
          disabled={patch.isPending}
          className="flex-1 rounded-md bg-accent-dim px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {patch.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function ShareRow({
  share,
  splitId,
  payeeName,
  payeeOptions,
  onCreatePayee,
  txnMap,
  incomeTransactions,
}: {
  share: SplitShare
  splitId: string
  payeeName: string
  payeeOptions: Array<{ id: string; label: string }>
  onCreatePayee: (name: string) => Promise<{ id: string; label: string }>
  txnMap: Record<string, { description: string | null; amount: string }>
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

  const paid     = parseFloat(share.paid_amount)
  const forgiven = parseFloat(share.forgiven_amount)
  const total    = parseFloat(share.amount)
  const remaining = Math.max(0, total - paid - forgiven)
  const isResolved = remaining <= 0
  const hasActivity = paid > 0 || forgiven > 0

  const selectedTxn = incomeTransactions.find(t => t.id === settleTxnId)

  function onTxnSelect(txnId: string) {
    setSettleTxnId(txnId)
    const t = incomeTransactions.find(i => i.id === txnId)
    if (t) {
      const capped = Math.min(parseFloat(t.amount), remaining)
      setSettleAmount(capped.toFixed(2))
    }
  }

  async function handleSettle() {
    if (!settleTxnId) return
    const body: { transaction_id: string; amount?: string } = { transaction_id: settleTxnId }
    if (settleAmount && settleAmount !== selectedTxn?.amount) body.amount = settleAmount
    await settle.mutateAsync({ shareId: share.id, body })
    setSettleOpen(false); setSettleTxnId(''); setSettleAmount('')
  }

  async function handleForgive() {
    await forgive.mutateAsync({ shareId: share.id, amount: forgiveAmount })
    setForgiveOpen(false); setForgiveAmount('')
  }

  return (
    <div className="border-b border-border last:border-0 py-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium ${share.payee_id ? 'text-fg' : 'text-fg-muted italic'}`}>
              {payeeName}
            </p>
            <button
              type="button"
              onClick={() => { setEditOpen(v => !v); setSettleOpen(false); setForgiveOpen(false) }}
              title="Edit share"
              className="text-fg-faint hover:text-accent transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-fg-faint kk-mono mt-0.5">₹{fmt(share.amount)}</p>
        </div>
        <span className={`${STATUS_CLS[share.status]} shrink-0`}>{share.status}</span>
      </div>

      {/* Inline edit form */}
      {editOpen && (
        <EditShareForm
          share={share}
          splitId={splitId}
          payeeOptions={payeeOptions}
          onCreatePayee={onCreatePayee}
          onDone={() => setEditOpen(false)}
        />
      )}

      {/* Progress breakdown */}
      {hasActivity && (
        <div className="flex gap-3 text-xs flex-wrap">
          {paid > 0 && <span className="text-positive-dim">Paid ₹{fmt(paid)}</span>}
          {forgiven > 0 && <span className="text-fg-muted">Forgiven ₹{fmt(forgiven)}</span>}
          {!isResolved && remaining > 0 && <span className="text-warning-dim">Remaining ₹{fmt(remaining)}</span>}
        </div>
      )}

      {/* Settlement rows */}
      {share.settlements.length > 0 && (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-1">
          {share.settlements.map(s => (
            <SettlementRow key={s.id} s={s} txnMap={txnMap} splitId={splitId} shareId={share.id} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isResolved && (
          <>
            <button onClick={() => { setSettleAmount(remaining.toFixed(2)); setSettleOpen(true); setEditOpen(false) }}
              className="text-xs text-positive-dim hover:underline">
              + Add payment
            </button>
            <button onClick={() => { setForgiveAmount(remaining.toFixed(2)); setForgiveOpen(true); setEditOpen(false) }}
              className="text-xs text-fg-muted hover:underline">
              {forgiven > 0 ? 'Update forgiven' : 'Forgive'}
            </button>
          </>
        )}
        {hasActivity && (
          <button onClick={() => setUnsettleOpen(true)} className="text-xs text-warning-dim hover:underline">
            Reset
          </button>
        )}
      </div>

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
          {settleTxnId && (
            <div>
              <label className="text-xs text-fg-muted block mb-1">
                Amount to credit <span className="text-fg-faint">(max ₹{fmt(remaining)})</span>
              </label>
              <input type="number" step="0.01" min="0.01" max={remaining} value={settleAmount}
                onChange={e => setSettleAmount(e.target.value)} className="kk-input text-sm" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setSettleOpen(false); setSettleTxnId(''); setSettleAmount('') }}
              className="kk-btn-ghost flex-1 justify-center">Cancel</button>
            <button onClick={handleSettle} disabled={!settleTxnId || !settleAmount || settle.isPending}
              className="flex-1 rounded-md border border-positive/30 bg-positive/10 py-1.5 text-xs font-medium text-positive-dim disabled:opacity-50">
              {settle.isPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Forgive inline form */}
      {forgiveOpen && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
          <p className="text-xs font-medium text-fg-muted">
            Forgive amount
            {forgiven > 0 && <span className="text-fg-faint ml-1">(currently ₹{fmt(forgiven)})</span>}
          </p>
          <div className="flex gap-2 items-center">
            <input type="number" step="0.01" min="0" max={total - paid} value={forgiveAmount}
              onChange={e => setForgiveAmount(e.target.value)} className="kk-input text-sm flex-1" />
            <button onClick={() => setForgiveAmount((total - paid).toFixed(2))}
              className="text-xs text-accent hover:underline whitespace-nowrap">
              All remaining
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setForgiveOpen(false); setForgiveAmount('') }}
              className="kk-btn-ghost flex-1 justify-center">Cancel</button>
            <button onClick={handleForgive} disabled={!forgiveAmount || forgive.isPending}
              className="flex-1 rounded-md border border-border bg-surface-3 py-1.5 text-xs font-medium text-fg-muted disabled:opacity-50">
              {forgive.isPending ? 'Saving…' : 'Set forgiven'}
            </button>
          </div>
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

interface Props {
  splitId: string | null
  onClose: () => void
}

export function SplitDrawer({ splitId, onClose }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { data: split, isLoading } = useGetSplit(splitId)
  const { data: payeesRaw = [] } = usePayees()
  const { data: txnData } = useTransactions({ type: 'income' })
  const deleteSplit = useDeleteSplit()
  const createPayeeMutation = useCreatePayee()

  const payeeMap: Record<string, string> = {}
  for (const p of payeesRaw) payeeMap[p.id] = p.name
  const payeeOptions = payeesRaw.map(p => ({ id: p.id, label: p.name }))

  const txnMap: Record<string, { description: string | null; amount: string }> = {}
  for (const t of txnData?.items ?? []) txnMap[t.id] = { description: t.description, amount: t.amount }
  const incomeTransactions = txnData?.items ?? []

  const netExpense = split?.shares.reduce((sum, s) => {
    const own     = s.payee_id === null ? parseFloat(s.amount) : 0
    const forgiven = parseFloat(s.forgiven_amount)
    return sum + own + forgiven
  }, 0) ?? 0

  const totalAmount = split?.shares.reduce((sum, s) => sum + parseFloat(s.amount), 0) ?? 0

  async function handleCreatePayee(name: string) {
    const p = await createPayeeMutation.mutateAsync({ name, type: 'merchant' })
    return { id: p.id, label: p.name }
  }

  return (
    <Drawer open={!!splitId} onClose={onClose} title={split?.notes ?? 'Split detail'}>
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
                  payeeName={share.payee_id ? (payeeMap[share.payee_id] ?? share.payee_id.slice(0, 8)) : 'Blank Payee'}
                  payeeOptions={payeeOptions}
                  onCreatePayee={handleCreatePayee}
                  txnMap={txnMap}
                  incomeTransactions={incomeTransactions}
                />
              ))}
            </div>
          </DrawerSection>

          {/* Notes */}
          {split.notes && (
            <DrawerSection label="Notes">
              <p className="text-sm text-fg-dim">{split.notes}</p>
            </DrawerSection>
          )}

          {/* Meta */}
          <DrawerSection label="Details">
            <div className="kk-panel text-xs text-fg-muted space-y-1">
              {split.expense_transaction_ids.map((id) => (
                <p key={id}>Expense: <span className="kk-mono">{id.slice(0, 16)}…</span></p>
              ))}
              <p>Created {new Date(split.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </DrawerSection>

          {/* Danger zone */}
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 text-xs text-negative-dim hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete split
            </button>
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
