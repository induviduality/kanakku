import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string | null
  applicability: 'expense' | 'income' | 'both' | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CategoryCreate {
  name: string
  icon?: string
  color?: string
  applicability?: Category['applicability']
}

export interface CategoryPatch {
  name?: string
  icon?: string
  color?: string
  applicability?: Category['applicability']
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<Category[]>('/categories'),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CategoryCreate) => apiPost<Category>('/categories', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function usePatchCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CategoryPatch }) =>
      apiPatch<Category>(`/categories/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useSeedDefaultCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<Category[]>('/categories/seed-defaults'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}
