import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { rruleLabel } from '../lib/rrule'
import { usePeriod } from '../lib/period-context'
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
import ConfirmDialog from '../components/ConfirmDialog'
import EntityModal from '../components/EntityModal'
import { EmptyState } from '../components/EmptyState'
import { BudgetDrawer } from '../components/drawers/BudgetDrawer'

// ── Rrule helpers ─────────────────────────────────────────────────────────────

const PREDEFINED_RRULES: { value: string; label: string }[] = [
  { value: 'FREQ=DAILY',              label: 'Daily' },
  { value: 'FREQ=WEEKLY',             label: 'Weekly' },
  { value: 'FREQ=MONTHLY;BYMONTHDAY=1', label: 'Monthly' },
  { value: 'FREQ=MONTHLY;INTERVAL=3', label: 'Quarterly' },
  { value: 'FREQ=YEARLY',             label: 'Yearly' },
]

function customIntervalRrule(days: number) {
  return days === 1 ? 'FREQ=DAILY' : `FREQ=DAILY;INTERVAL=${days}`
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ spent, amount }: { spent: number; amount: number }) {
  const pct   = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden" aria-label="budget progress">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Delete-scope dialog ───────────────────────────────────────────────────────

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
              ['instance',            'This instance only'],
              ['future_only',         'This and future instances'],
              ['current_and_future',  'All instances'],
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

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT_CLS  = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LABEL_CLS  = 'block text-sm font-medium text-gray-700'

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="mt-1 inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 gap-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === o.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// Returns false only when the period filter is active AND the budget's dates
// are entirely outside it, so newly created budgets appear immediately.
function budgetMatchesPeriod(budget: Budget, fromDate?: string, toDate?: string): boolean {
  if (!fromDate && !toDate) return true
  const s = budget.start_date
  const e = budget.end_date
  if (toDate && s && s > toDate) return false
  if (fromDate && e && e < fromDate) return false
  return true
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Budgets() {
  // ── Period from global nav ───────────────────────────────────────────────
  const { dashboardParams } = usePeriod()
  const fromDate = dashboardParams.start_date
  const toDate   = dashboardParams.end_date

  // ── Data hooks ───────────────────────────────────────────────────────────
  const qc = useQueryClient()
  const { data: budgets = [], isLoading } = useGetBudgets(true, fromDate, toDate)
  const createBudget  = useCreateBudget()
  const deleteBudget  = useDeleteBudget()

  // ── UI state ─────────────────────────────────────────────────────────────
  const [createOpen,     setCreateOpen]     = useState(false)
  const [deleteTarget,   setDeleteTarget]   = useState<Budget | null>(null)
  const [drawerBudgetId, setDrawerBudgetId] = useState<string | null>(null)

  // ── Create form state ─────────────────────────────────────────────────────
  const [name,         setName]         = useState('')
  const [amount,       setAmount]       = useState('')
  const [currency,     setCurrency]     = useState('INR')
  const [budgetType,   setBudgetType]   = useState<'adhoc' | 'recurring'>('adhoc')
  // recurring sub-options
  const [scheduleKind, setScheduleKind] = useState<'predefined' | 'custom'>('predefined')
  const [predefined,   setPredefined]   = useState(PREDEFINED_RRULES[2].value) // Monthly
  const [customDays,   setCustomDays]   = useState('14')
  // dates
  const [startDate,    setStartDate]    = useState('')
  const [endDate,      setEndDate]      = useState('')
  const [createError,  setCreateError]  = useState('')

  function resetForm() {
    setName(''); setAmount(''); setCurrency('INR')
    setBudgetType('adhoc'); setScheduleKind('predefined')
    setPredefined(PREDEFINED_RRULES[2].value); setCustomDays('14')
    setStartDate(''); setEndDate(''); setCreateError('')
  }

  function buildRrule() {
    if (budgetType !== 'recurring') return undefined
    if (scheduleKind === 'predefined') return predefined
    const days = parseInt(customDays, 10)
    return isNaN(days) || days < 1 ? undefined : customIntervalRrule(days)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    const rrule = buildRrule()
    if (budgetType === 'recurring' && !rrule) {
      setCreateError('Please enter a valid interval (≥ 1 day).')
      return
    }
    const body: BudgetCreate = { name, amount, currency, type: budgetType }
    if (startDate)       body.start_date       = startDate
    if (endDate)         body.end_date         = endDate
    if (rrule)           body.recurrence_rule  = rrule
    try {
      const newBudget = await createBudget.mutateAsync(body)
      resetForm()
      setCreateOpen(false)
      if (budgetMatchesPeriod(newBudget, fromDate, toDate)) {
        qc.setQueryData(
          ['budgets', { includeInactive: true, fromDate, toDate }],
          (old: Budget[] | undefined) => (old ? [...old, newBudget] : [newBudget]),
        )
      }
    } catch {
      setCreateError('Failed to create budget.')
    }
  }

  async function handleDelete(scope: DeleteScope) {
    if (!deleteTarget) return
    await deleteBudget.mutateAsync({ id: deleteTarget.id, scope })
    setDeleteTarget(null)
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
        <button
          onClick={() => { resetForm(); setCreateOpen(true) }}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Add budget
        </button>
      </div>

      {/* Budget list */}
      {isLoading ? (
        <p className="text-gray-500">Loading budgets…</p>
      ) : budgets.length === 0 ? (
        <EmptyState title="No budgets" description="No budgets were active during this period." />
      ) : (
        <div className="space-y-4">
          {budgets.map(b => {
            const spent  = parseFloat(b.current_spent) || 0
            const total  = parseFloat(b.amount) || 0
            return (
              <div
                key={b.id}
                className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm cursor-pointer hover:border-indigo-200 transition-colors"
                onClick={() => setDrawerBudgetId(b.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{b.name}</p>
                    <p className="text-xs text-gray-400">
                      {b.type === 'recurring'
                        ? `Recurring${b.recurrence_rule ? ` · ${rruleLabel(b.recurrence_rule)}` : ''}`
                        : 'Ad-hoc'}
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
                <ProgressBar spent={spent} amount={total} />
                <p className="text-right text-xs text-gray-500 mt-1">
                  ₹{spent.toLocaleString('en-IN')} / ₹{total.toLocaleString('en-IN')}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      <EntityModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); resetForm() }}
        title="Add budget"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="budget-name" className={LABEL_CLS}>Name</label>
            <input
              id="budget-name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className={INPUT_CLS}
            />
          </div>

          {/* Amount + currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="budget-amount" className={LABEL_CLS}>Amount</label>
              <input
                id="budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="budget-currency" className={LABEL_CLS}>Currency</label>
              <input
                id="budget-currency"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className={LABEL_CLS}>Type</label>
            <SegmentedControl
              options={[{ value: 'adhoc', label: 'Ad-hoc' }, { value: 'recurring', label: 'Recurring' }]}
              value={budgetType}
              onChange={setBudgetType}
            />
          </div>

          {/* Recurring schedule */}
          {budgetType === 'recurring' && (
            <div className="space-y-4 rounded-xl border border-gray-200 p-4 bg-gray-50">
              <div>
                <label className={LABEL_CLS}>Schedule</label>
                <SegmentedControl
                  options={[{ value: 'predefined', label: 'Predefined' }, { value: 'custom', label: 'Custom interval' }]}
                  value={scheduleKind}
                  onChange={setScheduleKind}
                />
              </div>

              {scheduleKind === 'predefined' ? (
                <div>
                  <label className={LABEL_CLS}>Repeats</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PREDEFINED_RRULES.map(o => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setPredefined(o.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          predefined === o.value
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="budget-custom-days" className={LABEL_CLS}>Refresh every</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="budget-custom-days"
                      type="number"
                      min="1"
                      step="1"
                      value={customDays}
                      onChange={e => setCustomDays(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="14"
                    />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                  {parseInt(customDays, 10) > 0 && (
                    <p className="mt-1.5 text-xs text-indigo-600 font-medium">
                      Resets every {customDays} day{parseInt(customDays, 10) !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="budget-start" className={LABEL_CLS}>
                {budgetType === 'recurring' ? 'First period starts' : 'Start date'}
              </label>
              <input
                id="budget-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            {budgetType === 'adhoc' && (
              <div>
                <label htmlFor="budget-end" className={LABEL_CLS}>End date</label>
                <input
                  id="budget-end"
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
            )}
          </div>


          {createError && <p role="alert" className="text-sm text-red-600">{createError}</p>}

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
