import { Link } from '@tanstack/react-router'
import type { BudgetSummaryItem } from '../../api/dashboard'

const STATUS_COLOR: Record<string, string> = {
  over_budget: 'bg-red-500',
  warning: 'bg-amber-400',
  on_track: 'bg-green-500',
}

export default function BudgetProgressCard({ budget }: { budget: BudgetSummaryItem }) {
  const pct = Math.min(budget.percentage, 100)
  const barColor = STATUS_COLOR[budget.status] ?? 'bg-green-500'
  const spent = parseFloat(budget.spent)
  const amount = parseFloat(budget.amount)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <Link to={`/budgets/${budget.id}`} className="font-medium text-gray-800 hover:text-indigo-600 truncate">
          {budget.name}
        </Link>
        <span
          aria-label={`budget status: ${budget.status}`}
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            budget.status === 'over_budget'
              ? 'bg-red-100 text-red-700'
              : budget.status === 'warning'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-green-100 text-green-700'
          }`}
        >
          {budget.status === 'over_budget' ? 'Over' : budget.status === 'warning' ? 'Warning' : 'On track'}
        </span>
      </div>
      <div
        className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"
        aria-label="budget progress bar"
      >
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>₹{spent.toLocaleString('en-IN')} spent</span>
        <span>₹{amount.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}
