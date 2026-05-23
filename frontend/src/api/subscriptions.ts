import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export type BillingCycle = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type SubscriptionStatus = 'upcoming' | 'due_soon' | 'overdue'

export interface Subscription {
  id: string
  user_id: string
  name: string
  amount: string
  currency: string
  billing_cycle: BillingCycle
  billing_day: number
  last_billed_at: string | null
  account_id: string
  payment_method_id: string | null
  category_id: string | null
  is_active: boolean
  url: string | null
  notes: string | null
  next_billing_date: string | null
  status: SubscriptionStatus | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SubscriptionCreate {
  name: string
  amount: string
  currency: string
  billing_cycle: BillingCycle
  billing_day: number
  account_id: string
  payment_method_id?: string
  category_id?: string
  last_billed_at?: string
  is_active?: boolean
  url?: string
  notes?: string
}

export interface SubscriptionPatch {
  name?: string
  amount?: string
  currency?: string
  billing_cycle?: BillingCycle
  billing_day?: number
  account_id?: string
  payment_method_id?: string
  category_id?: string
  last_billed_at?: string
  is_active?: boolean
  url?: string
  notes?: string
}

export function useGetSubscriptions(includeInactive = false) {
  return useQuery({
    queryKey: ['subscriptions', { includeInactive }],
    queryFn: () =>
      apiGet<Subscription[]>(
        `/subscriptions${includeInactive ? '?include_inactive=true' : ''}`,
      ),
  })
}

export function useGetSubscription(subId: string | null) {
  return useQuery({
    queryKey: ['subscriptions', subId],
    queryFn: () => apiGet<Subscription>(`/subscriptions/${subId}`),
    enabled: !!subId,
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SubscriptionCreate) =>
      apiPost<Subscription>('/subscriptions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

export function usePatchSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SubscriptionPatch }) =>
      apiPatch<Subscription>(`/subscriptions/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

export function useLinkTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ subId, transactionId }: { subId: string; transactionId: string }) =>
      apiPost(`/subscriptions/${subId}/link-transaction`, {
        transaction_id: transactionId,
      }),
    onSuccess: (_data, { subId }) => {
      qc.invalidateQueries({ queryKey: ['subscriptions', subId, 'history'] })
    },
  })
}

export function useGetSubscriptionHistory(subId: string | null) {
  return useQuery({
    queryKey: ['subscriptions', subId, 'history'],
    queryFn: () => apiGet<object[]>(`/subscriptions/${subId}/history`),
    enabled: !!subId,
  })
}
