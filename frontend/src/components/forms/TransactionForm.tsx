import { useEffect, useState } from 'react'
import type { Transaction, TransactionCreate, TransactionPatch, TransactionType } from '../../api/transactions'
import { useAccounts, usePaymentMethods } from '../../api/accounts'
import { useCategories } from '../../api/categories'
import { useTags } from '../../api/tags'
import { usePayees, useCreatePayee } from '../../api/payees'
import { useGetBudgets } from '../../api/budgets'
import { useCreateSplit } from '../../api/splits'
import type { SplitShareCreate } from '../../api/splits'
import Autocomplete from '../Autocomplete'
import SplitSharesEditor from '../SplitSharesEditor'

interface TransactionFormProps {
  initial?: Partial<Transaction>
  onSubmit: (data: TransactionCreate | TransactionPatch) => Promise<{ id: string } | void>
  submitLabel?: string
  isSubmitting?: boolean
}

const TYPE_OPTIONS: TransactionType[] = ['expense', 'income', 'transfer', 'opening_balance']

const LIABILITY_ACCOUNT_TYPES = new Set(['credit_card', 'loan'])

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
  const { data: allBudgets = [] } = useGetBudgets(false)
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
  const [externalRef, setExternalRef] = useState(initial?.external_ref ?? '')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initial?.category_ids ?? [],
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tag_ids ?? [])
  const [isSplit, setIsSplit] = useState(false)
  const [splitShares, setSplitShares] = useState<SplitShareCreate[]>([])
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(
    initial?.budget_ids?.[0] ?? null,
  )
  const [error, setError] = useState('')

  const createSplit = useCreateSplit()
  const { data: paymentMethods = [] } = usePaymentMethods(accountId)

  // Sync state with initial data when it becomes available or changes
  useEffect(() => {
    if (initial) {
      setType(initial.type ?? 'expense')
      if (initial.transacted_at) {
        setTransactedAt(initial.transacted_at.slice(0, 16))
      }
      setAmount(initial.amount ?? '')
      setCurrency(initial.currency ?? '')
      setAccountId(initial.account_id ?? '')
      setToAccountId(initial.to_account_id ?? '')
      setPaymentMethodId(initial.payment_method_id ?? null)
      setPayeeId(initial.payee_id ?? null)
      setDescription(initial.description ?? '')
      setNotes(initial.notes ?? '')
      setExternalRef(initial.external_ref ?? '')
      setSelectedCategories(initial.category_ids ?? [])
      setSelectedTags(initial.tag_ids ?? [])
      setSelectedBudgetId(initial.budget_ids?.[0] ?? null)
      setIsSplit(initial.is_split ?? false)
    }
  }, [initial])

  // When payee changes, auto-populate categories from payee defaults — only when
  // the user hasn't already chosen any, to avoid clobbering a manual selection.
  useEffect(() => {
    if (!payeeId) return
    const payee = payees.find((p) => p.id === payeeId)
    if (payee?.default_category_ids?.length && selectedCategories.length === 0) {
      setSelectedCategories(payee.default_category_ids)
    }
  }, [payeeId, payees])

  // When account changes, clear payment method (may not belong to new account)
  useEffect(() => {
    if (initial && accountId === initial.account_id) {
      setPaymentMethodId(initial.payment_method_id ?? null)
    } else {
      setPaymentMethodId(null)
    }
  }, [accountId, initial])

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
      ...(externalRef && { external_ref: externalRef }),
      ...(paymentMethodId && { payment_method_id: paymentMethodId }),
      ...(payeeId && { payee_id: payeeId }),
      ...(type === 'transfer' && toAccountId && { to_account_id: toAccountId }),
      category_ids: selectedCategories,
      tag_ids: selectedTags,
      ...(selectedBudgetId && { budget_ids: [selectedBudgetId] }),
    }

    if (type === 'expense' && isSplit) {
      const splitTotal = splitShares.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
      const txnAmount = Number(amount)
      if (Math.abs(splitTotal - txnAmount) >= 0.005) {
        setError(`Split shares (${splitTotal.toFixed(2)}) must equal transaction amount (${txnAmount.toFixed(2)})`)
        return
      }
    }

    try {
      const txn = await onSubmit(payload)
      if (type === 'expense' && isSplit && txn && 'id' in txn) {
        await createSplit.mutateAsync({
          expense_transaction_ids: [(txn as { id: string }).id],
          shares: splitShares,
        })
      }
    } catch {
      setError('Failed to save transaction. Please try again.')
    }
  }

  const payeeOptions = payees.map((p) => ({ id: p.id, label: p.name }))
  const pmOptions = paymentMethods
    .filter((pm) => !pm.deleted_at)
    .map((pm) => ({ id: pm.id, label: pm.name }))

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Type toggle */}
      <div>
        <label className="block text-sm font-medium text-fg-muted mb-1">Type</label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Transaction type">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                type === t
                  ? t === 'opening_balance'
                    ? 'bg-accent/20 border-accent/50 text-accent'
                    : 'bg-accent-dim border-accent-dim text-white'
                  : 'bg-surface-2 border-border-strong text-fg-muted hover:border-accent'
              }`}
              aria-pressed={type === t}
            >
              {t === 'opening_balance' ? 'Opening Balance' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {type === 'opening_balance' && (
          <p className="mt-1.5 text-xs text-fg-faint">
            Sets the initial balance for a bank or cash account. Not allowed on credit cards or loans.
          </p>
        )}
      </div>

      {/* Date/time */}
      <div>
        <label htmlFor="txn-date" className="block text-sm font-medium text-fg-muted">Date & Time</label>
        <input
          id="txn-date"
          type="datetime-local"
          value={transactedAt}
          onChange={(e) => setTransactedAt(e.target.value)}
          required
          className="mt-1 kk-input"
        />
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="txn-amount" className="block text-sm font-medium text-fg-muted">Amount</label>
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
            className="kk-input flex-1"
          />
          <input
            id="txn-currency"
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="INR"
            maxLength={10}
            className="kk-input w-20"
            aria-label="Currency"
          />
        </div>
      </div>

      {/* Source account */}
      <div>
        <label htmlFor="txn-account" className="block text-sm font-medium text-fg-muted">
          {type === 'transfer' ? 'From Account' : 'Account'}
        </label>
        <select
          id="txn-account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
          className="mt-1 kk-input"
        >
          <option value="">Select account…</option>
          {accounts
            .filter((a) => !a.deleted_at && a.is_active)
            .filter((a) => type !== 'opening_balance' || !LIABILITY_ACCOUNT_TYPES.has(a.type))
            .map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
        </select>
      </div>

      {/* To account (transfers only) */}
      {type === 'transfer' && (
        <div>
          <label htmlFor="txn-to-account" className="block text-sm font-medium text-fg-muted">To Account</label>
          <select
            id="txn-to-account"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            required
            className="mt-1 kk-input"
          >
            <option value="">Select destination…</option>
            {accounts.filter((a) => !a.deleted_at && a.is_active && a.id !== accountId).map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </select>
        </div>
      )}

      {/* Payment method */}
      {type !== 'transfer' && type !== 'opening_balance' && accountId && pmOptions.length > 0 && (
        <div>
          <label htmlFor="txn-pm" className="block text-sm font-medium text-fg-muted">Payment Method</label>
          <Autocomplete
            id="txn-pm"
            options={pmOptions}
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            placeholder="Select payment method…"
          />
        </div>
      )}

      {/* Payee (not for transfers or opening balance) */}
      {type !== 'transfer' && type !== 'opening_balance' && (
        <div>
          <label htmlFor="txn-payee" className="block text-sm font-medium text-fg-muted">Payee</label>
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

      {/* Categories (not for transfers or opening balance) */}
      {type !== 'transfer' && type !== 'opening_balance' && (
        <div>
          <label className="block text-sm font-medium text-fg-muted">Categories</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {allCategories.filter((c) => !c.deleted_at).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCategory(c.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                  ${selectedCategories.includes(c.id)
                    ? 'bg-accent-dim text-white border-accent-dim'
                    : 'bg-surface-2 text-fg-muted border-border-strong hover:border-accent'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label htmlFor="txn-desc" className="block text-sm font-medium text-fg-muted">Description</label>
        <input
          id="txn-desc"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was this for?"
          className="mt-1 kk-input"
        />
      </div>

      {/* Reference / UTR */}
      <div>
        <label htmlFor="txn-ref" className="block text-sm font-medium text-fg-muted">Ref / UTR</label>
        <input
          id="txn-ref"
          type="text"
          value={externalRef}
          onChange={(e) => setExternalRef(e.target.value)}
          placeholder="UPI ref, UTR, cheque no., …"
          className="mt-1 kk-input"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="txn-notes" className="block text-sm font-medium text-fg-muted">Notes</label>
        <textarea
          id="txn-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg focus:outline-none focus:border-accent/50 focus:bg-surface-3 resize-none"
        />
      </div>

      {/* Tags (not for opening balance) */}
      {type !== 'opening_balance' && (
        <div>
          <label className="block text-sm font-medium text-fg-muted">Tags</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {allTags.filter((t) => !t.deleted_at).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                  ${selectedTags.includes(t.id)
                    ? 'bg-accent-dim text-white border-accent-dim'
                    : 'bg-surface-2 text-fg-muted border-border-strong hover:border-accent'}`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Budget (expense only) */}
      {type === 'expense' && allBudgets.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-fg-muted">Budget</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {allBudgets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBudgetId(selectedBudgetId === b.id ? null : b.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                  ${selectedBudgetId === b.id
                    ? 'bg-accent-dim text-white border-accent-dim'
                    : 'bg-surface-2 text-fg-muted border-border-strong hover:border-accent'}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Split toggle (expense only) */}
      {type === 'expense' && (
        <div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isSplit}
              onChange={(e) => {
                setIsSplit(e.target.checked)
                if (!e.target.checked) setSplitShares([])
              }}
              aria-label="Split this expense"
              className="rounded"
            />
            <span className="text-sm font-medium text-fg-muted">Split this expense</span>
          </label>
          {isSplit && (
            <div className="mt-3">
              <SplitSharesEditor
                totalAmount={Number(amount) || 0}
                shares={splitShares}
                onChange={setSplitShares}
              />
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-accent-dim px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50"
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
