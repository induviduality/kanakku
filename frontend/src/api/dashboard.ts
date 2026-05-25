import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api-client'

export type DashboardPeriod = 'month' | 'quarter' | 'year' | 'custom'

export interface BudgetSummaryItem {
  id: string
  name: string
  amount: string
  currency: string
  spent: string
  percentage: number
  status: 'on_track' | 'warning' | 'over_budget'
}

export interface CategoryBreakdownItem {
  category_id: string
  name: string
  amount: string
  percentage: number
}

export interface PendingByPayee {
  payee_id: string | null
  payee_name: string | null
  total: string
}

export interface PendingSplitsSummary {
  count: number
  total_owed: string
  by_payee: PendingByPayee[]
}

export interface PiggyBankSummaryItem {
  id: string
  name: string
  target_amount: string
  current_amount: string
  currency: string
  progress_pct: number
  is_completed: boolean
}

export interface AccountBalanceItem {
  id: string
  name: string
  type: string
  currency: string
  current_balance: string
}

export interface ActiveSubscriptionItem {
  id: string
  name: string
  amount: string
  currency: string
  status: 'upcoming' | 'due_soon' | 'overdue'
  next_billing_date: string | null
}

export interface RecentTransaction {
  id: string
  type: 'expense' | 'income' | 'transfer' | 'opening_balance'
  transacted_at: string
  amount: string
  currency: string
  description: string | null
  account_id: string
  payee_id: string | null
  category_ids: string[]
}

export interface CashFlowBucket {
  date: string   // "YYYY-MM-DD" — start of the bucket
  income: string
  expense: string
}

export interface DashboardData {
  // legacy
  month: string
  total_spent_net: string
  total_income: string
  // period-aware
  period: DashboardPeriod
  period_start: string
  period_end: string
  total_balance: string
  inflow: string
  outflow: string
  savings_rate: number | null
  prev_inflow: string
  prev_outflow: string
  prev_savings_rate: number | null
  // collections
  budgets_summary: BudgetSummaryItem[]
  category_breakdown: CategoryBreakdownItem[]
  recent_transactions: RecentTransaction[]
  pending_splits_summary: PendingSplitsSummary
  piggy_banks_summary: PiggyBankSummaryItem[]
  account_balances: AccountBalanceItem[]
  active_subscriptions: ActiveSubscriptionItem[]
  cashflow_buckets: CashFlowBucket[]
}

export interface DashboardParams {
  period?: DashboardPeriod
  start_date?: string
  end_date?: string
}

export function useGetDashboard(params: DashboardParams = {}) {
  const { period = 'month', start_date, end_date } = params
  const qs = new URLSearchParams({ period })
  if (start_date) qs.set('start_date', start_date)
  if (end_date) qs.set('end_date', end_date)

  return useQuery<DashboardData>({
    queryKey: ['dashboard', period, start_date, end_date],
    queryFn: () => apiGet<DashboardData>(`/dashboard/home?${qs}`),
    placeholderData: keepPreviousData,
  })
}
