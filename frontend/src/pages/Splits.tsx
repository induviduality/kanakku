import { Link } from '@tanstack/react-router'
import { useListSplits, type Split, type SplitShareStatus } from '../api/splits'

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

function SplitCard({ split }: { split: Split }) {
  const pending  = split.shares.filter(s => s.status === 'pending')
  const settled  = split.shares.filter(s => s.status === 'settled')
  const forgiven = split.shares.filter(s => s.status === 'forgiven')
  const total    = split.shares.reduce((sum, s) => sum + parseFloat(s.amount), 0)

  const overallStatus: SplitShareStatus =
    pending.length > 0 ? 'pending' : settled.length > 0 ? 'settled' : 'forgiven'

  return (
    <Link
      to={`/splits/${split.id}` as any}
      className="kk-card block hover:border-accent/40 transition-colors"
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
        </div>
      </div>

      {split.shares.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pending.length  > 0 && <span className="text-xs text-fg-faint">{pending.length} pending</span>}
          {settled.length  > 0 && <span className="text-xs text-fg-faint">{settled.length > 0 && pending.length > 0 ? '·' : ''} {settled.length} settled</span>}
          {forgiven.length > 0 && <span className="text-xs text-fg-faint">· {forgiven.length} forgiven</span>}
        </div>
      )}
    </Link>
  )
}

export default function Splits() {
  const { data, isLoading, isError } = useListSplits()

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

  const splits = data ?? []

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {splits.length === 0 ? (
        <div className="text-center py-16 text-fg-muted">
          <p className="text-sm">No splits yet.</p>
          <p className="text-xs mt-1 text-fg-faint">Splits are created from the transaction detail page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {splits.map(split => <SplitCard key={split.id} split={split} />)}
        </div>
      )}
    </div>
  )
}
