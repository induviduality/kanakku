import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import {
  useGetPiggyBank,
  useCreatePiggyBank,
  usePatchPiggyBank,
  type PiggyBankCreate,
} from '../api/piggy_banks'

export default function PiggyBankFormPage() {
  const { piggyId } = useParams({ strict: false }) as { piggyId?: string }
  const navigate = useNavigate()
  const isEdit = !!piggyId

  const { data: existing } = useGetPiggyBank(piggyId ?? null)
  const createMutation = useCreatePiggyBank()
  const patchMutation = usePatchPiggyBank()

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [targetDate, setTargetDate] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setTargetAmount(existing.target_amount)
      setCurrency(existing.currency)
      setTargetDate(existing.target_date ?? '')
      setNotes(existing.notes ?? '')
    }
  }, [existing])

  const isLoading = createMutation.isPending || patchMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: PiggyBankCreate = {
      name,
      target_amount: targetAmount,
      currency,
      target_date: targetDate || undefined,
      notes: notes || undefined,
    }
    if (isEdit && piggyId) {
      patchMutation.mutate(
        { id: piggyId, patch: data },
        { onSuccess: () => void navigate({ to: `/piggy-banks/${piggyId}` }) },
      )
    } else {
      createMutation.mutate(data, {
        onSuccess: (pig) => void navigate({ to: `/piggy-banks/${pig.id}` }),
      })
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-4">
        <Link to="/piggy-banks" className="text-sm text-indigo-600 hover:underline">
          ← Back to piggy banks
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Edit piggy bank' : 'New piggy bank'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="target-amount" className="block text-sm font-medium text-gray-700">
              Target amount
            </label>
            <input
              id="target-amount"
              type="number"
              step="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
              Currency
            </label>
            <input
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="target-date" className="block text-sm font-medium text-gray-700">
            Target date (optional)
          </label>
          <input
            id="target-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Link
            to="/piggy-banks"
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
