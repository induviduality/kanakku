import { Link } from '@tanstack/react-router'
import { useGetImportBatches, type ImportBatch, type ImportBatchStatus } from '../api/imports'
import { EmptyState } from '../components/EmptyState'

const STATUS_CLS: Record<ImportBatchStatus, string> = {
  pending:    'bg-warning/15 text-warning-dim',
  processing: 'bg-accent/15 text-accent',
  completed:  'bg-positive/10 text-positive-dim',
  failed:     'bg-negative/10 text-negative-dim',
}

const STATUS_ICON: Record<ImportBatchStatus, string> = {
  pending:    '⏳',
  processing: '⚙',
  completed:  '✓',
  failed:     '✕',
}

function BatchCard({ batch }: { batch: ImportBatch }) {
  const imported = new Date(batch.imported_at).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
  const pct = batch.total_parsed > 0
    ? Math.round((batch.total_confirmed / batch.total_parsed) * 100)
    : 0

  return (
    <div className="kk-card">
      <div className="flex items-start gap-3 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-fg truncate">{batch.filename}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CLS[batch.status]}`}>
              {STATUS_ICON[batch.status]} {batch.status}
            </span>
            {batch.verification_status && (
              <span className="text-[10px] text-fg-faint border border-border/50 px-1.5 py-0.5 rounded-full">
                {batch.verification_status}
              </span>
            )}
          </div>
          <p className="text-xs text-fg-faint">{imported}</p>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link
          to={`/imports/${batch.id}` as any}
          className="kk-btn-ghost shrink-0"
          onClick={e => e.stopPropagation()}
        >
          Review
        </Link>
      </div>

      {/* Progress bar */}
      {batch.total_parsed > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-fg-faint mb-1">
            <span>{batch.total_confirmed} confirmed · {batch.total_rejected} rejected · {batch.total_parsed - batch.total_confirmed - batch.total_rejected} pending</span>
            <span className="kk-mono">{pct}%</span>
          </div>
          <div className="kk-bar">
            <div className="kk-bar-fill kk-bar-fill--positive" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Imports() {
  const { data: batches, isLoading } = useGetImportBatches()

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse bg-surface-2 rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-fg">Bulk Import</h1>
          <p className="text-xs text-fg-faint mt-0.5">Upload PDF bank statements — parsed automatically</p>
        </div>
        <Link to="/imports/upload" className="kk-btn-primary">
          Upload PDF
        </Link>
      </div>

      {!batches || batches.length === 0 ? (
        <EmptyState
          title="No imports yet"
          description="Upload a PDF bank statement to parse transactions automatically."
        />
      ) : (
        <ul className="space-y-3">
          {batches.map((batch) => (
            <li key={batch.id}>
              <BatchCard batch={batch} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
