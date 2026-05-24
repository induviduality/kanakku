import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  useGetSubscriptions,
  useCreateSubscription,
  useDeleteSubscription,
  type Subscription,
  type SubscriptionCreate,
  type SubscriptionStatus,
} from '../api/subscriptions'
import { useAccounts } from '../api/accounts'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  upcoming: 'bg-green-100 text-green-800',
  due_soon: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
}

function StatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return null
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
      aria-label={`status: ${status}`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function SubscriptionForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: SubscriptionCreate) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const { data: accounts = [] } = useAccounts()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [billingCycle, setBillingCycle] = useState<SubscriptionCreate['billing_cycle']>('monthly')
  const [billingDay, setBillingDay] = useState('1')
  const [accountId, setAccountId] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!accountId) return
    onSubmit({
      name,
      amount,
      currency,
      billing_cycle: billingCycle,
      billing_day: parseInt(billingDay, 10),
      account_id: accountId,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="sub-name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          id="sub-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="sub-amount" className="block text-sm font-medium text-gray-700">
            Amount
          </label>
          <input
            id="sub-amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="sub-currency" className="block text-sm font-medium text-gray-700">
            Currency
          </label>
          <input
            id="sub-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            required
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="sub-cycle" className="block text-sm font-medium text-gray-700">
            Billing cycle
          </label>
          <select
            id="sub-cycle"
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as SubscriptionCreate['billing_cycle'])}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sub-day" className="block text-sm font-medium text-gray-700">
            Billing day
          </label>
          <input
            id="sub-day"
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
        <label htmlFor="sub-account" className="block text-sm font-medium text-gray-700">
          Account
        </label>
        <select
          id="sub-account"
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

export default function Subscriptions() {
  const { data: subscriptions, isLoading } = useGetSubscriptions()
  const createMutation = useCreateSubscription()
  const deleteMutation = useDeleteSubscription()
  const [showForm, setShowForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null)

  if (isLoading) return <p className="p-8 text-gray-500">Loading subscriptions…</p>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          Add subscription
        </button>
      </div>

      {showForm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">New subscription</h2>
            <SubscriptionForm
              onSubmit={(data) => {
                createMutation.mutate(data, { onSuccess: () => setShowForm(false) })
              }}
              onCancel={() => setShowForm(false)}
              isLoading={createMutation.isPending}
            />
          </div>
        </div>
      )}

      {(!subscriptions || subscriptions.length === 0) ? (
        <p className="text-gray-500 text-center py-12">No subscriptions yet.</p>
      ) : (
        <ul className="space-y-3">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/subscriptions/${sub.id}` as any} className="font-medium text-indigo-700 hover:underline">
                      {sub.name}
                    </Link>
                    <StatusBadge status={sub.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {sub.currency} {sub.amount} · {sub.billing_cycle}
                    {sub.next_billing_date ? ` · next: ${sub.next_billing_date}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    to={`/subscriptions/${sub.id}/edit` as any}
                    className="text-sm text-gray-500 hover:text-gray-800"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(sub)}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete subscription"
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
