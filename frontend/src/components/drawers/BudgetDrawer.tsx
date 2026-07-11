import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Calendar, Clock } from 'lucide-react'
import { Drawer } from '../Drawer'
import { TransactionDrawer } from './TransactionDrawer'
import { useGetBudget, useGetBudgetTransactions, type BudgetTransactionItem } from '../../api/budgets'
import type { Transaction, TransactionType } from '../../api/transactions'
import { rruleLabel } from '../../lib/rrule'
import { usePeriod } from '../../lib/period-context'

interface Props {
  budgetId: string | null
  onClose: () => void
}

const RING_R = 50
const RING_CIRC = 2 * Math.PI * RING_R

function RingProgress({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const offset = RING_CIRC * (1 - clamped / 100)
  const stroke =
    clamped >= 90 ? 'var(--kk-negative)' :
    clamped >= 70 ? 'var(--kk-warning)' :
    'var(--kk-positive)'

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" fill="none">
        <circle cx="60" cy="60" r={RING_R} strokeWidth="9" stroke="rgba(255,255,255,0.06)" />
        <circle
          cx="60" cy="60" r={RING_R}
          strokeWidth="9"
          stroke={stroke}
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[18px] font-bold text-fg leading-none kk-mono">{clamped.toFixed(0)}%</span>
        <span className="text-[10px] text-fg-faint leading-none tracking-wide">used</span>
      </div>
    </div>
  )
}

function fmtLong(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShort(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function toTransaction(item: BudgetTransactionItem): Transaction {
  return {
    ...item,
    user_id: '',
    type: item.type as TransactionType,
    notes: null,
    external_ref: null,
    payment_method_id: null,
    payment_method_name: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    subscription_id: null,
    import_record_id: null,
    split_id: null,
    is_split: false,
    spending_classification: null,
    piggy_bank_id: null,
    tag_ids: [],
    budget_ids: [],
    created_at: item.transacted_at,
    updated_at: item.transacted_at,
    deleted_at: null,
  }
}

export function BudgetDrawer({ budgetId, onClose }: Props) {
  const { dashboardParams, rangeStart, rangeEnd } = usePeriod()
  const { data: budget, isLoading } = useGetBudget(budgetId ?? '')
  const { data: txnsData, isLoading: txnsLoading } = useGetBudgetTransactions(
    budgetId ?? '',
    dashboardParams.start_date ? rangeStart : undefined,
    dashboardParams.end_date ? rangeEnd : undefined,
  )
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null)

  const spent = parseFloat(txnsData?.total_spent ?? '0')
  const total = budget ? parseFloat(budget.amount) : 0
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const remaining = Math.max(0, total - spent)
  const overBudget = spent > total

  return (
    <>
      <Drawer open={!!budgetId} onClose={onClose} title={budget?.name ?? 'Budget'}>
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />)}
          </div>
        ) : budget ? (
          <div className="space-y-4 p-5">

            {/* ── Hero: circular ring + spend info ── */}
            <div className="kk-panel flex items-center gap-5 p-5">
              <RingProgress pct={pct} />
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint mb-1">
                    Spent this period
                  </p>
                  <p className="text-[26px] font-bold text-fg kk-mono leading-none">
                    ₹{spent.toLocaleString('en-IN')}
                  </p>
                  <p className="text-sm text-fg-muted kk-mono mt-0.5">
                    of ₹{total.toLocaleString('en-IN')}
                  </p>
                </div>
                <span className={`kk-chip ${overBudget ? 'kk-chip-negative' : remaining === 0 && total > 0 ? 'kk-chip-warning' : 'kk-chip-positive'}`}>
                  {overBudget
                    ? `₹${(spent - total).toLocaleString('en-IN')} over budget`
                    : `₹${remaining.toLocaleString('en-IN')} remaining`}
                </span>
              </div>
            </div>

            {/* ── Period + Created ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="kk-panel p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">
                    Period
                  </span>
                </div>
                <p className="text-sm font-semibold text-fg leading-snug">
                  {fmtShort(dashboardParams.start_date)}
                  {' – '}
                  {fmtShort(dashboardParams.end_date)}
                </p>
              </div>

              <div className="kk-panel p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">
                    Created
                  </span>
                </div>
                <p className="text-sm font-semibold text-fg leading-snug">
                  {fmtLong(budget.created_at)}
                </p>
              </div>
            </div>

            {/* ── Budget details ── */}
            <div className="kk-panel p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-xs text-fg-muted">Type</span>
                <span className={`kk-chip ${budget.type === 'recurring' ? 'kk-chip-accent' : 'kk-chip-neutral'}`}>
                  {budget.type === 'recurring' ? 'Recurring' : 'Ad-hoc'}
                </span>
              </div>
              {budget.recurrence_rule && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-xs text-fg-muted">Schedule</span>
                  <span className="text-sm text-fg">{rruleLabel(budget.recurrence_rule)}</span>
                </div>
              )}
              {budget.end_date && (
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-xs text-fg-muted">Ends on</span>
                  <span className="text-sm text-fg">{fmtLong(budget.end_date)}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-fg-muted">Budget amount</span>
                <span className="text-sm font-semibold text-fg kk-mono">
                  ₹{total.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* ── Transactions ── */}
            <div>
              <p className="kk-section-label">
                Transactions{txnsData ? ` (${txnsData.items.length})` : ''}
              </p>
              {txnsLoading ? (
                <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
              ) : !txnsData || txnsData.items.length === 0 ? (
                <div className="kk-panel py-7 text-center">
                  <p className="text-xs text-fg-faint">No transactions in this period.</p>
                </div>
              ) : (
                <div className="kk-panel p-0 overflow-hidden">
                  {txnsData.items.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTxn(toTransaction(t))}
                      className={`w-full flex items-center justify-between px-4 py-3 gap-3 text-left hover:bg-surface-2/60 transition-colors ${i < txnsData.items.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg truncate">{t.description ?? t.type}</p>
                        <p className="text-xs text-fg-faint mt-0.5">
                          {new Date(t.transacted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          {' · '}
                          <span className={t.link_type === 'explicit' ? 'text-accent' : 'text-fg-faint'}>
                            {t.link_type === 'explicit' ? 'explicit' : 'category'}
                          </span>
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-fg kk-mono shrink-0">
                        ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── View full details button ── */}
            <Link
              to="/budgets/$budgetId"
              params={{ budgetId: budget.id }}
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent font-semibold text-sm transition-colors"
            >
              View full budget details
              <ArrowRight className="w-4 h-4" />
            </Link>

          </div>
        ) : (
          <p className="p-5 text-sm text-negative-dim">Budget not found.</p>
        )}
      </Drawer>

      <TransactionDrawer transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
    </>
  )
}
