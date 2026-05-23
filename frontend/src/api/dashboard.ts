import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../lib/api-client'

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
  type: 'expense' | 'income' | 'transfer'
  transacted_at: string
  amount: string
  currency: string
  description: string | null
  account_id: string
  payee_id: string | null
  category_ids: string[]
}

export interface DashboardData {
  month: string
  total_spent_net: string
  total_income: string
  budgets_summary: BudgetSummaryItem[]
  category_breakdown: CategoryBreakdownItem[]
  recent_transactions: RecentTransaction[]
  pending_splits_summary: PendingSplitsSummary
  piggy_banks_summary: PiggyBankSummaryItem[]
  account_balances: AccountBalanceItem[]
  active_subscriptions: ActiveSubscriptionItem[]
}

export function useGetDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<DashboardData>('/dashboard/home'),
  })
}
