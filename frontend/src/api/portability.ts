import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiGet } from '../lib/api-client'

export type ExportJobStatus = 'pending' | 'running' | 'done' | 'failed'

export interface ExportJob {
  id: string
  status: ExportJobStatus
  created_at: string
  completed_at: string | null
  error: string | null
}

export function useTriggerExport() {
  const qc = useQueryClient()
  return useMutation<ExportJob, Error>({
    mutationFn: () => apiPost('/export', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['export'] }),
  })
}

export function useGetExportJob(jobId: string | null) {
  return useQuery<ExportJob>({
    queryKey: ['export', jobId],
    queryFn: () => apiGet(`/export/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'pending' || status === 'running' ? 2000 : false
    },
  })
}

export function useImportArchive() {
  return useMutation<{ imported_tables: Record<string, number>; total_records: number }, Error, File>({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return fetch('/api/v1/import-archive', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
        body: form,
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({ detail: r.statusText }))
          throw new Error(err.detail ?? 'Import failed')
        }
        return r.json()
      })
    },
  })
}
