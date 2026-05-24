import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useGetPiggyBanks,
  useCreatePiggyBank,
  useDeletePiggyBank,
  type PiggyBank,
  type PiggyBankCreate,
} from '../api/piggy_banks'
import ConfirmDialog from '../components/ConfirmDialog'

function ProgressRing({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, pct))
  const offset = circ * (1 - clamped / 100)
  const color = clamped >= 100 ? 'var(--kk-positive)' : 'var(--kk-accent)'
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      role="img"
      aria-label={`${clamped.toFixed(0)}% progress`}
    >
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--kk-border-strong)" strokeWidth="8" />
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
      <text x="44" y="49" textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--kk-fg)" fontFamily="var(--kk-font-mono)">
        {clamped.toFixed(0)}%
      </text>
    </svg>
  )
}

function PiggyBankForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: PiggyBankCreate) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [targetDate, setTargetDate] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      name,
      target_amount: targetAmount,
      currency,
      target_date: targetDate || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pig-name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          id="pig-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pig-target" className="block text-sm font-medium text-gray-700">
            Target amount
          </label>
          <input
            id="pig-target"
            type="number"
            step="0.01"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="pig-currency" className="block text-sm font-medium text-gray-700">
            Currency
          </label>
          <input
            id="pig-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor="pig-date" className="block text-sm font-medium text-gray-700">
          Target date (optional)
        </label>
        <input
          id="pig-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  )
}

export default function PiggyBanks() {
  const { data: piggyBanks, isLoading } = useGetPiggyBanks()
  const createMutation = useCreatePiggyBank()
  const deleteMutation = useDeletePiggyBank()
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PiggyBank | null>(null)

  if (isLoading) return <p className="p-8 text-gray-500">Loading piggy banks…</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Piggy Banks</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Add piggy bank
        </button>
      </div>

      {showForm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">New piggy bank</h2>
            <PiggyBankForm
              onSubmit={(data) => {
                createMutation.mutate(data, { onSuccess: () => setShowForm(false) })
              }}
              onCancel={() => setShowForm(false)}
              isLoading={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {(!piggyBanks || piggyBanks.length === 0) ? (
        <p className="text-gray-500 text-center py-12">No piggy banks yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {piggyBanks.map((pig) => (
            <li key={pig.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <ProgressRing pct={pig.progress_pct} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/piggy-banks/${pig.id}` as any}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {pig.name}
                  </Link>
                  {pig.is_completed && (
                    <span className="ml-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      Completed!
                    </span>
                  )}
                  <p className="mt-1 text-sm text-gray-600">
                    {pig.currency} {pig.current_amount} / {pig.target_amount}
                  </p>
                  {pig.target_date && (
                    <p className="text-xs text-gray-400">Target: {pig.target_date}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Link
                  to={`/piggy-banks/${pig.id}/edit` as any}
                  className="text-sm text-gray-500 hover:text-gray-800"
                >
                  Edit
                </Link>
                <button
                  onClick={() => setDeleteTarget(pig)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete piggy bank"
          description={`Delete "${deleteTarget.name}"? This can be undone within 30 days.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={() => {
            deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
