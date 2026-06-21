import { useEffect, useState, useMemo } from 'react'
import { ChevronRight, Trash2, Edit } from 'lucide-react'
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
import { SplitForm } from '../SplitForm'

const STATUS_CLS: Record<SplitShareStatus, string> = {
  pending:  'kk-chip kk-chip-warning',
  settled:  'kk-chip kk-chip-positive',
  forgiven: 'kk-chip kk-chip-neutral',
}

function fmt(amount: string | number) {
  return parseFloat(String(amount)).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
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
  const [settleError, setSettleError]   = useState('')

  // Forgive form state
  const [forgiveAmount, setForgiveAmount] = useState('')
  const [forgiveError, setForgiveError]   = useState('')

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
      setSettleError(''); setForgiveError('')
    }
  }, [isExpanded])

  // Sync edit form state on prop changes
  useEffect(() => {
    setEditPayeeId(share.payee_id ?? null)
    setEditAmount(share.amount)
  }, [share.payee_id, share.amount])

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
    setSettleError(''); setForgiveError('')
  }

  async function handleSettle() {
    if (!settleTxnId) return
    setSettleError('')
    const amt = parseFloat(settleAmount)
    if (isNaN(amt) || amt <= 0) {
      setSettleError('Settle amount must be positive')
      return
    }
    if (amt > remaining) {
      setSettleError(`Settle amount cannot exceed remaining amount (₹${fmt(remaining)})`)
      return
    }

    try {
      const body: { transaction_id: string; amount?: string } = { transaction_id: settleTxnId }
      if (settleAmount && settleAmount !== selectedTxn?.amount) body.amount = settleAmount
      await settle.mutateAsync({ shareId: share.id, body })
      setActiveAction(null); setSettleTxnId(''); setSettleAmount('')
    } catch {
      setSettleError('Failed to record settlement. Please try again.')
    }
  }

  async function handleForgive() {
    setForgiveError('')
    const amt = parseFloat(forgiveAmount)
    if (isNaN(amt) || amt < 0) {
      setForgiveError('Forgiven amount must be non-negative')
      return
    }
    if (amt > total - paid) {
      setForgiveError(`Forgiven amount cannot exceed remaining unpaid balance (₹${fmt(total - paid)})`)
      return
    }

    try {
      await forgive.mutateAsync({ shareId: share.id, amount: forgiveAmount })
      setActiveAction(null); setForgiveAmount('')
    } catch {
      setForgiveError('Failed to set forgiven amount. Please try again.')
    }
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

          {/* Action row — separated by · */}
          <div className="flex items-center flex-wrap gap-x-1 gap-y-1 text-xs text-fg-muted">
            {!isOwnShare && !isResolved && (
              <>
                <button
                  onClick={() => activateAction('settle')}
                  className="text-positive-dim hover:underline"
                >
                  Record payment
                </button>
                <span aria-hidden>·</span>
              </>
            )}
            {!isOwnShare && (
              <>
                <button
                  onClick={() => activateAction('forgive')}
                  className="hover:underline"
                >
                  Forgive
                </button>
                <span aria-hidden>·</span>
              </>
            )}
            <button onClick={() => activateAction('edit')} className="hover:underline">
              Edit
            </button>
            {hasActivity && (
              <>
                <span aria-hidden>·</span>
                <button onClick={() => setUnsettleOpen(true)} className="text-negative-dim hover:underline">
                  Reset
                </button>
              </>
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
                  <label htmlFor="settle-amount-input" className="text-xs text-fg-muted block mb-1">
                    Amount to credit <span className="text-fg-faint">(max ₹{fmt(remaining)})</span>
                  </label>
                  <input
                    id="settle-amount-input"
                    type="number" step="0.01" min="0.01" max={remaining}
                    value={settleAmount} onChange={e => setSettleAmount(e.target.value)}
                    aria-label="Amount to credit"
                    className="kk-input text-sm"
                  />
                </div>
              )}
              {settleError && <p className="text-xs text-negative-dim">{settleError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setActiveAction(null)} className="kk-btn-ghost flex-1 justify-center">Cancel</button>
                <button
                  onClick={handleSettle}
                  disabled={!settleTxnId || !settleAmount || parseFloat(settleAmount) <= 0 || parseFloat(settleAmount) > remaining || settle.isPending}
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
                  aria-label="Forgive amount"
                  className="kk-input text-sm flex-1"
                />
                <button
                  onClick={() => setForgiveAmount((total - paid).toFixed(2))}
                  className="text-xs text-accent hover:underline whitespace-nowrap"
                >
                  All remaining
                </button>
              </div>
              {forgiveError && <p className="text-xs text-negative-dim">{forgiveError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setActiveAction(null)} className="kk-btn-ghost flex-1 justify-center">Cancel</button>
                <button
                  onClick={handleForgive}
                  disabled={!forgiveAmount || parseFloat(forgiveAmount) < 0 || parseFloat(forgiveAmount) > (total - paid) || forgive.isPending}
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
  const [isEditing, setIsEditing]         = useState(false)

  const { data: split, isLoading } = useGetSplit(splitId)
  const { data: payeesRaw = [] }   = usePayees()
  const { data: txnData }          = useTransactions({ type: 'income' })
  const deleteSplit                = useDeleteSplit()
  const createPayeeMutation        = useCreatePayee()

  // Reset drawer state when splitId changes
  useEffect(() => {
    setDeleteOpen(false)
    setDetailsOpen(false)
    setExpandedShareId(null)
    setIsEditing(false)
  }, [splitId])

  const payeeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of payeesRaw) m[p.id] = p.name
    return m
  }, [payeesRaw])

  const payeeOptions = useMemo(() => 
    payeesRaw.map(p => ({ id: p.id, label: p.name }))
  , [payeesRaw])

  const txnMap = useMemo(() => {
    const m: Record<string, { description: string | null; amount: string }> = {}
    for (const t of txnData?.items ?? []) m[t.id] = { description: t.description, amount: t.amount }
    return m
  }, [txnData])

  const ownShare = split?.shares.find(s => s.payee_id === null)
  const payeeShares = split?.shares.filter(s => s.payee_id !== null) || []
  const netExpense = (
    parseFloat(ownShare?.amount ?? '0') +
    payeeShares.reduce((sum, s) => sum + parseFloat(s.forgiven_amount), 0)
  )

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
      title={isEditing ? 'Edit Split' : (split?.notes ?? 'Split expense')}
      headerAction={
        <div className="flex items-center gap-1">
          {split && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-accent"
              title="Edit split"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setDeleteOpen(true)}
            className="rounded p-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-negative-dim"
            title="Delete split"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : split ? (
        isEditing ? (
          <SplitForm
            initialSplit={split}
            onClose={() => setIsEditing(false)}
            onSuccess={() => setIsEditing(false)}
          />
        ) : (
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
        )
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
