import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '../lib/api-client'

export interface LLMActivityLog {
  id: string
  user_id: string
  operation: string
  payload_summary: Record<string, unknown>
  backend: string
  model: string
  duration_ms: number
  succeeded: boolean
  created_at: string
}

export function useGetLLMActivity(params?: { operation?: string; backend?: string; limit?: number }) {
  const query = new URLSearchParams()
  if (params?.operation) query.set('operation', params.operation)
  if (params?.backend) query.set('backend', params.backend)
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString() ? `?${query.toString()}` : ''
  return useQuery({
    queryKey: ['llm-activity', params],
    queryFn: () => apiGet<LLMActivityLog[]>(`/settings/llm-activity${qs}`),
  })
}

export interface UserSettings {
  primary_currency: string
  timezone: string
  date_format: string
  number_format: string
  updated_at: string
}

export interface SettingsPatch {
  primary_currency?: string
  timezone?: string
  date_format?: string
  number_format?: string
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet<UserSettings>('/settings'),
  })
}

export function usePatchSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => apiPatch<UserSettings>('/settings', patch),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data)
    },
  })
}
