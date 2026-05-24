import { Link } from '@tanstack/react-router'
import { useGetDashboard } from '../api/dashboard'
import BudgetProgressCard from '../components/dashboard/BudgetProgressCard'
import CategoryBreakdownChart from '../components/dashboard/CategoryBreakdownChart'
import PiggyBankProgressRing from '../components/dashboard/PiggyBankProgressRing'
import SubscriptionStatusBadge from '../components/dashboard/SubscriptionStatusBadge'

// ── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-indigo-600 hover:underline">
            {linkLabel ?? 'View all →'}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

// ── Hero stat card ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, isLoading, isError } = useGetDashboard()

  if (isLoading) return <DashboardSkeleton />
  if (isError || !data) {
    return (
      <div className="p-6 text-center text-red-600">Failed to load dashboard. Please refresh.</div>
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">{monthLabel}</p>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Spent"
          value={`₹${spent.toLocaleString('en-IN')}`}
          sub="this month"
        />
        <StatCard
          label="Income"
          value={`₹${income.toLocaleString('en-IN')}`}
          sub="this month"
        />
        <StatCard
          label="Net"
          value={`₹${net.toLocaleString('en-IN')}`}
          sub={net >= 0 ? 'surplus' : 'deficit'}
        />
        <StatCard
          label="Accounts"
          value={`${data.account_balances.length}`}
          sub="active"
        />
      </div>

      {/* 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Budgets */}
        <Section title="Budgets" linkTo="/budgets">
          {data.budgets_summary.length === 0 ? (
            <p className="text-sm text-gray-400">No active budgets.</p>
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
          <p className="text-sm text-gray-400">No active subscriptions.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.active_subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    to={`/subscriptions/${s.id}` as any}
                    className="text-sm font-medium text-gray-800 hover:text-indigo-600"
                  >
                    {s.name}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {s.next_billing_date ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-gray-700">
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
            <p className="text-sm text-gray-400">No savings goals yet.</p>
          ) : (
            <div className="space-y-4">
              {data.piggy_banks_summary.map((p) => (
                <Link key={p.id} to={`/piggy-banks/${p.id}` as any} className="block hover:opacity-80">
                  <PiggyBankProgressRing piggyBank={p} />
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Pending splits */}
        <Section title="Pending Splits">
          {data.pending_splits_summary.count === 0 ? (
            <p className="text-sm text-gray-400">No pending splits.</p>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-semibold text-gray-900">{data.pending_splits_summary.count}</span> pending &mdash;
                {' '}₹{parseFloat(data.pending_splits_summary.total_owed).toLocaleString('en-IN')} owed total
              </p>
              <div className="space-y-2">
                {data.pending_splits_summary.by_payee.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{p.payee_name ?? 'Unknown'}</span>
                    <span className="font-medium text-gray-900">
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
          <p className="text-sm text-gray-400">No accounts yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.account_balances.map((a) => {
              const bal = parseFloat(a.current_balance)
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{a.type.replace('_', ' ')}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${bal < 0 ? 'text-red-600' : 'text-gray-900'}`}
                  >
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
          <p className="text-sm text-gray-400">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.recent_transactions.map((t) => {
              const date = new Date(t.transacted_at).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short',
              })
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {t.description ?? t.type}
                    </p>
                    <p className="text-xs text-gray-400">{date}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold shrink-0 ml-4 ${
                      t.type === 'income'
                        ? 'text-green-600'
                        : t.type === 'transfer'
                          ? 'text-blue-600'
                          : 'text-gray-900'
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
