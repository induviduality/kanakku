import { Drawer, DrawerSection, DrawerRow } from '../Drawer'
import { useGetBudget, useGetBudgetTransactions } from '../../api/budgets'
import { rruleLabel } from '../../lib/rrule'
import { usePeriod } from '../../lib/period-context'

interface Props {
  budgetId: string | null
  onClose: () => void
}

export function BudgetDrawer({ budgetId, onClose }: Props) {
  const { dashboardParams } = usePeriod()
  const { data: budget, isLoading } = useGetBudget(budgetId ?? '')
  const { data: txnsData, isLoading: txnsLoading } = useGetBudgetTransactions(
    budgetId ?? '',
    dashboardParams.start_date,
    dashboardParams.end_date,
  )

  const spent = parseFloat(txnsData?.total_spent ?? '0')
  const total = budget ? parseFloat(budget.amount) : 0
  const pct   = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const barCls =
    pct >= 90 ? 'kk-bar-fill--negative' : pct >= 70 ? 'kk-bar-fill--warning' : 'kk-bar-fill--positive'

  return (
    <Drawer open={!!budgetId} onClose={onClose} title={budget?.name ?? 'Budget'}>
      {isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />)}
        </div>
      ) : budget ? (
        <div className="space-y-6 p-5">
          {/* Progress card */}
          <div className="kk-panel space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-fg-muted">Spent</span>
              <span className="font-semibold text-fg kk-mono">
                ₹{spent.toLocaleString('en-IN')} <span className="text-fg-muted font-normal">/ ₹{total.toLocaleString('en-IN')}</span>
              </span>
            </div>
            <div className="kk-bar">
              <div className={`kk-bar-fill kk-bar-grow ${barCls}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-right text-xs text-fg-faint">{pct.toFixed(0)}% used</p>
          </div>

          {/* Details */}
          <DrawerSection label="Details">
            <div className="kk-panel">
              <DrawerRow label="Type" value={budget.type === 'recurring' ? 'Recurring' : 'Ad-hoc'} />
              {budget.recurrence_rule && <DrawerRow label="Recurrence" value={rruleLabel(budget.recurrence_rule)} />}
              {budget.start_date && <DrawerRow label="From" value={budget.start_date} />}
              {budget.end_date && <DrawerRow label="To" value={budget.end_date} />}
              <DrawerRow label="Amount" value={<span className="kk-mono">₹{total.toLocaleString('en-IN')}</span>} />
            </div>
          </DrawerSection>

          {/* Linked transactions */}
          <DrawerSection label={`Transactions${txnsData ? ` (${txnsData.items.length})` : ''}`}>
            {txnsLoading ? (
              <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
            ) : !txnsData || txnsData.items.length === 0 ? (
              <p className="text-xs text-fg-faint">No transactions linked yet.</p>
            ) : (
              <div className="kk-panel divide-y divide-border p-0 overflow-hidden">
                {txnsData.items.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{t.description ?? t.type}</p>
                      <p className="text-xs text-fg-faint">
                        {new Date(t.transacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        {' · '}
                        <span className={t.link_type === 'explicit' ? 'text-accent' : 'text-fg-faint'}>
                          {t.link_type === 'explicit' ? 'explicit' : 'category'}
                        </span>
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-fg kk-mono shrink-0 ml-3">
                      ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>
        </div>
      ) : (
        <p className="p-5 text-sm text-negative-dim">Budget not found.</p>
      )}
    </Drawer>
  )
}
