import NumberFlow from '@number-flow/react'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { type DashboardPeriod, useGetDashboard } from '../api/dashboard'
import BudgetProgressCard from '../components/dashboard/BudgetProgressCard'
import PiggyBankProgressRing from '../components/dashboard/PiggyBankProgressRing'

// ── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 rounded-lg ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-64" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
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

// ── Period selector ──────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  month: 'This month',
  quarter: 'This quarter',
  year: 'This year',
  custom: 'Custom',
}

function PeriodSelector({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomChange,
}: {
  value: DashboardPeriod
  onChange: (p: DashboardPeriod) => void
  customStart: string
  customEnd: string
  onCustomChange: (start: string, end: string) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex rounded-lg border border-border overflow-hidden text-xs">
        {(['month', 'quarter', 'year', 'custom'] as DashboardPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1.5 transition-colors ${
              value === p
                ? 'bg-accent text-white font-medium'
                : 'text-fg-muted hover:text-fg hover:bg-surface-2'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {value === 'custom' && (
        <div className="flex items-center gap-1.5 text-xs">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomChange(e.target.value, customEnd)}
            className="kk-input h-7 text-xs px-2"
          />
          <span className="text-fg-faint">–</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomChange(customStart, e.target.value)}
            className="kk-input h-7 text-xs px-2"
          />
        </div>
      )}
    </div>
  )
}

// ── Hero stat card ───────────────────────────────────────────────────────────

const INR_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}

const PCT_FORMAT: Intl.NumberFormatOptions = {
  style: 'percent',
  maximumFractionDigits: 1,
}

function StatCard({
  label,
  amount,
  format,
  sub,
  masked,
  trend,
}: {
  label: string
  amount: number
  format?: Intl.NumberFormatOptions
  sub?: string
  masked?: boolean
  trend?: { current: number | null; prev: number | null; label: string }
}) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => { setDisplayed(amount) }, [amount])

  const trendDelta =
    trend?.current != null && trend?.prev != null ? trend.current - trend.prev : null

  return (
    <div className="kk-card">
      <p className="kk-label">{label}</p>
      {masked ? (
        <p className="text-2xl font-bold text-fg mt-2 kk-mono tracking-widest select-none">
          ••••••
        </p>
      ) : (
        <NumberFlow
          value={displayed}
          format={format}
          className="text-2xl font-bold text-fg mt-2 kk-mono block"
        />
      )}
      <div className="flex items-center gap-2 mt-1">
        {sub && <p className="text-xs text-fg-faint">{sub}</p>}
        {trendDelta != null && (
          <span
            className={`text-xs font-medium ${
              trendDelta >= 0 ? 'text-positive-dim' : 'text-negative-dim'
            }`}
          >
            {trendDelta >= 0 ? '▲' : '▼'}{' '}
            {Math.abs(trendDelta).toFixed(1)}% vs {trend!.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Balance card with eye toggle ─────────────────────────────────────────────

function BalanceCard({ totalBalance }: { totalBalance: number }) {
  const [hidden, setHidden] = useState(false)
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => { setDisplayed(totalBalance) }, [totalBalance])

  return (
    <div className="kk-card">
      <div className="flex items-center justify-between">
        <p className="kk-label">Total Balance</p>
        <button
          onClick={() => setHidden((h) => !h)}
          className="text-fg-faint hover:text-fg transition-colors"
          aria-label={hidden ? 'Show balance' : 'Hide balance'}
        >
          {hidden ? (
            // eye-off
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.477 10.49A3 3 0 0013.5 13.5M6.228 6.228A10.451 10.451 0 003 12c1.657 3.878 5.523 6.5 9 6.5a10.42 10.42 0 004.592-1.054M9.75 4.562A10.44 10.44 0 0112 4.5c3.477 0 7.343 2.622 9 6.5a10.45 10.45 0 01-1.777 2.82" />
            </svg>
          ) : (
            // eye
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
      {hidden ? (
        <p className="text-2xl font-bold text-fg mt-2 kk-mono tracking-widest select-none">
          ••••••
        </p>
      ) : (
        <NumberFlow
          value={displayed}
          format={INR_FORMAT}
          className="text-2xl font-bold text-fg mt-2 kk-mono block"
        />
      )}
      <p className="text-xs text-fg-faint mt-1">across all accounts</p>
    </div>
  )
}

// ── Period label helper ───────────────────────────────────────────────────────

function prevPeriodLabel(period: DashboardPeriod): string {
  switch (period) {
    case 'month':   return 'last month'
    case 'quarter': return 'last quarter'
    case 'year':    return 'last year'
    default:        return 'prev period'
  }
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const params =
    period === 'custom' && customStart && customEnd
      ? { period, start_date: customStart, end_date: customEnd }
      : period !== 'custom'
        ? { period }
        : undefined

  const { data, isLoading, isError } = useGetDashboard(params)

  if (isLoading) return <DashboardSkeleton />
  if (isError || !data) {
    return (
      <div className="p-6 text-center text-negative-dim">Failed to load dashboard. Please refresh.</div>
    )
  }

  const inflow = parseFloat(data.inflow)
  const outflow = parseFloat(data.outflow)
  const totalBalance = parseFloat(data.total_balance)
  const prevLabel = prevPeriodLabel(data.period as DashboardPeriod)

  const periodSubLabel = (() => {
    if (data.period === 'month') {
      const [y, m] = data.month.split('-')
      return new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
    }
    if (data.period === 'quarter') {
      const q = Math.ceil((new Date(data.period_start).getMonth() + 1) / 3)
      return `Q${q} ${new Date(data.period_start).getFullYear()}`
    }
    if (data.period === 'year') {
      return `${new Date(data.period_start).getFullYear()}`
    }
    return `${data.period_start} – ${data.period_end}`
  })()

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

      {/* Title + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg tracking-tight">Dashboard</h1>
          <p className="text-sm text-fg-muted mt-0.5">{periodSubLabel}</p>
        </div>
        <PeriodSelector
          value={period}
          onChange={setPeriod}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e) }}
        />
      </div>

      {/* Row 1 — summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <BalanceCard totalBalance={totalBalance} />
        <StatCard
          label="Inflow"
          amount={inflow}
          format={INR_FORMAT}
          sub={periodSubLabel}
        />
        <StatCard
          label="Outflow"
          amount={outflow}
          format={INR_FORMAT}
          sub={periodSubLabel}
        />
        <StatCard
          label="Savings Rate"
          amount={(data.savings_rate ?? 0) / 100}
          format={PCT_FORMAT}
          trend={{
            current: data.savings_rate,
            prev: data.prev_savings_rate,
            label: prevLabel,
          }}
        />
      </div>

      {/* Row 2 — recent transactions + budgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <Section title="Recent Transactions" linkTo="/transactions">
          {data.recent_transactions.length === 0 ? (
            <p className="text-sm text-fg-muted">No transactions yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.recent_transactions.map((t) => {
                const dateStr = new Date(t.transacted_at).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short',
                })
                return (
                  <div key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg truncate">
                        {t.description ?? t.type}
                      </p>
                      <p className="text-xs text-fg-faint">{dateStr}</p>
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
      </div>

      {/* Row 3 — piggy banks + pending splits */}
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

    </div>
  )
}
