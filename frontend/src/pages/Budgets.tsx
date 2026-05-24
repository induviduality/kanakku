import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import {
  useGetBudgets,
  useCreateBudget,
  useDeleteBudget,
  type Budget,
  type BudgetCreate,
  type DeleteScope,
} from '../api/budgets'
import { useCategories } from '../api/categories'
import ConfirmDialog from '../components/ConfirmDialog'
import EntityModal from '../components/EntityModal'
import { EmptyState } from '../components/EmptyState'
import { BudgetDrawer } from '../components/drawers/BudgetDrawer'

function ProgressBar({ spent, amount }: { spent: number; amount: number }) {
  const pct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden" aria-label="budget progress">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function DeleteScopeDialog({
  budget,
  onConfirm,
  onCancel,
}: {
  budget: Budget
  onConfirm: (scope: DeleteScope) => void
  onCancel: () => void
}) {
  const [scope, setScope] = useState<DeleteScope>('current_and_future')

  if (budget.type === 'adhoc') {
    return (
      <ConfirmDialog
        open
        title="Delete budget"
        description={`Delete "${budget.name}"? This can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => onConfirm('current_and_future')}
        onCancel={onCancel}
      />
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4">Delete recurring budget</h2>
        <div className="space-y-2 mb-6">
          {(
            [
              ['instance', 'This instance only'],
              ['future_only', 'This and future instances'],
              ['current_and_future', 'All instances'],
            ] as [DeleteScope, string][]
          ).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="delete-scope"
                value={val}
                checked={scope === val}
                onChange={() => setScope(val)}
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(scope)}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

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

function rruleLabel(rule: string | null): string {
  if (!rule) return ''
  return RRULE_OPTIONS.find(o => o.value === rule)?.label ?? rule
}

export default function Budgets() {
  const { data: budgets = [], isLoading } = useGetBudgets(true)
  const { data: categories = [] } = useCategories()
  const createBudget = useCreateBudget()
  const deleteBudget = useDeleteBudget()

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null)
  const [drawerBudgetId, setDrawerBudgetId] = useState<string | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [type, setType] = useState<'adhoc' | 'recurring'>('adhoc')
  const [rrule, setRrule] = useState('FREQ=MONTHLY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [createError, setCreateError] = useState('')

  function resetForm() {
    setName('')
    setAmount('')
    setCurrency('INR')
    setType('adhoc')
    setRrule('FREQ=MONTHLY')
    setStartDate('')
    setEndDate('')
    setSelectedCats([])
    setCreateError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
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
      resetForm()
      setCreateOpen(false)
    } catch {
      setCreateError('Failed to create budget.')
    }
  }

  async function handleDelete(scope: DeleteScope) {
    if (!deleteTarget) return
    await deleteBudget.mutateAsync({ id: deleteTarget.id, scope })
    setDeleteTarget(null)
  }

  function toggleCat(id: string) {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <button
          onClick={() => { resetForm(); setCreateOpen(true) }}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Add budget
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading budgets…</p>
      ) : budgets.length === 0 ? (
        <EmptyState title="No budgets yet" description="Create a budget to start tracking your spending limits." />
      ) : (
        <div className="space-y-4">
          {budgets.map((b) => (
            <div
              key={b.id}
              className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm cursor-pointer hover:border-indigo-200 transition-colors"
              onClick={() => setDrawerBudgetId(b.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{b.name}</p>
                  <p className="text-xs text-gray-400">
                    {b.type === 'recurring' ? `Recurring${b.recurrence_rule ? ` · ${rruleLabel(b.recurrence_rule)}` : ''}` : 'Ad-hoc'}
                    {!b.is_active && ' · Inactive'}
                  </p>
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Link
                    to="/budgets/$budgetId/edit"
                    params={{ budgetId: b.id }}
                    className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(b)}
                    className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
                    title="Delete"
                    aria-label={`Delete ${b.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <ProgressBar spent={parseFloat(b.current_spent)} amount={parseFloat(b.amount)} />
              <p className="text-right text-xs text-gray-500 mt-1">
                ₹{parseFloat(b.current_spent).toLocaleString('en-IN')} / ₹{parseFloat(b.amount).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
      )}

      <EntityModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetForm() }}
        title="Add budget"
      >
        <form onSubmit={handleCreate} className="space-y-4">
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
          {type === 'recurring' && (
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
          {createError && (
            <p role="alert" className="text-sm text-red-600">{createError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setCreateOpen(false); resetForm() }}
              className="text-sm text-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBudget.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createBudget.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </EntityModal>

      {deleteTarget && (
        <DeleteScopeDialog
          budget={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <BudgetDrawer budgetId={drawerBudgetId} onClose={() => setDrawerBudgetId(null)} />
    </main>
  )
}
