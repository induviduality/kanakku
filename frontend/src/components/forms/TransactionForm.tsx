import { useEffect, useState } from 'react'
import type { SpendingClassification, Transaction, TransactionCreate, TransactionPatch, TransactionType } from '../../api/transactions'
import { SPENDING_CLASSIFICATION_LABELS } from '../../api/transactions'
import { useAccounts, usePaymentMethods } from '../../api/accounts'
import { useCategories } from '../../api/categories'
import { useTags, useCreateTag } from '../../api/tags'
import { usePayees, useCreatePayee } from '../../api/payees'
import { useGetBudgets } from '../../api/budgets'
import { useGetPiggyBanks } from '../../api/piggy_banks'
import Autocomplete from '../Autocomplete'

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
  const { data: allPiggyBanks = [] } = useGetPiggyBanks()
  const createPayeeMutation = useCreatePayee()
  const createTagMutation = useCreateTag()

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initial?.category_ids?.[0] ?? null,
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tag_ids ?? [])
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(
    initial?.budget_ids?.[0] ?? null,
  )
  const [newTagInput, setNewTagInput] = useState('')
  const [spendingClassification, setSpendingClassification] = useState<SpendingClassification | null>(
    initial?.spending_classification ?? null,
  )
  const [selectedPiggyBankId, setSelectedPiggyBankId] = useState<string | null>(
    initial?.piggy_bank_id ?? null,
  )
  const [error, setError] = useState('')

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
      setSelectedCategoryId(initial.category_ids?.[0] ?? null)
      setSelectedTags(initial.tag_ids ?? [])
      setSelectedBudgetId(initial.budget_ids?.[0] ?? null)
      setSpendingClassification(initial.spending_classification ?? null)
      setSelectedPiggyBankId(initial.piggy_bank_id ?? null)
    }
  }, [initial])

  // When payee changes, auto-populate category from payee defaults — only when
  // the user hasn't already chosen one, to avoid clobbering a manual selection.
  useEffect(() => {
    if (!payeeId) return
    const payee = payees.find((p) => p.id === payeeId)
    if (payee?.default_category_ids?.length && !selectedCategoryId) {
      setSelectedCategoryId(payee.default_category_ids[0])
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
      category_ids: selectedCategoryId ? [selectedCategoryId] : [],
      tag_ids: selectedTags,
      ...(selectedBudgetId && { budget_ids: [selectedBudgetId] }),
      spending_classification: spendingClassification,
      ...(selectedPiggyBankId && { piggy_bank_id: selectedPiggyBankId }),
    }

    try {
      await onSubmit(payload)
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

      {/* Category (single-select, not for transfers or opening balance) */}
      {type !== 'transfer' && type !== 'opening_balance' && (
        <div>
          <label htmlFor="txn-category" className="block text-sm font-medium text-fg-muted">Category</label>
          <select
            id="txn-category"
            value={selectedCategoryId ?? ''}
            onChange={(e) => setSelectedCategoryId(e.target.value || null)}
            className="mt-1 kk-input"
          >
            <option value="">— none —</option>
            {allCategories.filter((c) => !c.deleted_at).map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ${c.name}` : c.name}
              </option>
            ))}
          </select>
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

      {/* Tags — multi-select with inline create (not for opening balance) */}
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
          <div className="mt-1.5 flex gap-1.5">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newTagInput.trim()) {
                  e.preventDefault()
                  const existing = allTags.find(
                    (t) => t.name.toLowerCase() === newTagInput.trim().toLowerCase()
                  )
                  if (existing) {
                    if (!selectedTags.includes(existing.id)) toggleTag(existing.id)
                  } else {
                    const created = await createTagMutation.mutateAsync({ name: newTagInput.trim() })
                    setSelectedTags((prev) => [...prev, created.id])
                  }
                  setNewTagInput('')
                }
              }}
              placeholder="Type & press Enter to create"
              className="kk-input h-7 text-xs flex-1"
            />
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

      {/* Piggy bank (expense + income only) */}
      {type !== 'transfer' && type !== 'opening_balance' && allPiggyBanks.filter(p => !p.deleted_at && !p.is_completed).length > 0 && (
        <div>
          <label className="block text-sm font-medium text-fg-muted">Savings Goal</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {allPiggyBanks.filter(p => !p.deleted_at && !p.is_completed).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPiggyBankId(selectedPiggyBankId === p.id ? null : p.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors
                  ${selectedPiggyBankId === p.id
                    ? 'bg-accent-dim text-white border-accent-dim'
                    : 'bg-surface-2 text-fg-muted border-border-strong hover:border-accent'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Spending classification (expense + income only) */}
      {type !== 'transfer' && type !== 'opening_balance' && (
        <div>
          <label htmlFor="txn-classification" className="block text-sm font-medium text-fg-muted">
            Spending Classification
          </label>
          <select
            id="txn-classification"
            value={spendingClassification ?? ''}
            onChange={(e) =>
              setSpendingClassification((e.target.value as SpendingClassification) || null)
            }
            className="mt-1 kk-input"
          >
            <option value="">— unclassified —</option>
            {(Object.entries(SPENDING_CLASSIFICATION_LABELS) as [SpendingClassification, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>{label}</option>
              )
            )}
          </select>
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
