import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../lib/api-client'

export type SplitShareStatus = 'pending' | 'settled' | 'forgiven'

export interface SplitShare {
  id: string
  split_id: string
  payee_id: string | null
  amount: string
  status: SplitShareStatus
  settled_at: string | null
  settlement_transaction_id: string | null
  forgiven_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Split {
  id: string
  user_id: string
  expense_transaction_id: string
  notes: string | null
  shares: SplitShare[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SplitShareCreate {
  payee_id?: string
  amount: string
  notes?: string
}

export interface SplitCreate {
  expense_transaction_id: string
  notes?: string
  shares: SplitShareCreate[]
}

export interface ForgivenShareCreate {
  payee_id?: string
  amount: string
  notes?: string
}

export interface BundleCreate {
  expense_transaction_id: string
  income_transaction_ids?: string[]
  forgiven_shares?: ForgivenShareCreate[]
  notes?: string
}

export interface SettleRequest {
  settlement_transaction_id: string
}

export function useListSplits() {
  return useQuery({
    queryKey: ['splits'],
    queryFn: () => apiGet<Split[]>('/splits'),
  })
}

export function useGetSplit(splitId: string | null) {
  return useQuery({
    queryKey: ['splits', splitId],
    queryFn: () => apiGet<Split>(`/splits/${splitId}`),
    enabled: !!splitId,
  })
}

export function useCreateSplit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SplitCreate) => apiPost<Split>('/splits', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['splits'] })
    },
  })
}

export function useBundleSplit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BundleCreate) => apiPost<Split>('/splits/bundle', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['splits'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
    },
  })
}

export function useSettleShare(splitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId, body }: { shareId: string; body: SettleRequest }) =>
      apiPost<SplitShare>(`/splits/${splitId}/shares/${shareId}/settle`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['splits', splitId] })
    },
  })
}

export function useForgiveShare(splitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) =>
      apiPost<SplitShare>(`/splits/${splitId}/shares/${shareId}/forgive`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['splits', splitId] })
    },
  })
}

export function useUnsettleShare(splitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) =>
      apiPost<SplitShare>(`/splits/${splitId}/shares/${shareId}/unsettle`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['splits', splitId] })
    },
  })
}
