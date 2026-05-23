import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export type TransactionType = 'expense' | 'income' | 'transfer'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  transacted_at: string
  amount: string
  currency: string
  description: string | null
  notes: string | null
  account_id: string
  payment_method_id: string | null
  payee_id: string | null
  to_account_id: string | null
  to_amount: string | null
  to_currency: string | null
  subscription_id: string | null
  import_record_id: string | null
  category_ids: string[]
  tag_ids: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TransactionListResponse {
  items: Transaction[]
  next_cursor: string | null
}

export interface TransactionCreate {
  type: TransactionType
  transacted_at: string
  amount: string
  currency?: string
  description?: string
  notes?: string
  account_id: string
  payment_method_id?: string
  payee_id?: string
  to_account_id?: string
  to_amount?: string
  to_currency?: string
  category_ids?: string[]
  tag_ids?: string[]
  budget_ids?: string[]
}

export interface TransactionPatch {
  type?: TransactionType
  transacted_at?: string
  amount?: string
  currency?: string
  description?: string
  notes?: string
  account_id?: string
  payment_method_id?: string | null
  payee_id?: string | null
  to_account_id?: string | null
  to_amount?: string | null
  to_currency?: string | null
  category_ids?: string[]
  tag_ids?: string[]
  budget_ids?: string[]
}

export interface TransactionFilters {
  type?: TransactionType
  account_id?: string
  payee_id?: string
  category_id?: string
  tag_id?: string
  from?: string
  to?: string
}

function buildParams(filters: TransactionFilters, limit = 50, cursor?: string): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.type) p.set('type', filters.type)
  if (filters.account_id) p.set('account_id', filters.account_id)
  if (filters.payee_id) p.set('payee_id', filters.payee_id)
  if (filters.category_id) p.set('category_id', filters.category_id)
  if (filters.tag_id) p.set('tag_id', filters.tag_id)
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  p.set('limit', String(limit))
  if (cursor) p.set('cursor', cursor)
  return p
}

export function useTransactions(filters: TransactionFilters = {}, limit = 50) {
  return useQuery({
    queryKey: ['transactions', filters, limit],
    queryFn: () =>
      apiGet<TransactionListResponse>(`/transactions?${buildParams(filters, limit)}`),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
