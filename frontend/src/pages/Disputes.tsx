import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { usePotentialDuplicates, type PotentialDuplicateGroup, type DuplicateTxnSummary } from '../api/disputes'
import { useDeleteTransaction } from '../api/transactions'
import { usePeriod } from '../lib/period-context'
import { useToast } from '../lib/toast'

const TYPE_CHIP: Record<string, string> = {
  income:          'kk-chip-positive',
  expense:         'kk-chip-negative',
  transfer:        'kk-chip-accent',
  opening_balance: 'kk-chip-neutral',
}

// ── Resolve Modal ──────────────────────────────────────────────────────────────

function DisputeResolveModal({
  group,
  onClose,
  onKeptOne,
}: {
  group: PotentialDuplicateGroup
  onClose: () => void
  onKeptOne: () => void
}) {
  const deleteTxn = useDeleteTransaction()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleKeep(keepId: string) {
    setBusy(true)
    const toDelete = group.transactions.filter((t) => t.id !== keepId)
    try {
      for (const txn of toDelete) {
        await deleteTxn.mutateAsync(txn.id)
      }
      toast('Duplicate moved to bin.')
      onKeptOne()
    } catch {
      toast('Failed to delete transaction. Please try again.', 'error')
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg border border-border/50">
        <div className="px-5 py-4 border-b border-border/50">
          <h2 className="font-semibold text-fg text-base">Resolve potential duplicate</h2>
          <p className="text-xs text-fg-faint mt-0.5">
            Click the transaction you want to keep. The others will be soft-deleted.
          </p>
        </div>

        <div className="px-5 py-4 space-y-2">
          {group.transactions.map((txn) => (
            <TxnKeepCard key={txn.id} txn={txn} busy={busy} onKeep={() => handleKeep(txn.id)} />
          ))}
        </div>

        <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={busy}
            className="text-xs text-fg-faint hover:text-fg transition-colors disabled:opacity-50"
          >
            Keep both (not a duplicate)
          </button>
          <button onClick={onClose} disabled={busy} className="kk-btn-ghost text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function TxnKeepCard({ txn, busy, onKeep }: { txn: DuplicateTxnSummary; busy: boolean; onKeep: () => void }) {
  return (
    <button
      onClick={onKeep}
      disabled={busy}
      className="w-full text-left rounded-lg border border-border/50 px-4 py-3 text-sm hover:bg-surface-2 hover:border-accent/40 transition-colors disabled:opacity-50 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg truncate">{txn.description || '—'}</p>
          <p className="text-xs text-fg-muted mt-0.5">
            {txn.account_name ?? '—'}
            {txn.payee_name && <> · {txn.payee_name}</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-fg-faint kk-mono">
            {new Date(txn.transacted_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </p>
          <span className={`kk-chip ${TYPE_CHIP[txn.type] ?? 'kk-chip-neutral'} mt-1`}>
            {txn.type}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-accent mt-2 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
        Keep this one →
      </p>
    </button>
  )
}

// ── Group Card ─────────────────────────────────────────────────────────────────

function GroupCard({ group, onResolve }: { group: PotentialDuplicateGroup; onResolve: () => void }) {
  return (
    <div className="kk-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-fg-faint kk-mono mb-0.5">{group.date}</p>
          <p className="text-xl font-semibold text-fg kk-mono">
            ₹{Number(group.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={onResolve}
          className="text-xs font-medium text-warning-dim border border-warning/30 bg-warning/5 hover:bg-warning/10 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
        >
          Resolve
        </button>
      </div>
      <div className="space-y-1.5">
        {group.transactions.map((txn) => (
          <div key={txn.id} className="rounded-lg border border-border/50 bg-surface-2 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-fg truncate">{txn.description || '—'}</p>
              <span className={`kk-chip ${TYPE_CHIP[txn.type] ?? 'kk-chip-neutral'} shrink-0`}>
                {txn.type}
              </span>
            </div>
            <p className="text-fg-muted mt-0.5">
              {txn.account_name ?? '—'}
              {txn.payee_name && <> · {txn.payee_name}</>}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Disputes() {
  const { dashboardParams, label, rangeStart, rangeEnd } = usePeriod()
  const from = dashboardParams.start_date ? rangeStart : undefined
  const to   = dashboardParams.end_date   ? rangeEnd   : undefined

  const { data, isLoading } = usePotentialDuplicates(from, to)
  const qc = useQueryClient()

  const [resolveGroup, setResolveGroup] = useState<PotentialDuplicateGroup | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  function groupKey(g: PotentialDuplicateGroup) {
    return `${g.date}_${g.amount}`
  }

  function handleKeptOne() {
    if (resolveGroup) setDismissed((prev) => new Set([...prev, groupKey(resolveGroup)]))
    qc.invalidateQueries({ queryKey: ['potential-duplicates'] })
    setResolveGroup(null)
  }

  const visibleGroups = (data?.groups ?? []).filter((g) => !dismissed.has(groupKey(g)))

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg">Dispute Resolution</h1>
        <p className="text-sm text-fg-muted mt-1">
          Transactions with the same date and amount within{' '}
          <span className="font-medium text-fg">{label}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse bg-surface-2 rounded-xl" />
          ))}
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-surface-2 flex items-center justify-center">
            <svg className="w-6 h-6 text-positive-dim" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-fg">No potential duplicates found</p>
          <p className="text-xs text-fg-faint mt-1">All transactions in this period appear to be unique.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-fg-muted mb-4">
            <span className="font-semibold text-warning-dim">{visibleGroups.length}</span>{' '}
            group{visibleGroups.length !== 1 ? 's' : ''} flagged
          </p>
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <GroupCard
                key={groupKey(group)}
                group={group}
                onResolve={() => setResolveGroup(group)}
              />
            ))}
          </div>
        </>
      )}

      {resolveGroup && (
        <DisputeResolveModal
          group={resolveGroup}
          onClose={() => setResolveGroup(null)}
          onKeptOne={handleKeptOne}
        />
      )}
    </main>
  )
}
