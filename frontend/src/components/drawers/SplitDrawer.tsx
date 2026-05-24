import { useState } from 'react'
import { Drawer, DrawerSection } from '../Drawer'
import {
  useGetSplit,
  useSettleShare,
  useForgiveShare,
  useUnsettleShare,
  type SplitShare,
  type SplitShareStatus,
} from '../../api/splits'
import { useTransactions } from '../../api/transactions'
import ConfirmDialog from '../ConfirmDialog'

const STATUS_CLS: Record<SplitShareStatus, string> = {
  pending:  'kk-chip kk-chip-warning',
  settled:  'kk-chip kk-chip-positive',
  forgiven: 'kk-chip kk-chip-neutral',
}

function ShareRow({ share, splitId }: { share: SplitShare; splitId: string }) {
  const [settleOpen, setSettleOpen] = useState(false)
  const [forgiveOpen, setForgiveOpen] = useState(false)
  const [settleTxnId, setSettleTxnId] = useState('')

  const { data: txnData } = useTransactions({ type: 'income' })
  const incomeTransactions = txnData?.items ?? []
  const settle   = useSettleShare(splitId)
  const forgive  = useForgiveShare(splitId)
  const unsettle = useUnsettleShare(splitId)

  async function handleSettle() {
    if (!settleTxnId) return
    await settle.mutateAsync({ shareId: share.id, body: { settlement_transaction_id: settleTxnId } })
    setSettleOpen(false)
    setSettleTxnId('')
  }

  return (
    <div className="border-b border-border last:border-0 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {share.payee_id
            ? <p className="text-sm font-medium text-fg">{share.payee_id.slice(0, 8)}…</p>
            : <p className="text-sm text-fg-muted">My share</p>
          }
          <p className="text-xs text-fg-faint kk-mono mt-0.5">
            ₹{parseFloat(share.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={STATUS_CLS[share.status]}>{share.status}</span>
          {share.status === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => setSettleOpen(v => !v)} className="text-xs text-positive-dim hover:underline">
                Settle
              </button>
              <button onClick={() => setForgiveOpen(true)} className="text-xs text-fg-muted hover:underline">
                Forgive
              </button>
            </div>
          )}
          {share.status === 'settled' && (
            <button
              onClick={() => unsettle.mutate(share.id)}
              disabled={unsettle.isPending}
              className="text-xs text-warning-dim hover:underline disabled:opacity-50"
            >
              Unsettle
            </button>
          )}
        </div>
      </div>

      {settleOpen && (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3 space-y-2">
          <p className="text-xs text-fg-muted">Link income transaction</p>
          <select
            value={settleTxnId}
            onChange={e => setSettleTxnId(e.target.value)}
            className="kk-input text-sm"
          >
            <option value="">Select…</option>
            {incomeTransactions.map(t => (
              <option key={t.id} value={t.id}>
                {t.description ?? t.id.slice(0, 8)} — ₹{t.amount}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => { setSettleOpen(false); setSettleTxnId('') }}
              className="kk-btn-ghost flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              onClick={handleSettle}
              disabled={!settleTxnId || settle.isPending}
              className="flex-1 rounded-md border border-positive/30 bg-positive/10 py-1.5 text-xs font-medium text-positive-dim disabled:opacity-50"
            >
              {settle.isPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={forgiveOpen}
        title="Forgive share"
        description={`Write off ₹${share.amount} — counts toward your net expense.`}
        onConfirm={() => { forgive.mutate(share.id); setForgiveOpen(false) }}
        onCancel={() => setForgiveOpen(false)}
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

  const totalAmount = split?.shares.reduce((sum, s) => sum + Number(s.amount), 0) ?? 0
  const netExpense  = split?.shares.reduce(
    (sum, s) => (s.payee_id === null || s.status === 'forgiven' ? sum + Number(s.amount) : sum),
    0,
  ) ?? 0

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
          {/* Summary */}
          <div className="kk-panel space-y-2">
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Total</span>
              <span className="text-sm font-semibold text-fg kk-mono">
                ₹{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <hr className="kk-divider" />
            <div className="flex justify-between">
              <span className="text-xs text-fg-muted">Your net expense</span>
              <span className="text-sm font-semibold text-negative-dim kk-mono">
                ₹{netExpense.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Shares */}
          <DrawerSection label="Shares">
            <div className="kk-panel">
              {split.shares.map(share => (
                <ShareRow key={share.id} share={share} splitId={split.id} />
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
              <p>Created {new Date(split.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p className="kk-mono truncate">ID: {split.id}</p>
            </div>
          </DrawerSection>
        </div>
      ) : (
        <p className="p-5 text-sm text-negative-dim">Split not found.</p>
      )}
    </Drawer>
  )
}
