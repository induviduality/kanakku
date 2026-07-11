import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useListSplits, useDeleteSplit, type Split, type SplitShareStatus } from '../api/splits'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePeriod } from '../lib/period-context'
import { toIsoDate } from '../lib/period'
import { EmptyState } from '../components/EmptyState'
import { SplitDrawer } from '../components/drawers/SplitDrawer'

interface Props {
  mode: 'pending' | 'all'
}

function StatusBadge({ status }: { status: SplitShareStatus }) {
  const styles: Record<SplitShareStatus, string> = {
    pending:  'bg-warning/15 text-warning-dim',
    settled:  'bg-positive/10 text-positive-dim',
    forgiven: 'bg-surface-3 text-fg-muted',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
      {status}
    </span>
  )
}

function SplitRow({ split, onSelect, onDelete }: { split: Split; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  const payeeShares = split.shares.filter(s => s.payee_id !== null)
  const pending  = payeeShares.filter(s => s.status === 'pending')
  const settled  = payeeShares.filter(s => s.status === 'settled')
  const forgiven = payeeShares.filter(s => s.status === 'forgiven')
  const total    = split.shares.reduce((sum, s) => sum + parseFloat(s.amount), 0)

  const overallStatus: SplitShareStatus =
    pending.length > 0 ? 'pending' : settled.length > 0 ? 'settled' : 'forgiven'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(split.id)}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(split.id)}
      className="kk-card block hover:border-accent/40 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg truncate">
            {split.notes ?? 'Split expense'}
          </p>
          <p className="text-xs text-fg-faint mt-0.5">
            {split.shares.length} {split.shares.length === 1 ? 'share' : 'shares'} &middot;{' '}
            {new Date(split.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-fg kk-mono">
            ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
          <StatusBadge status={overallStatus} />
          <button
            onClick={e => { e.stopPropagation(); onDelete(split.id) }}
            className="p-1 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
            title="Delete split"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {split.shares.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pending.length  > 0 && <span className="text-xs text-fg-faint">{pending.length} pending</span>}
          {settled.length  > 0 && <span className="text-xs text-fg-faint">{settled.length > 0 && pending.length > 0 ? '· ' : ''}{settled.length} settled</span>}
          {forgiven.length > 0 && <span className="text-xs text-fg-faint">· {forgiven.length} forgiven</span>}
        </div>
      )}
    </div>
  )
}

export default function SplitsAll({ mode }: Props) {
  const { data, isLoading, isError } = useListSplits()
  const { dashboardParams, shortLabel } = usePeriod()
  const [selectedSplitId, setSelectedSplitId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const deleteSplit = useDeleteSplit()

  const title      = mode === 'pending' ? 'Unsettled Splits' : 'All Splits'
  const emptyTitle = mode === 'pending' ? 'No unsettled splits' : 'No splits in this period'
  const emptyDesc  = mode === 'pending'
    ? `All splits in ${shortLabel} are settled.`
    : 'Splits are created from the transaction detail page.'

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-3 max-w-3xl mx-auto">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 animate-pulse bg-surface-2 rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <div className="p-6 text-center text-negative-dim">Failed to load splits.</div>
  }

  const allSplits = data ?? []

  // created_at is a full UTC timestamp — convert to local before comparing
  // as a date, or a split near a day boundary is silently misplaced (see
  // docs/decisions/log.md 2026-07-11 (11)).
  const start = dashboardParams.start_date ?? ''
  const end   = dashboardParams.end_date ?? ''
  const inPeriod = (s: Split) => {
    const d = toIsoDate(new Date(s.created_at))
    return d >= start && d <= end
  }

  const periodSplits = allSplits.filter(inPeriod)
  const displayed    = mode === 'pending'
    ? periodSplits.filter(s => s.shares.some(sh => sh.payee_id !== null && sh.status === 'pending'))
    : periodSplits

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/splits" className="text-xs text-fg-muted hover:text-fg">← Splits</Link>
        <h1 className="text-base font-semibold text-fg">{title}</h1>
        <span className="text-xs text-fg-faint">{shortLabel}</span>
      </div>

      {displayed.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDesc} />
      ) : (
        <div className="space-y-3">
          {displayed.map(s => <SplitRow key={s.id} split={s} onSelect={setSelectedSplitId} onDelete={setDeleteTarget} />)}
        </div>
      )}

      {displayed.length > 0 && (
        <p className="mt-4 text-xs text-fg-faint text-center">
          {displayed.length} {displayed.length === 1 ? 'split' : 'splits'}
        </p>
      )}

      <SplitDrawer splitId={selectedSplitId} onClose={() => setSelectedSplitId(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete split"
        description="Remove this split? The linked transactions will not be deleted — only the split linkage is removed."
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => {
          if (!deleteTarget) return
          deleteSplit.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) })
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

export function SplitsPendingPage() {
  return <SplitsAll mode="pending" />
}

export function SplitsHistoryPage() {
  return <SplitsAll mode="all" />
}
