import { Link } from '@tanstack/react-router'
import type { BudgetSummaryItem } from '../../api/dashboard'

const STATUS_COLOR: Record<string, string> = {
  over_budget: 'kk-bar-fill--negative',
  warning: 'kk-bar-fill--warning',
  on_track: 'kk-bar-fill--positive',
}

export default function BudgetProgressCard({ budget }: { budget: BudgetSummaryItem }) {
  const pct = Math.min(budget.percentage, 100)
  const barColor = STATUS_COLOR[budget.status] ?? 'bg-green-500'
  const spent = parseFloat(budget.spent)
  const amount = parseFloat(budget.amount)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link to={`/budgets/${budget.id}` as any} className="font-medium text-fg hover:text-accent truncate">
          {budget.name}
        </Link>
        <span
          aria-label={`budget status: ${budget.status}`}
          className={`kk-chip ${
            budget.status === 'over_budget'
              ? 'kk-chip-negative'
              : budget.status === 'warning'
                ? 'kk-chip-warning'
                : 'kk-chip-positive'
          }`}
        >
          {budget.status === 'over_budget' ? 'Over budget' : budget.status === 'warning' ? 'Warning' : 'On track'}
        </span>
      </div>
      <div className="kk-bar" aria-label="budget progress bar">
        <div className={`kk-bar-fill ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-fg-muted">
        <span>₹{spent.toLocaleString('en-IN')} spent</span>
        <span>₹{amount.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}
