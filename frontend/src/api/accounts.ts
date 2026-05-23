import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export interface Account {
  id: string
  user_id: string
  name: string
  type: 'bank' | 'cash' | 'credit_card' | 'loan'
  opening_balance: string
  current_balance: string
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AccountCreate {
  name: string
  type: Account['type']
  opening_balance?: number
  currency?: string
  is_active?: boolean
}

export interface AccountPatch {
  name?: string
  type?: Account['type']
  currency?: string
  is_active?: boolean
}

export interface PaymentMethod {
  id: string
  account_id: string
  name: string
  type: 'debit_card' | 'credit_card' | 'netbanking' | 'upi'
  upi_app: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PaymentMethodCreate {
  name: string
  type: PaymentMethod['type']
  upi_app?: string
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet<Account[]>('/accounts'),
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AccountCreate) => apiPost<Account>('/accounts', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function usePatchAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AccountPatch }) =>
      apiPatch<Account>(`/accounts/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function usePaymentMethods(accountId: string) {
  return useQuery({
    queryKey: ['payment-methods', accountId],
    queryFn: () => apiGet<PaymentMethod[]>(`/accounts/${accountId}/payment-methods`),
    enabled: !!accountId,
  })
}

export function useCreatePaymentMethod(accountId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PaymentMethodCreate) =>
      apiPost<PaymentMethod>(`/accounts/${accountId}/payment-methods`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods', accountId] }),
  })
}

export function useDeletePaymentMethod(accountId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pmId: string) =>
      apiDelete(`/accounts/${accountId}/payment-methods/${pmId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods', accountId] }),
  })
}
