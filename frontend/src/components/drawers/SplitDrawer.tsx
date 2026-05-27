import { useState } from 'react'
import { Drawer, DrawerSection } from '../Drawer'
import {
  useGetSplit,
  useSettleShare,
  useForgiveShare,
  useUnsettleShare,
  useUnlinkSettlement,
  type SplitShare,
  type SplitShareSettlement,
  type SplitShareStatus,
} from '../../api/splits'
import { useTransactions } from '../../api/transactions'
import { usePayees } from '../../api/payees'
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

function ShareRow({
  share,
  splitId,
  payeeName,
  txnMap,
  incomeTransactions,
}: {
  share: SplitShare
  splitId: string
  payeeName: string | null
  txnMap: Record<string, { description: string | null; amount: string }>
  incomeTransactions: Array<{ id: string; description: string | null; amount: string }>
}) {
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

  function openSettle() {
    setSettleAmount(remaining.toFixed(2))
    setSettleOpen(true)
  }

  function openForgive() {
    setForgiveAmount(remaining.toFixed(2))
    setForgiveOpen(true)
  }

  async function handleSettle() {
    if (!settleTxnId) return
    const body: { transaction_id: string; amount?: string } = { transaction_id: settleTxnId }
    if (settleAmount && settleAmount !== selectedTxn?.amount) body.amount = settleAmount
    await settle.mutateAsync({ shareId: share.id, body })
    setSettleOpen(false)
    setSettleTxnId('')
    setSettleAmount('')
  }

  async function handleForgive() {
    await forgive.mutateAsync({ shareId: share.id, amount: forgiveAmount })
    setForgiveOpen(false)
    setForgiveAmount('')
  }

  // When a txn is selected in settle form, update the amount to min(txn.amount, remaining)
  function onTxnSelect(txnId: string) {
    setSettleTxnId(txnId)
    const t = incomeTransactions.find(i => i.id === txnId)
    if (t) {
      const capped = Math.min(parseFloat(t.amount), remaining)
      setSettleAmount(capped.toFixed(2))
    }
  }

  return (
    <div className="border-b border-border last:border-0 py-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {payeeName
            ? <p className="text-sm font-medium text-fg">{payeeName}</p>
            : <p className="text-sm text-fg-muted">My share</p>
          }
          <p className="text-xs text-fg-faint kk-mono mt-0.5">₹{fmt(share.amount)}</p>
        </div>
        <span className={`${STATUS_CLS[share.status]} shrink-0`}>{share.status}</span>
      </div>

      {/* Progress breakdown */}
      {hasActivity && (
        <div className="flex gap-3 text-xs flex-wrap">
          {paid > 0 && (
            <span className="text-positive-dim">Paid ₹{fmt(paid)}</span>
          )}
          {forgiven > 0 && (
            <span className="text-fg-muted">Forgiven ₹{fmt(forgiven)}</span>
          )}
          {!isResolved && remaining > 0 && (
            <span className="text-warning-dim">Remaining ₹{fmt(remaining)}</span>
          )}
        </div>
      )}

      {/* Settlement rows */}
      {share.settlements.length > 0 && (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-1">
          {share.settlements.map(s => (
            <SettlementRow
              key={s.id}
              s={s}
              txnMap={txnMap}
              splitId={splitId}
              shareId={share.id}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!isResolved && (
          <>
            <button
              onClick={openSettle}
              className="text-xs text-positive-dim hover:underline"
            >
              + Add payment
            </button>
            <button
              onClick={openForgive}
              className="text-xs text-fg-muted hover:underline"
            >
              {forgiven > 0 ? 'Update forgiven' : 'Forgive'}
            </button>
          </>
        )}
        {hasActivity && (
          <button
            onClick={() => setUnsettleOpen(true)}
            className="text-xs text-warning-dim hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Add payment inline form */}
      {settleOpen && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
          <p className="text-xs font-medium text-fg-muted">Link income transaction</p>
          <select
            value={settleTxnId}
            onChange={e => onTxnSelect(e.target.value)}
            className="kk-input text-sm"
          >
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
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={settleAmount}
                onChange={e => setSettleAmount(e.target.value)}
                className="kk-input text-sm"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setSettleOpen(false); setSettleTxnId(''); setSettleAmount('') }}
              className="kk-btn-ghost flex-1 justify-center"
            >Cancel</button>
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

      {/* Forgive inline form */}
      {forgiveOpen && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
          <p className="text-xs font-medium text-fg-muted">
            Forgive amount
            {forgiven > 0 && <span className="text-fg-faint ml-1">(currently ₹{fmt(forgiven)})</span>}
          </p>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              step="0.01"
              min="0"
              max={total - paid}
              value={forgiveAmount}
              onChange={e => setForgiveAmount(e.target.value)}
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
            <button
              onClick={() => { setForgiveOpen(false); setForgiveAmount('') }}
              className="kk-btn-ghost flex-1 justify-center"
            >Cancel</button>
            <button
              onClick={handleForgive}
              disabled={!forgiveAmount || forgive.isPending}
              className="flex-1 rounded-md border border-border bg-surface-3 py-1.5 text-xs font-medium text-fg-muted disabled:opacity-50"
            >
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
  const { data: split, isLoading } = useGetSplit(splitId)
  const { data: payeesRaw } = usePayees()
  const { data: txnData } = useTransactions({ type: 'income' })

  const payeeMap: Record<string, string> = {}
  for (const p of payeesRaw ?? []) payeeMap[p.id] = p.name

  const txnMap: Record<string, { description: string | null; amount: string }> = {}
  for (const t of txnData?.items ?? []) txnMap[t.id] = { description: t.description, amount: t.amount }
  const incomeTransactions = txnData?.items ?? []

  // Net expense = own shares + all forgiven amounts (FR-7.9)
  const netExpense = split?.shares.reduce((sum, s) => {
    const own     = s.payee_id === null ? parseFloat(s.amount) : 0
    const forgiven = parseFloat(s.forgiven_amount)
    return sum + own + forgiven
  }, 0) ?? 0

  const totalAmount = split?.shares.reduce((sum, s) => sum + parseFloat(s.amount), 0) ?? 0

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
                  payeeName={share.payee_id ? (payeeMap[share.payee_id] ?? share.payee_id.slice(0, 8)) : null}
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
              <p>Expense transaction: <span className="kk-mono">{split.expense_transaction_id.slice(0, 16)}…</span></p>
              <p>Created {new Date(split.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </DrawerSection>
        </div>
      ) : (
        <p className="p-5 text-sm text-negative-dim">Split not found.</p>
      )}
    </Drawer>
  )
}
