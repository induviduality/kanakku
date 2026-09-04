import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export interface Earmark {
  id: string
  user_id: string
  name: string
  amount: string
  currency: string
  account_id: string | null
  account_name: string | null
  piggy_bank_id: string | null
  piggy_bank_name: string | null
  icon: string | null
  color: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface EarmarkCreate {
  name: string
  amount: string
  currency: string
  account_id?: string | null
  piggy_bank_id?: string | null
  icon?: string | null
  color?: string | null
  notes?: string | null
}

export interface EarmarkPatch {
  name?: string
  amount?: string
  currency?: string
  account_id?: string | null
  piggy_bank_id?: string | null
  icon?: string | null
  color?: string | null
  notes?: string | null
  is_active?: boolean
}

export function useGetEarmarks() {
  return useQuery({
    queryKey: ['earmarks'],
    queryFn: () => apiGet<Earmark[]>('/earmarks'),
  })
}

export function useGetEarmark(id: string | null) {
  return useQuery({
    queryKey: ['earmarks', id],
    queryFn: () => apiGet<Earmark>(`/earmarks/${id}`),
    enabled: !!id,
  })
}

export function useCreateEarmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: EarmarkCreate) => apiPost<Earmark>('/earmarks', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['earmarks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function usePatchEarmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EarmarkPatch }) =>
      apiPatch<Earmark>(`/earmarks/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['earmarks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function useToggleEarmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPatch<Earmark>(`/earmarks/${id}/toggle`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['earmarks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function useDeleteEarmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/earmarks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['earmarks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}

export function useRestoreEarmark() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost<Earmark>(`/earmarks/${id}/restore`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['earmarks'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['piggy-banks'] })
    },
  })
}
