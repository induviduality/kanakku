import { Link } from '@tanstack/react-router'
import { useGetImportBatches, type ImportBatch, type ImportBatchStatus } from '../api/imports'
import { EmptyState } from '../components/EmptyState'

const STATUS_STYLES: Record<ImportBatchStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

function BatchRow({ batch }: { batch: ImportBatch }) {
  const imported = new Date(batch.imported_at).toLocaleDateString('en-IN')
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{batch.filename}</span>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[batch.status]}`}
              aria-label={`status: ${batch.status}`}
            >
              {batch.status}
            </span>
            {batch.verification_status && (
              <span className="text-xs text-gray-500">({batch.verification_status})</span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {imported} · {batch.total_parsed} parsed · {batch.total_confirmed} confirmed ·{' '}
            {batch.total_rejected} rejected
          </p>
        </div>
        <Link
          to={`/imports/${batch.id}` as any}
          className="shrink-0 text-sm text-indigo-600 hover:underline"
        >
          Review
        </Link>
      </div>
    </li>
  )
}

export default function Imports() {
  const { data: batches, isLoading } = useGetImportBatches()

  if (isLoading) return <p className="p-8 text-gray-500">Loading imports…</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Imports</h1>
        <Link
          to="/imports/upload"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Upload PDF
        </Link>
      </div>

      {!batches || batches.length === 0 ? (
        <EmptyState title="No imports yet" description="Upload a PDF bank statement to get started." />
      ) : (
        <ul className="space-y-3">
          {batches.map((batch) => (
            <BatchRow key={batch.id} batch={batch} />
          ))}
        </ul>
      )}
    </div>
  )
}
