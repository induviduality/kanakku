import { useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { useGetBudget, useGetBudgetTransactions, type BudgetTransactionItem } from '../api/budgets'
import { TransactionDrawer } from '../components/drawers/TransactionDrawer'
import type { Transaction, TransactionType } from '../api/transactions'
import { usePeriod } from '../lib/period-context'

function toTransaction(item: BudgetTransactionItem): Transaction {
  return {
    ...item,
    user_id: '',
    type: item.type as TransactionType,
    notes: null,
    payment_method_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    subscription_id: null,
    import_record_id: null,
    tag_ids: [],
    budget_ids: [],
    created_at: item.transacted_at,
    updated_at: item.transacted_at,
    deleted_at: null,
  }
}

function badge(linkType: 'explicit' | 'category_match') {
  return linkType === 'explicit' ? (
    <span className="kk-chip kk-chip-accent">explicit</span>
  ) : (
    <span className="kk-chip kk-chip-neutral">category match</span>
  )
}

export default function BudgetDetail() {
  const { budgetId } = useParams({ from: '/budgets/$budgetId' })
  const { dashboardParams } = usePeriod()
  const { data: budget, isLoading: budgetLoading } = useGetBudget(budgetId)
  const { data: txnsData, isLoading: txnsLoading } = useGetBudgetTransactions(
    budgetId,
    dashboardParams.start_date,
    dashboardParams.end_date,
  )
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)

  if (budgetLoading) {
    return <p className="p-6 text-gray-500">Loading budget…</p>
  }
  if (!budget) {
    return <p className="p-6 text-red-500">Budget not found.</p>
  }

  const spent = parseFloat(txnsData?.total_spent ?? '0')
  const total = parseFloat(budget.amount)
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link to="/budgets" className="text-sm text-indigo-600 hover:underline">
          ← Budgets
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{budget.name}</h1>
      <p className="text-sm text-gray-500 mb-4">
        {budget.type === 'recurring' ? `Recurring${budget.period ? ` · ${budget.period}` : ''}` : 'Ad-hoc'}
        {budget.start_date && ` · From ${budget.start_date}`}
        {budget.end_date && ` to ${budget.end_date}`}
      </p>

      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
        <div className="flex justify-between text-sm text-gray-700 mb-2">
          <span>Spent</span>
          <span>
            ₹{spent.toLocaleString('en-IN')} / ₹{total.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden" aria-label="spending progress">
          <div className={`h-3 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-right text-xs text-gray-400 mt-1">{pct.toFixed(0)}% used</p>
      </div>

      {/* Transactions */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Transactions</h2>
      {txnsLoading ? (
        <p className="text-gray-400">Loading transactions…</p>
      ) : !txnsData || txnsData.items.length === 0 ? (
        <p className="text-gray-400">No transactions linked to this budget.</p>
      ) : (
        <div className="kk-card p-0 overflow-hidden divide-y divide-border/50">
          {txnsData.items.map((t) => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTxn(toTransaction(t))}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelectedTxn(toTransaction(t))}
              className="flex items-center justify-between px-4 py-3 hover:bg-surface-2/50 cursor-pointer transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">
                  {t.description ?? t.type}
                </p>
                <p className="text-xs text-fg-faint">
                  {new Date(t.transacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {badge(t.link_type)}
                <span className="text-sm font-semibold text-fg kk-mono">
                  ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <TransactionDrawer transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
    </main>
  )
}
