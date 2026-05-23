import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export type ContributionType = 'transfer' | 'expense'

export interface PiggyBank {
  id: string
  user_id: string
  name: string
  target_amount: string
  currency: string
  current_amount: string
  target_date: string | null
  notes: string | null
  is_completed: boolean
  progress_pct: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PiggyBankCreate {
  name: string
  target_amount: string
  currency: string
  target_date?: string
  notes?: string
}

export interface PiggyBankPatch {
  name?: string
  target_amount?: string
  currency?: string
  target_date?: string
  notes?: string
}

export interface Contribution {
  id: string
  piggy_bank_id: string
  transaction_id: string
  contribution_type: ContributionType
  amount: string
  date: string
  notes: string | null
  created_at: string
}

export interface ContributionCreate {
  transaction_id: string
  contribution_type: ContributionType
  amount: string
  date: string
  notes?: string
}

export function useGetPiggyBanks() {
  return useQuery({
    queryKey: ['piggy-banks'],
    queryFn: () => apiGet<PiggyBank[]>('/piggy-banks'),
  })
}

export function useGetPiggyBank(piggyId: string | null) {
  return useQuery({
    queryKey: ['piggy-banks', piggyId],
    queryFn: () => apiGet<PiggyBank>(`/piggy-banks/${piggyId}`),
    enabled: !!piggyId,
  })
}

export function useCreatePiggyBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PiggyBankCreate) => apiPost<PiggyBank>('/piggy-banks', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function usePatchPiggyBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PiggyBankPatch }) =>
      apiPatch<PiggyBank>(`/piggy-banks/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function useDeletePiggyBank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/piggy-banks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function useGetContributions(piggyId: string | null) {
  return useQuery({
    queryKey: ['piggy-banks', piggyId, 'contributions'],
    queryFn: () => apiGet<Contribution[]>(`/piggy-banks/${piggyId}/contributions`),
    enabled: !!piggyId,
  })
}

export function useAddContribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      piggyId,
      body,
    }: {
      piggyId: string
      body: ContributionCreate
    }) => apiPost<Contribution>(`/piggy-banks/${piggyId}/contributions`, body),
    onSuccess: (_data, { piggyId }) => {
      qc.invalidateQueries({ queryKey: ['piggy-banks', piggyId] })
      qc.invalidateQueries({ queryKey: ['piggy-banks', piggyId, 'contributions'] })
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function useRemoveContribution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      piggyId,
      contribId,
    }: {
      piggyId: string
      contribId: string
    }) => apiDelete(`/piggy-banks/${piggyId}/contributions/${contribId}`),
    onSuccess: (_data, { piggyId }) => {
      qc.invalidateQueries({ queryKey: ['piggy-banks', piggyId] })
      qc.invalidateQueries({ queryKey: ['piggy-banks', piggyId, 'contributions'] })
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}
