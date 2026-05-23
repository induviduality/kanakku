import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TagCreate {
  name: string
  color?: string
}

export interface TagPatch {
  name?: string
  color?: string
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => apiGet<Tag[]>('/tags'),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TagCreate) => apiPost<Tag>('/tags', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function usePatchTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TagPatch }) =>
      apiPatch<Tag>(`/tags/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/tags/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}
