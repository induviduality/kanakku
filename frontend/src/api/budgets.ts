import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export type BudgetType = 'recurring' | 'adhoc'
export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type EditScope = 'current_and_future' | 'future_only'
export type DeleteScope = 'instance' | 'current_and_future' | 'future_only'

export interface Budget {
  id: string
  user_id: string
  name: string
  amount: string
  currency: string
  period: BudgetPeriod | null
  start_date: string | null
  end_date: string | null
  type: BudgetType
  recurrence_rule: string | null
  parent_budget_id: string | null
  is_modified_instance: boolean
  is_active: boolean
  notes: string | null
  category_ids: string[]
  current_spent: string
  activated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface BudgetCreate {
  name: string
  amount: string
  currency: string
  period?: BudgetPeriod
  start_date?: string
  end_date?: string
  type: BudgetType
  recurrence_rule?: string
  is_active?: boolean
  notes?: string
}

export interface BudgetPatch {
  name?: string
  amount?: string
  currency?: string
  period?: BudgetPeriod
  start_date?: string
  end_date?: string
  recurrence_rule?: string
  is_active?: boolean
  notes?: string
  category_ids?: string[]
}

export interface BudgetTransactionItem {
  id: string
  type: string
  transacted_at: string
  amount: string
  currency: string
  description: string | null
  account_id: string
  payee_id: string | null
  category_ids: string[]
  link_type: 'explicit' | 'category_match'
}

export interface BudgetTransactionsResponse {
  items: BudgetTransactionItem[]
  total_spent: string
}

export function useGetBudgets(
  includeInactive = false,
  fromDate?: string,
  toDate?: string,
) {
  return useQuery({
    queryKey: ['budgets', { includeInactive, fromDate, toDate }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (includeInactive) params.set('include_inactive', 'true')
      if (fromDate) params.set('from_date', fromDate)
      if (toDate) params.set('to_date', toDate)
      const qs = params.toString() ? `?${params.toString()}` : ''
      return apiGet<Budget[]>(`/budgets${qs}`)
    },
  })
}

export function useGetBudget(budgetId: string | null) {
  return useQuery({
    queryKey: ['budgets', budgetId],
    queryFn: () => apiGet<Budget>(`/budgets/${budgetId}`),
    enabled: !!budgetId,
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BudgetCreate) => apiPost<Budget>('/budgets', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function usePatchBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
      scope,
    }: {
      id: string
      patch: BudgetPatch
      scope?: EditScope
    }) => {
      const url = scope ? `/budgets/${id}?scope=${scope}` : `/budgets/${id}`
      return apiPatch<Budget>(url, patch)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: DeleteScope }) => {
      const url = scope ? `/budgets/${id}?scope=${scope}` : `/budgets/${id}`
      return apiDelete(url)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function useGetBudgetTransactions(
  budgetId: string | null,
  from?: string,
  to?: string,
) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString() ? `?${params.toString()}` : ''

  return useQuery({
    queryKey: ['budgets', budgetId, 'transactions', { from, to }],
    queryFn: () =>
      apiGet<BudgetTransactionsResponse>(`/budgets/${budgetId}/transactions${qs}`),
    enabled: !!budgetId,
  })
}
