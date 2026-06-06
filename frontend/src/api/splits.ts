import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost } from '../lib/api-client'

export type SplitShareStatus = 'pending' | 'settled' | 'forgiven'

export interface SplitShareSettlement {
  id: string
  share_id: string
  transaction_id: string
  amount: string
  created_at: string
}

export interface SplitShare {
  id: string
  split_id: string
  payee_id: string | null
  amount: string
  status: SplitShareStatus
  forgiven_amount: string
  paid_amount: string
  settlements: SplitShareSettlement[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Split {
  id: string
  user_id: string
  expense_transaction_ids: string[]
  notes: string | null
  shares: SplitShare[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ForgivenShareCreate {
  payee_id?: string
  amount: string
  notes?: string
}

export interface BundleCreate {
  expense_transaction_ids: string[]
  income_transaction_ids?: string[]
  forgiven_shares?: ForgivenShareCreate[]
  notes?: string
}

/** Link an income transaction to a share. amount defaults to the full transaction amount. */
export interface SettleRequest {
  transaction_id: string
  amount?: string
}

/** SET the forgiven_amount for a share (replaces prior value). */
export interface ForgiveRequest {
  amount: string
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

// Every split mutation can change the is_split flag and Linked Split section
// on the underlying transaction. Invalidate transaction queries too so the
// UI doesn't show stale badges after a split is created/settled/forgiven.
function invalidateSplitsAndTransactions(qc: ReturnType<typeof useQueryClient>, splitId?: string) {
  qc.invalidateQueries({ queryKey: ['splits'] })
  if (splitId) qc.invalidateQueries({ queryKey: ['splits', splitId] })
  qc.invalidateQueries({ queryKey: ['transactions'] })
  qc.invalidateQueries({ queryKey: ['transactions-infinite'] })
}

export function useBundleSplit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: BundleCreate) => apiPost<Split>('/splits/bundle', body),
    onSuccess: () => invalidateSplitsAndTransactions(qc),
  })
}

export function useSettleShare(splitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId, body }: { shareId: string; body: SettleRequest }) =>
      apiPost<SplitShare>(`/splits/${splitId}/shares/${shareId}/settle`, body),
    onSuccess: () => invalidateSplitsAndTransactions(qc, splitId),
  })
}

export function useUnlinkSettlement(splitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId, settlementId }: { shareId: string; settlementId: string }) =>
      apiDelete<SplitShare>(`/splits/${splitId}/shares/${shareId}/settlements/${settlementId}`),
    onSuccess: () => invalidateSplitsAndTransactions(qc, splitId),
  })
}

export function useForgiveShare(splitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ shareId, amount }: { shareId: string; amount: string }) =>
      apiPost<SplitShare>(`/splits/${splitId}/shares/${shareId}/forgive`, { amount }),
    onSuccess: () => invalidateSplitsAndTransactions(qc, splitId),
  })
}

export function useUnsettleShare(splitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) =>
      apiPost<SplitShare>(`/splits/${splitId}/shares/${shareId}/unsettle`, {}),
    onSuccess: () => invalidateSplitsAndTransactions(qc, splitId),
  })
}
