import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import {
  useGetSubscription,
  useCreateSubscription,
  usePatchSubscription,
  type BillingCycle,
  type SubscriptionCreate,
} from '../api/subscriptions'
import { useAccounts } from '../api/accounts'

export default function SubscriptionFormPage() {
  const { subId } = useParams({ strict: false }) as { subId?: string }
  const navigate = useNavigate()
  const isEdit = !!subId

  const { data: existing } = useGetSubscription(subId ?? null)
  const { data: accounts = [] } = useAccounts()
  const createMutation = useCreateSubscription()
  const patchMutation = usePatchSubscription()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [billingDay, setBillingDay] = useState('1')
  const [accountId, setAccountId] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setAmount(existing.amount)
      setCurrency(existing.currency)
      setBillingCycle(existing.billing_cycle)
      setBillingDay(String(existing.billing_day))
      setAccountId(existing.account_id)
      setUrl(existing.url ?? '')
      setNotes(existing.notes ?? '')
    }
  }, [existing])

  const isLoading = createMutation.isPending || patchMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: SubscriptionCreate = {
      name,
      amount,
      currency,
      billing_cycle: billingCycle,
      billing_day: parseInt(billingDay, 10),
      account_id: accountId,
      url: url || undefined,
      notes: notes || undefined,
    }
    if (isEdit && subId) {
      patchMutation.mutate(
        { id: subId, patch: data },
        { onSuccess: () => void navigate({ to: `/subscriptions/${subId}` }) },
      )
    } else {
      createMutation.mutate(data, {
        onSuccess: (sub) => void navigate({ to: `/subscriptions/${sub.id}` }),
      })
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="mb-4">
        <Link to="/subscriptions" className="text-sm text-indigo-600 hover:underline">
          ← Back to subscriptions
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Edit subscription' : 'New subscription'}
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
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="billing-cycle" className="block text-sm font-medium text-gray-700">
              Billing cycle
            </label>
            <select
              id="billing-cycle"
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="billing-day" className="block text-sm font-medium text-gray-700">
              Billing day
            </label>
            <input
              id="billing-day"
              type="number"
              min="0"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              required
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="account" className="block text-sm font-medium text-gray-700">
            Account
          </label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sub-url" className="block text-sm font-medium text-gray-700">
            URL (optional)
          </label>
          <input
            id="sub-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
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
            to="/subscriptions"
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
