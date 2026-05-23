import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../lib/api-client'

export interface DeletedItem {
  id: string
  entity_type: string
  label: string
  deleted_at: string
}

export interface RecentlyDeletedResponse {
  items: DeletedItem[]
}

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  accounts: 'Accounts',
  payees: 'Payees',
  categories: 'Categories',
  tags: 'Tags',
  transactions: 'Transactions',
  budgets: 'Budgets',
  subscriptions: 'Subscriptions',
  piggy_banks: 'Piggy Banks',
}

const RESTORE_PATHS: Record<string, string> = {
  accounts: 'accounts',
  payees: 'payees',
  categories: 'categories',
  tags: 'tags',
  transactions: 'transactions',
  budgets: 'budgets',
  subscriptions: 'subscriptions',
  piggy_banks: 'piggy-banks',
}

export function useRecentlyDeleted() {
  return useQuery({
    queryKey: ['recently-deleted'],
    queryFn: () => apiGet<RecentlyDeletedResponse>('/recently-deleted'),
  })
}

export function useRestoreItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entityType, id }: { entityType: string; id: string }) => {
      const path = RESTORE_PATHS[entityType] ?? entityType
      return apiPost<unknown>(`/${path}/${id}/restore`, {})
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recently-deleted'] })
    },
  })
}
