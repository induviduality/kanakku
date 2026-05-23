import { useEffect, useState } from 'react'
import type { TransactionCreate, TransactionPatch, TransactionType } from '../../api/transactions'
import { useAccounts, usePaymentMethods } from '../../api/accounts'
import { useCategories } from '../../api/categories'
import { useTags } from '../../api/tags'
import { usePayees, useCreatePayee } from '../../api/payees'
import Autocomplete from '../Autocomplete'

interface TransactionFormProps {
  initial?: Partial<TransactionCreate>
  onSubmit: (data: TransactionCreate | TransactionPatch) => Promise<void>
  submitLabel?: string
  isSubmitting?: boolean
}

const TYPE_OPTIONS: TransactionType[] = ['expense', 'income', 'transfer']

export default function TransactionForm({
  initial,
  onSubmit,
  submitLabel = 'Save',
  isSubmitting = false,
}: TransactionFormProps) {
  const { data: accounts = [] } = useAccounts()
  const { data: allCategories = [] } = useCategories()
  const { data: allTags = [] } = useTags()
  const { data: payees = [] } = usePayees()
  const createPayeeMutation = useCreatePayee()

  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense')
  const [transactedAt, setTransactedAt] = useState(
    initial?.transacted_at
      ? initial.transacted_at.slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  )
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [currency, setCurrency] = useState(initial?.currency ?? '')
  const [accountId, setAccountId] = useState(initial?.account_id ?? '')
  const [toAccountId, setToAccountId] = useState(initial?.to_account_id ?? '')
  const [paymentMethodId, setPaymentMethodId] = useState(initial?.payment_method_id ?? null)
  const [payeeId, setPayeeId] = useState<string | null>(initial?.payee_id ?? null)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initial?.category_ids ?? [],
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tag_ids ?? [])
  const [error, setError] = useState('')

  const { data: paymentMethods = [] } = usePaymentMethods(accountId)

  // When payee changes, auto-populate categories from payee defaults
  useEffect(() => {
    if (!payeeId) return
    const payee = payees.find((p) => p.id === payeeId)
    if (payee?.default_category_ids?.length) {
      setSelectedCategories(payee.default_category_ids)
    }
  }, [payeeId, payees])

  // When account changes, clear payment method (may not belong to new account)
  useEffect(() => {
    setPaymentMethodId(null)
  }, [accountId])

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  function toggleTag(id: string) {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!accountId) { setError('Account is required'); return }
    if (!amount || Number(amount) <= 0) { setError('Amount must be greater than 0'); return }
    if (type === 'transfer' && !toAccountId) { setError('Destination account is required for transfers'); return }

    const payload: TransactionCreate = {
      type,
      transacted_at: new Date(transactedAt).toISOString(),
      amount,
      account_id: accountId,
      ...(currency && { currency }),
      ...(description && { description }),
      ...(notes && { notes }),
      ...(paymentMethodId && { payment_method_id: paymentMethodId }),
      ...(payeeId && { payee_id: payeeId }),
      ...(type === 'transfer' && toAccountId && { to_account_id: toAccountId }),
      category_ids: selectedCategories,
      tag_ids: selectedTags,
    }

    try {
      await onSubmit(payload)
    } catch {
      setError('Failed to save transaction. Please try again.')
    }
  }

  const accountOptions = accounts.map((a) => ({ id: a.id, label: `${a.name} (${a.currency})` }))
  const payeeOptions = payees.map((p) => ({ id: p.id, label: p.name }))
  const pmOptions = paymentMethods
    .filter((pm) => !pm.deleted_at)
    .map((pm) => ({ id: pm.id, label: pm.name }))

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
        <div className="flex rounded-md border border-gray-300 overflow-hidden" role="group" aria-label="Transaction type">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors
                ${type === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              aria-pressed={type === t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Date/time */}
      <div>
        <label htmlFor="txn-date" className="block text-sm font-medium text-gray-700">Date & Time</label>
        <input
          id="txn-date"
          type="datetime-local"
          value={transactedAt}
          onChange={(e) => setTransactedAt(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="txn-amount" className="block text-sm font-medium text-gray-700">Amount</label>
        <div className="mt-1 flex gap-2">
          <input
            id="txn-amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            id="txn-currency"
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="INR"
            maxLength={10}
            className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Currency"
          />
        </div>
      </div>

      {/* Source account */}
      <div>
        <label htmlFor="txn-account" className="block text-sm font-medium text-gray-700">
          {type === 'transfer' ? 'From Account' : 'Account'}
        </label>
        <select
          id="txn-account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select account…</option>
          {accounts.filter((a) => !a.deleted_at && a.is_active).map((a) => (
            <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
          ))}
        </select>
      </div>

      {/* To account (transfers only) */}
      {type === 'transfer' && (
        <div>
          <label htmlFor="txn-to-account" className="block text-sm font-medium text-gray-700">To Account</label>
          <select
            id="txn-to-account"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select destination…</option>
            {accounts.filter((a) => !a.deleted_at && a.is_active && a.id !== accountId).map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
        </div>
      )}

      {/* Payment method */}
      {type !== 'transfer' && accountId && pmOptions.length > 0 && (
        <div>
          <label htmlFor="txn-pm" className="block text-sm font-medium text-gray-700">Payment Method</label>
          <Autocomplete
            id="txn-pm"
            options={pmOptions}
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            placeholder="Select payment method…"
          />
        </div>
      )}

      {/* Payee (not for transfers) */}
      {type !== 'transfer' && (
        <div>
          <label htmlFor="txn-payee" className="block text-sm font-medium text-gray-700">Payee</label>
          <Autocomplete
            id="txn-payee"
            options={payeeOptions}
            value={payeeId}
            onChange={setPayeeId}
            placeholder="Search or create payee…"
            onInlineCreate={async (name) => {
              const p = await createPayeeMutation.mutateAsync({ name, type: 'merchant' })
              return { id: p.id, label: p.name }
            }}
          />
        </div>
      )}

      {/* Categories (not for transfers) */}
      {type !== 'transfer' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Categories</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {allCategories.filter((c) => !c.deleted_at).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                  ${selectedCategories.includes(c.id)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Tags</label>
        <div className="mt-1 flex flex-wrap gap-1">
          {allTags.filter((t) => !t.deleted_at).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTag(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                ${selectedTags.includes(t.id)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="txn-desc" className="block text-sm font-medium text-gray-700">Description</label>
        <input
          id="txn-desc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this for?"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="txn-notes" className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          id="txn-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
