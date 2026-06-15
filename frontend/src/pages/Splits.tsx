import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useListSplits, useDeleteSplit, type Split, type SplitShareStatus } from '../api/splits'
import ConfirmDialog from '../components/ConfirmDialog'
import { usePeriod } from '../lib/period-context'
import { EmptyState } from '../components/EmptyState'
import { SplitDrawer } from '../components/drawers/SplitDrawer'
import { CreateSplitDrawer } from '../components/drawers/CreateSplitDrawer'

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

function SplitCard({ split, onSelect, onDelete }: { split: Split; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  const pending  = split.shares.filter(s => s.status === 'pending')
  const settled  = split.shares.filter(s => s.status === 'settled')
  const forgiven = split.shares.filter(s => s.status === 'forgiven')
  const total    = split.shares.reduce((sum, s) => sum + parseFloat(s.amount), 0)

  // A split is "unsettled" if any share has remaining balance
  const overallStatus: SplitShareStatus =
    split.shares.some(s => parseFloat(s.amount) - parseFloat(s.paid_amount) - parseFloat(s.forgiven_amount) > 0.005)
      ? 'pending'
      : settled.length > 0 ? 'settled' : 'forgiven'

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

function SectionHeader({ title, viewAllTo, hasItems }: { title: string; viewAllTo: string; hasItems: boolean }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide">{title}</h2>
      {hasItems && (
        <Link to={viewAllTo as any} className="text-xs text-accent hover:underline">
          View all →
        </Link>
      )}
    </div>
  )
}

export default function Splits() {
  const { data, isLoading, isError } = useListSplits()
  const { dashboardParams, shortLabel } = usePeriod()
  const [selectedSplitId, setSelectedSplitId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const deleteSplit = useDeleteSplit()

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-3 max-w-3xl mx-auto">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-20 animate-pulse bg-surface-2 rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <div className="p-6 text-center text-negative-dim">Failed to load splits.</div>
  }

  const allSplits = data ?? []

  // Client-side period filter on split.created_at
  const start = dashboardParams.start_date ?? ''
  const end   = dashboardParams.end_date ?? ''
  const inPeriod = (s: Split) => {
    const d = s.created_at.slice(0, 10)
    return d >= start && d <= end
  }

  const periodSplits  = allSplits.filter(inPeriod)
  const unsettled = periodSplits.filter(s =>
    s.shares.some(sh => parseFloat(sh.amount) - parseFloat(sh.paid_amount) - parseFloat(sh.forgiven_amount) > 0.005),
  )

  return (
    <>
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">Splits</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" /> Create Split
        </button>
      </div>

      {/* Unsettled section */}
      <section>
        <SectionHeader title="Unsettled" viewAllTo="/splits/pending" hasItems={unsettled.length > 0} />
        {unsettled.length === 0 ? (
          <EmptyState
            title="No unsettled splits"
            description={`All splits in ${shortLabel} are settled.`}
          />
        ) : (
          <>
            <div className="space-y-3">
              {unsettled.slice(0, 5).map(s => <SplitCard key={s.id} split={s} onSelect={setSelectedSplitId} onDelete={setDeleteTarget} />)}
            </div>
            {unsettled.length > 5 && (
              <p className="mt-3 text-xs text-fg-faint text-center">
                +{unsettled.length - 5} more &mdash;{' '}
                <Link to="/splits/pending" className="text-accent hover:underline">view all</Link>
              </p>
            )}
          </>
        )}
      </section>

      {/* All splits section */}
      <section>
        <SectionHeader title={`All Splits — ${shortLabel}`} viewAllTo="/splits/history" hasItems={periodSplits.length > 0} />
        {periodSplits.length === 0 ? (
          <EmptyState
            title="No splits in this period"
            description="Splits are created from the transaction detail page."
          />
        ) : (
          <>
            <div className="space-y-3">
              {periodSplits.slice(0, 5).map(s => <SplitCard key={s.id} split={s} onSelect={setSelectedSplitId} onDelete={setDeleteTarget} />)}
            </div>
            {periodSplits.length > 5 && (
              <p className="mt-3 text-xs text-fg-faint text-center">
                +{periodSplits.length - 5} more &mdash;{' '}
                <Link to="/splits/history" className="text-accent hover:underline">view all</Link>
              </p>
            )}
          </>
        )}
      </section>
    </div>

    <SplitDrawer splitId={selectedSplitId} onClose={() => setSelectedSplitId(null)} />
    <CreateSplitDrawer
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      onCreated={id => setSelectedSplitId(id)}
    />

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
    </>
  )
}
