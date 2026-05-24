import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useGetPendingGPayMatches, useResolveGPayMatch, type GPayMatch } from '../api/gpay'

function formatGPayData(data: Record<string, unknown>): string {
  const merchant = (data.Description ?? data.merchant ?? data.Merchant ?? '') as string
  const date = (data.Date ?? data.date ?? '') as string
  const amount = (data.Amount ?? data.amount ?? '') as string
  return `${merchant} — ${date} — ₹${amount}`
}

function MatchCard({ match }: { match: GPayMatch }) {
  const [chosen, setChosen] = useState<string>('')
  const [resolved, setResolved] = useState(false)
  const resolve = useResolveGPayMatch()

  if (resolved) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm text-green-800 font-medium">✓ Resolved</p>
      </div>
    )
  }

  const handleResolve = async () => {
    if (!chosen) return
    await resolve.mutateAsync({ matchId: match.id, chosenTransactionId: chosen })
    setResolved(true)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1">GPay record</p>
        <p className="text-sm font-medium text-gray-900">{formatGPayData(match.gpay_data)}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-2">
          Bank candidates ({match.candidate_transaction_ids.length})
        </p>
        <div className="space-y-2">
          {match.candidate_transaction_ids.map((txnId) => (
            <label key={txnId} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name={`match-${match.id}`}
                value={txnId}
                checked={chosen === txnId}
                onChange={() => setChosen(txnId)}
                aria-label={`candidate ${txnId}`}
              />
              <span className="text-sm font-mono text-gray-700 truncate">{txnId}</span>
            </label>
          ))}
        </div>
      </div>

      {match.llm_suggestion_id && (
        <p className="text-xs text-indigo-600">
          LLM suggestion: {match.llm_suggestion_id}
        </p>
      )}

      <button
        onClick={() => void handleResolve()}
        disabled={!chosen || resolve.isPending}
        className="rounded bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        aria-label={`Confirm resolution for match ${match.id}`}
      >
        {resolve.isPending ? 'Saving…' : 'Confirm'}
      </button>
    </div>
  )
}

export default function GPayResolve() {
  const { data: matches, isLoading } = useGetPendingGPayMatches()

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pending GPay Matches</h1>
        <Link to="/gpay/import" className="text-sm text-indigo-600 hover:underline">
          ← Upload another
        </Link>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {!isLoading && (!matches || matches.length === 0) && (
        <p className="text-gray-500 text-center py-12">No pending matches. All resolved!</p>
      )}

      {matches && matches.length > 0 && (
        <div className="space-y-4">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </main>
  )
}
