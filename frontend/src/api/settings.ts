import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '../lib/api-client'

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
