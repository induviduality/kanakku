import { useState, useEffect } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  useGetBudget,
  useCreateBudget,
  usePatchBudget,
  type BudgetCreate,
  type BudgetPatch,
  type EditScope,
} from '../api/budgets'
import { useCategories } from '../api/categories'
import EntityModal from '../components/EntityModal'

const INPUT_CLS =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LABEL_CLS = 'block text-sm font-medium text-gray-700'

const RRULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'FREQ=DAILY',              label: 'Daily' },
  { value: 'FREQ=WEEKLY',             label: 'Weekly' },
  { value: 'FREQ=MONTHLY',            label: 'Monthly' },
  { value: 'FREQ=MONTHLY;INTERVAL=3', label: 'Quarterly' },
  { value: 'FREQ=YEARLY',             label: 'Yearly' },
]

function ScopeDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: (scope: EditScope) => void
  onCancel: () => void
}) {
  const [affectCurrent, setAffectCurrent] = useState(true)

  return (
    <EntityModal open={open} onClose={onCancel} title="Edit recurring budget">
      <div className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
          <input
            type="checkbox"
            checked={affectCurrent}
            onChange={(e) => setAffectCurrent(e.target.checked)}
          />
          Also affect the current period?
        </label>
        <p className="text-xs text-gray-400">
          {affectCurrent
            ? 'Changes will apply to the current and all future periods.'
            : 'Changes will only apply to future periods.'}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm text-gray-500">Cancel</button>
          <button
            onClick={() => onConfirm(affectCurrent ? 'current_and_future' : 'future_only')}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </EntityModal>
  )
}

export default function BudgetFormPage() {
  const navigate = useNavigate()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { budgetId } = useParams({ strict: false }) as any as { budgetId?: string }
  const isEdit = !!budgetId

  const { data: existing } = useGetBudget(budgetId ?? null)
  const { data: categories = [] } = useCategories()
  const createBudget = useCreateBudget()
  const patchBudget = usePatchBudget()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [type, setType] = useState<'adhoc' | 'recurring'>('adhoc')
  const [rrule, setRrule] = useState('FREQ=MONTHLY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [error, setError] = useState('')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [pendingPatch, setPendingPatch] = useState<BudgetPatch | null>(null)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setAmount(existing.amount)
      setCurrency(existing.currency)
      setType(existing.type)
      setRrule(existing.recurrence_rule ?? 'FREQ=MONTHLY')
      setStartDate(existing.start_date ?? '')
      setEndDate(existing.end_date ?? '')
      setSelectedCats(existing.category_ids)
    }
  }, [existing])

  function toggleCat(id: string) {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (isEdit && existing) {
      const patch: BudgetPatch = {
        name,
        amount,
        currency,
        category_ids: selectedCats,
      }
      if (rrule) patch.recurrence_rule = rrule
      if (startDate) patch.start_date = startDate
      if (endDate) patch.end_date = endDate

      if (existing.type === 'recurring') {
        setPendingPatch(patch)
        setScopeOpen(true)
        return
      }

      try {
        await patchBudget.mutateAsync({ id: budgetId!, patch })
        navigate({ to: '/budgets' })
      } catch {
        setError('Failed to save budget.')
      }
      return
    }

    const body: BudgetCreate = {
      name,
      amount,
      currency,
      type,
      category_ids: selectedCats,
    }
    if (startDate) body.start_date = startDate
    if (endDate) body.end_date = endDate
    if (type === 'recurring' && rrule) body.recurrence_rule = rrule

    try {
      await createBudget.mutateAsync(body)
      navigate({ to: '/budgets' })
    } catch {
      setError('Failed to create budget.')
    }
  }

  async function handleScopeConfirm(scope: EditScope) {
    setScopeOpen(false)
    if (!pendingPatch || !budgetId) return
    try {
      await patchBudget.mutateAsync({ id: budgetId, patch: pendingPatch, scope })
      navigate({ to: '/budgets' })
    } catch {
      setError('Failed to save budget.')
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? 'Edit budget' : 'New budget'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="budget-name" className={LABEL_CLS}>Name</label>
          <input
            id="budget-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={INPUT_CLS}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="budget-amount" className={LABEL_CLS}>Amount</label>
            <input
              id="budget-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label htmlFor="budget-currency" className={LABEL_CLS}>Currency</label>
            <input
              id="budget-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className={INPUT_CLS}
            />
          </div>
        </div>

        {!isEdit && (
          <div>
            <label className={LABEL_CLS}>Type</label>
            <div className="flex gap-4 mt-1">
              {(['adhoc', 'recurring'] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="budget-type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                  />
                  {t === 'adhoc' ? 'Ad-hoc' : 'Recurring'}
                </label>
              ))}
            </div>
          </div>
        )}

        {(type === 'recurring' || existing?.type === 'recurring') && (
          <div>
            <label htmlFor="budget-rrule" className={LABEL_CLS}>Recurrence</label>
            <select
              id="budget-rrule"
              value={rrule}
              onChange={(e) => setRrule(e.target.value)}
              className={INPUT_CLS}
            >
              {RRULE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="budget-start" className={LABEL_CLS}>Start date</label>
            <input
              id="budget-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label htmlFor="budget-end" className={LABEL_CLS}>End date</label>
            <input
              id="budget-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div>
            <label className={LABEL_CLS}>Categories</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={`rounded-full px-3 py-0.5 text-xs font-medium border ${
                    selectedCats.includes(c.id)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/budgets' })}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createBudget.isPending || patchBudget.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {(createBudget.isPending || patchBudget.isPending)
              ? 'Saving…'
              : isEdit
              ? 'Save changes'
              : 'Create budget'}
          </button>
        </div>
      </form>

      <ScopeDialog
        open={scopeOpen}
        onConfirm={handleScopeConfirm}
        onCancel={() => setScopeOpen(false)}
      />
    </main>
  )
}
