import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export type TransactionType = 'expense' | 'income' | 'transfer' | 'opening_balance'

export type SpendingClassification =
  | 'routine'
  | 'planned_essential'
  | 'planned_discretionary'
  | 'unplanned_essential'
  | 'unplanned_discretionary'

export const SPENDING_CLASSIFICATION_LABELS: Record<SpendingClassification, string> = {
  routine:                 'Routine',
  planned_essential:       'Planned · Essential',
  planned_discretionary:   'Planned · Discretionary',
  unplanned_essential:     'Unplanned · Essential',
  unplanned_discretionary: 'Unplanned · Discretionary',
}

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  transacted_at: string
  amount: string
  currency: string
  description: string | null
  notes: string | null
  external_ref: string | null
  account_id: string
  payment_method_id: string | null
  payment_method_name: string | null
  payee_id: string | null
  to_account_id: string | null
  to_amount: string | null
  to_currency: string | null
  subscription_id: string | null
  import_record_id: string | null
  split_id: string | null
  is_split: boolean
  spending_classification: SpendingClassification | null
  piggy_bank_id: string | null
  category_ids: string[]
  tag_ids: string[]
  budget_ids: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TransactionListResponse {
  items: Transaction[]
  next_cursor: string | null
  total: number
  total_inflow: string
  total_outflow: string
  opening_balance: string
  closing_balance: string
}

export interface TransactionCreate {
  type: TransactionType
  transacted_at: string
  amount: string
  currency?: string
  description?: string
  notes?: string
  external_ref?: string
  account_id: string
  payment_method_id?: string
  payee_id?: string
  to_account_id?: string
  to_amount?: string
  to_currency?: string
  category_ids?: string[]
  tag_ids?: string[]
  budget_ids?: string[]
  spending_classification?: SpendingClassification | null
  piggy_bank_id?: string | null
}

export interface TransactionPatch {
  type?: TransactionType
  transacted_at?: string
  amount?: string
  currency?: string
  description?: string
  notes?: string
  external_ref?: string | null
  account_id?: string
  payment_method_id?: string | null
  payee_id?: string | null
  to_account_id?: string | null
  to_amount?: string | null
  to_currency?: string | null
  category_ids?: string[]
  tag_ids?: string[]
  budget_ids?: string[]
  spending_classification?: SpendingClassification | null
  piggy_bank_id?: string | null
}

export interface TransactionFilters {
  type?: TransactionType
  account_id?: string   // comma-separated UUIDs
  payee_id?: string     // comma-separated UUIDs
  category_id?: string
  tag_id?: string       // comma-separated UUIDs
  budget_id?: string
  from?: string
  to?: string
  sort_by?: 'transacted_at' | 'amount'
  sort_dir?: 'asc' | 'desc'
  q?: string
}

function buildParams(filters: TransactionFilters, limit = 50, cursor?: string): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.type) p.set('type', filters.type)
  if (filters.account_id) p.set('account_id', filters.account_id)
  if (filters.payee_id) p.set('payee_id', filters.payee_id)
  if (filters.category_id) p.set('category_id', filters.category_id)
  if (filters.tag_id) p.set('tag_id', filters.tag_id)
  if (filters.budget_id) p.set('budget_id', filters.budget_id)
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (filters.sort_by) p.set('sort_by', filters.sort_by)
  if (filters.sort_dir) p.set('sort_dir', filters.sort_dir)
  if (filters.q) p.set('q', filters.q)
  p.set('limit', String(limit))
  if (cursor) p.set('cursor', cursor)
  return p
}

export function useTransactions(
  filters: TransactionFilters = {},
  limit = 50,
  cursor?: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['transactions', filters, limit, cursor],
    queryFn: () =>
      apiGet<TransactionListResponse>(`/transactions?${buildParams(filters, limit, cursor)}`),
    enabled: options?.enabled ?? true,
  })
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => apiGet<Transaction>(`/transactions/${id}`),
    enabled: !!id,
  })
}

export function useInfiniteTransactions(filters: TransactionFilters = {}, limit = 50) {
  return useInfiniteQuery({
    queryKey: ['transactions-infinite', filters, limit],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      apiGet<TransactionListResponse>(
        `/transactions?${buildParams(filters, limit, pageParam)}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: TransactionListResponse) => lastPage.next_cursor ?? undefined,
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TransactionCreate) => apiPost<Transaction>('/transactions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function usePatchTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TransactionPatch }) =>
      apiPatch<Transaction>(`/transactions/${id}`, patch),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      // Single-transaction cache (['transaction', id]) — read by the edit page,
      // TransactionDrawer, and split forms that resolve linked transactions by
      // id. Without this, those kept serving the pre-patch snapshot (stale
      // date/amount) until the 5-minute staleTime lapsed.
      qc.invalidateQueries({ queryKey: ['transaction', id] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/transactions/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['transaction', id] })
    },
  })
}
