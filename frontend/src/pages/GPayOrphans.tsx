import { Link } from '@tanstack/react-router'
import { useGetOrphanGPayMatches, type GPayMatch } from '../api/gpay'

function OrphanRow({ match }: { match: GPayMatch }) {
  const data = match.gpay_data
  const merchant = (data.Description ?? data.merchant ?? data.Merchant ?? 'Unknown') as string
  const date = (data.Date ?? data.date ?? '') as string
  const amount = (data.Amount ?? data.amount ?? '') as string
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900">{merchant}</p>
          <p className="text-sm text-gray-500">{date} · ₹{amount}</p>
        </div>
        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
          orphan
        </span>
      </div>
    </li>
  )
}

export default function GPayOrphans() {
  const { data: orphans, isLoading } = useGetOrphanGPayMatches()

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">GPay Orphans</h1>
        <Link to="/gpay/import" className="text-sm text-indigo-600 hover:underline">
          ← Upload another
        </Link>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        These GPay records had no matching bank transaction within ±1 day and same amount.
        They may represent transactions not yet imported, or cash payments.
      </p>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {!isLoading && (!orphans || orphans.length === 0) && (
        <p className="text-gray-500 text-center py-12">No orphan records. Great job!</p>
      )}

      {orphans && orphans.length > 0 && (
        <ul className="space-y-3">
          {orphans.map((m) => (
            <OrphanRow key={m.id} match={m} />
          ))}
        </ul>
      )}
    </main>
  )
}
