import { useParams, Link } from '@tanstack/react-router'
import { useGetSubscription, useGetSubscriptionHistory, type SubscriptionStatus } from '../api/subscriptions'

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  upcoming: 'bg-green-100 text-green-800',
  due_soon: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
}

export default function SubscriptionDetail() {
  const { subId } = useParams({ strict: false }) as { subId: string }
  const { data: sub, isLoading: subLoading } = useGetSubscription(subId)
  const { data: history = [], isLoading: histLoading } = useGetSubscriptionHistory(subId)

  if (subLoading) return <p className="p-8 text-gray-500">Loading subscription…</p>
  if (!sub) return <p className="p-8 text-red-500">Subscription not found.</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link to="/subscriptions" className="text-sm text-indigo-600 hover:underline">
          ← Back to subscriptions
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{sub.name}</h1>
            <p className="mt-1 text-gray-600">
              {sub.currency} {sub.amount} · {sub.billing_cycle} (day {sub.billing_day})
            </p>
            {sub.next_billing_date && (
              <p className="mt-1 text-sm text-gray-500">Next billing: {sub.next_billing_date}</p>
            )}
          </div>
          {sub.status && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[sub.status]}`}
              aria-label={`status: ${sub.status}`}
            >
              {sub.status.replace('_', ' ')}
            </span>
          )}
        </div>
        {sub.url && (
          <a
            href={sub.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm text-indigo-600 hover:underline"
          >
            {sub.url}
          </a>
        )}
        {sub.notes && <p className="mt-2 text-sm text-gray-500">{sub.notes}</p>}

        <div className="mt-4 flex gap-2">
          <Link
            to={`/subscriptions/${sub.id}/edit` as any}
            className="rounded bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100"
          >
            Edit
          </Link>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Transaction history</h2>
      {histLoading ? (
        <p className="text-gray-500">Loading history…</p>
      ) : history.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transactions linked to this subscription.</p>
      ) : (
        <ul className="space-y-2">
          {(history as Array<Record<string, unknown>>).map((txn) => (
            <li key={String(txn.id)} className="rounded border border-gray-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-800">{String(txn.description ?? '—')}</span>
                <span className="font-medium">
                  {String(txn.currency)} {String(txn.amount)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(String(txn.transacted_at)).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
