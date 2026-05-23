import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export interface Payee {
  id: string
  user_id: string
  name: string
  type: 'merchant' | 'person' | 'business' | 'other'
  notes: string | null
  is_active: boolean
  default_category_ids: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface PayeeCreate {
  name: string
  type: Payee['type']
  notes?: string
  is_active?: boolean
}

export interface PayeePatch {
  name?: string
  type?: Payee['type']
  notes?: string
  is_active?: boolean
}

export function usePayees(search?: string) {
  return useQuery({
    queryKey: ['payees', search],
    queryFn: () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      return apiGet<Payee[]>(`/payees${params}`)
    },
  })
}

export function useCreatePayee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PayeeCreate) => apiPost<Payee>('/payees', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  })
}

export function usePatchPayee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PayeePatch }) =>
      apiPatch<Payee>(`/payees/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  })
}

export function useDeletePayee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/payees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  })
}
