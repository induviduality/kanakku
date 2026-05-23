import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../lib/api-client'
import { getAccessToken } from '../lib/auth-storage'

export type GPayMatchStatus = 'pending' | 'resolved' | 'orphan' | 'auto_linked'

export interface GPayMatch {
  id: string
  user_id: string
  gpay_data: Record<string, unknown>
  candidate_transaction_ids: string[]
  chosen_transaction_id: string | null
  llm_suggestion_id: string | null
  status: GPayMatchStatus
  created_at: string
}

export interface GPayUploadResponse {
  parsed: number
  auto_linked: number
  pending: number
  orphans: number
  matches: GPayMatch[]
}

export function useGetGPayMatches() {
  return useQuery({
    queryKey: ['gpay-matches'],
    queryFn: () => apiGet<GPayMatch[]>('/imports/gpay-matches'),
  })
}

export function useGetPendingGPayMatches() {
  return useQuery({
    queryKey: ['gpay-matches', 'pending'],
    queryFn: () => apiGet<GPayMatch[]>('/imports/gpay-matches/pending'),
  })
}

export function useGetOrphanGPayMatches() {
  return useQuery({
    queryKey: ['gpay-matches', 'orphans'],
    queryFn: () => apiGet<GPayMatch[]>('/imports/gpay-matches/orphans'),
  })
}

export function useUploadGPayTakeout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<GPayUploadResponse> => {
      const formData = new FormData()
      formData.append('file', file)
      const token = getAccessToken()
      const resp = await fetch('/api/v1/imports/gpay-takeout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(err.detail ?? 'Upload failed')
      }
      return resp.json() as Promise<GPayUploadResponse>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gpay-matches'] })
    },
  })
}

export function useResolveGPayMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ matchId, chosenTransactionId }: { matchId: string; chosenTransactionId: string }) =>
      apiPost<GPayMatch>(`/imports/gpay-matches/${matchId}/resolve`, {
        chosen_transaction_id: chosenTransactionId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gpay-matches'] })
    },
  })
}
