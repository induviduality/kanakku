import NumberFlow from '@number-flow/react'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useGetDashboard } from '../api/dashboard'
import BudgetProgressCard from '../components/dashboard/BudgetProgressCard'
import CategoryBreakdownChart from '../components/dashboard/CategoryBreakdownChart'
import PiggyBankProgressRing from '../components/dashboard/PiggyBankProgressRing'
import SubscriptionStatusBadge from '../components/dashboard/SubscriptionStatusBadge'

// ── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 rounded-lg ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-48" />
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  linkTo,
  linkLabel,
  children,
}: {
  title: string
  linkTo?: string
  linkLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="kk-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-fg tracking-tight">{title}</h2>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-accent hover:text-accent-dim transition-colors">
            {linkLabel ?? 'View all →'}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Hero stat card ───────────────────────────────────────────────────────────

const INR_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}

function StatCard({
  label,
  amount,
  format,
  sub,
}: {
  label: string
  amount: number
  format?: Intl.NumberFormatOptions
  sub?: string
}) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => { setDisplayed(amount) }, [amount])

  return (
    <div className="kk-card">
      <p className="kk-label">{label}</p>
      <NumberFlow
        value={displayed}
        format={format}
        className="text-2xl font-bold text-fg mt-2 kk-mono block"
      />
      {sub && <p className="text-xs text-fg-faint mt-1">{sub}</p>}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, isLoading, isError } = useGetDashboard()

  if (isLoading) return <DashboardSkeleton />
  if (isError || !data) {
    return (
      <div className="p-6 text-center text-negative-dim">Failed to load dashboard. Please refresh.</div>
    )
  }

  const spent = parseFloat(data.total_spent_net)
  const income = parseFloat(data.total_income)
  const net = income - spent
  const monthLabel = (() => {
    const [y, m] = data.month.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
  })()

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-fg tracking-tight">Dashboard</h1>
        <p className="text-sm text-fg-muted mt-0.5">{monthLabel}</p>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Spent" amount={spent} format={INR_FORMAT} sub="this month" />
        <StatCard label="Income" amount={income} format={INR_FORMAT} sub="this month" />
        <StatCard label="Net" amount={net} format={INR_FORMAT} sub={net >= 0 ? 'surplus' : 'deficit'} />
        <StatCard label="Accounts" amount={data.account_balances.length} sub="active" />
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Budgets */}
        <Section title="Budgets" linkTo="/budgets">
          {data.budgets_summary.length === 0 ? (
            <p className="text-sm text-fg-muted">No active budgets.</p>
          ) : (
            <div className="space-y-4">
              {data.budgets_summary.map((b) => (
                <BudgetProgressCard key={b.id} budget={b} />
              ))}
            </div>
          )}
        </Section>

        {/* Category breakdown */}
        <Section title="Spending by Category">
          <CategoryBreakdownChart items={data.category_breakdown} />
        </Section>
      </div>

      {/* Subscriptions */}
      <Section title="Subscriptions" linkTo="/subscriptions">
        {data.active_subscriptions.length === 0 ? (
          <p className="text-sm text-fg-muted">No active subscriptions.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.active_subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    to={`/subscriptions/${s.id}` as any}
                    className="text-sm font-medium text-fg-dim hover:text-accent transition-colors"
                  >
                    {s.name}
                  </Link>
                  <p className="text-xs text-fg-faint">
                    {s.next_billing_date ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-fg kk-mono">
                    ₹{parseFloat(s.amount).toLocaleString('en-IN')}
                  </span>
                  <SubscriptionStatusBadge subscription={s} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* 2-column grid: Piggy banks + Pending splits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Piggy banks */}
        <Section title="Savings Goals" linkTo="/piggy-banks">
          {data.piggy_banks_summary.length === 0 ? (
            <p className="text-sm text-fg-muted">No savings goals yet.</p>
          ) : (
            <div className="space-y-4">
              {data.piggy_banks_summary.map((p) => (
                <Link key={p.id} to={`/piggy-banks/${p.id}` as any} className="block hover:opacity-80 transition-opacity">
                  <PiggyBankProgressRing piggyBank={p} />
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Pending splits */}
        <Section title="Pending Splits">
          {data.pending_splits_summary.count === 0 ? (
            <p className="text-sm text-fg-muted">No pending splits.</p>
          ) : (
            <div>
              <p className="text-sm text-fg-dim mb-3">
                <span className="font-semibold text-fg">{data.pending_splits_summary.count}</span> pending &mdash;
                {' '}₹{parseFloat(data.pending_splits_summary.total_owed).toLocaleString('en-IN')} owed total
              </p>
              <div className="space-y-2">
                {data.pending_splits_summary.by_payee.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-fg-dim">{p.payee_name ?? 'Unknown'}</span>
                    <span className="font-medium text-fg kk-mono">
                      ₹{parseFloat(p.total).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Account balances */}
      <Section title="Account Balances" linkTo="/accounts">
        {data.account_balances.length === 0 ? (
          <p className="text-sm text-fg-muted">No accounts yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.account_balances.map((a) => {
              const bal = parseFloat(a.current_balance)
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-surface-2 border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-fg">{a.name}</p>
                    <p className="text-xs text-fg-faint capitalize">{a.type.replace('_', ' ')}</p>
                  </div>
                  <span className={`text-sm font-semibold kk-mono ${bal < 0 ? 'text-negative-dim' : 'text-fg'}`}>
                    {a.currency} {bal.toLocaleString('en-IN')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Recent transactions */}
      <Section title="Recent Transactions" linkTo="/transactions">
        {data.recent_transactions.length === 0 ? (
          <p className="text-sm text-fg-muted">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.recent_transactions.map((t) => {
              const date = new Date(t.transacted_at).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short',
              })
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {t.description ?? t.type}
                    </p>
                    <p className="text-xs text-fg-faint">{date}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold shrink-0 ml-4 kk-mono ${
                      t.type === 'income'
                        ? 'text-positive-dim'
                        : t.type === 'transfer'
                          ? 'text-accent'
                          : 'text-fg-dim'
                    }`}
                  >
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '↔'}
                    ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
