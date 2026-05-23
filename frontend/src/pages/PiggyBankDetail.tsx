import { useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import {
  useGetPiggyBank,
  useGetContributions,
  useAddContribution,
  useRemoveContribution,
  type ContributionType,
  type ContributionCreate,
} from '../api/piggy_banks'
import ConfirmDialog from '../components/ConfirmDialog'

function ProgressRing({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, pct))
  const offset = circ * (1 - clamped / 100)
  const color = clamped >= 100 ? '#10b981' : clamped >= 50 ? '#3b82f6' : '#6366f1'
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      role="img"
      aria-label={`${clamped.toFixed(0)}% progress`}
    >
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="49" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#374151">
        {clamped.toFixed(0)}%
      </text>
    </svg>
  )
}

function AddContributionForm({
  piggyId,
  onDone,
}: {
  piggyId: string
  onDone: () => void
}) {
  const addMutation = useAddContribution()
  const [txnId, setTxnId] = useState('')
  const [type, setType] = useState<ContributionType>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body: ContributionCreate = {
      transaction_id: txnId,
      contribution_type: type,
      amount,
      date,
    }
    addMutation.mutate({ piggyId, body }, { onSuccess: () => { onDone(); setTxnId('') } })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border rounded p-4 bg-gray-50">
      <h3 className="font-medium text-gray-800">Add contribution</h3>
      <div>
        <label htmlFor="txn-id" className="block text-xs text-gray-600">Transaction ID</label>
        <input
          id="txn-id"
          value={txnId}
          onChange={(e) => setTxnId(e.target.value)}
          required
          placeholder="UUID of the transaction"
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="contrib-type" className="block text-xs text-gray-600">Type</label>
          <select
            id="contrib-type"
            value={type}
            onChange={(e) => setType(e.target.value as ContributionType)}
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="expense">expense</option>
            <option value="transfer">transfer</option>
          </select>
        </div>
        <div>
          <label htmlFor="contrib-amount" className="block text-xs text-gray-600">Amount</label>
          <input
            id="contrib-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="contrib-date" className="block text-xs text-gray-600">Date</label>
          <input
            id="contrib-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={addMutation.isPending}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  )
}

export default function PiggyBankDetail() {
  const { piggyId } = useParams({ strict: false }) as { piggyId: string }
  const { data: pig, isLoading: pigLoading } = useGetPiggyBank(piggyId)
  const { data: contributions = [], isLoading: contribLoading } = useGetContributions(piggyId)
  const removeMutation = useRemoveContribution()
  const [showForm, setShowForm] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  if (pigLoading) return <p className="p-8 text-gray-500">Loading piggy bank…</p>
  if (!pig) return <p className="p-8 text-red-500">Piggy bank not found.</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link to="/piggy-banks" className="text-sm text-indigo-600 hover:underline">
          ← Back to piggy banks
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center gap-6">
          <ProgressRing pct={pig.progress_pct} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{pig.name}</h1>
            {pig.is_completed && (
              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                Goal reached!
              </span>
            )}
            <p className="mt-1 text-gray-600">
              {pig.currency} {pig.current_amount} / {pig.target_amount}
            </p>
            {pig.target_date && (
              <p className="text-sm text-gray-400">Target date: {pig.target_date}</p>
            )}
          </div>
        </div>
        {pig.notes && <p className="mt-3 text-sm text-gray-500">{pig.notes}</p>}
        <div className="mt-4 flex gap-2">
          <Link
            to={`/piggy-banks/${pig.id}/edit`}
            className="rounded bg-indigo-50 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-100"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Contributions</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
          >
            Add contribution
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-4">
          <AddContributionForm piggyId={pig.id} onDone={() => setShowForm(false)} />
        </div>
      )}

      {contribLoading ? (
        <p className="text-gray-500">Loading contributions…</p>
      ) : contributions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No contributions yet.</p>
      ) : (
        <ul className="space-y-2">
          {contributions.map((c) => (
            <li key={c.id} className="rounded border border-gray-200 bg-white p-3 text-sm flex items-center justify-between">
              <div>
                <span className="font-medium">{c.amount}</span>
                <span className="ml-2 text-xs text-gray-500 capitalize">{c.contribution_type}</span>
                <span className="ml-2 text-xs text-gray-400">{c.date}</span>
              </div>
              <button
                onClick={() => setRemoveTarget(c.id)}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {removeTarget && (
        <ConfirmDialog
          open
          title="Remove contribution"
          description="Remove this contribution? The amount will be deducted from the total."
          confirmLabel="Remove"
          isDestructive
          onConfirm={() => {
            removeMutation.mutate(
              { piggyId: pig.id, contribId: removeTarget },
              { onSuccess: () => setRemoveTarget(null) },
            )
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}
