import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '../lib/auth-storage'
import { apiGet, apiPatch, apiPost } from '../lib/api-client'

export type ImportSource = 'pdf' | 'gpay_takeout' | 'manual'
export type ImportBatchStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type VerificationStatus = 'verified' | 'discrepancy' | 'indeterminate'
export type RecordStatus = 'pending' | 'confirmed' | 'rejected' | 'duplicate'
export type RecordConfidence = 'high' | 'medium' | 'low'
export type RecordMatchType = 'new' | 'duplicate' | 'low_confidence'

export interface ImportBatch {
  id: string
  user_id: string
  source: ImportSource
  filename: string
  account_id: string | null
  status: ImportBatchStatus
  verification_status: VerificationStatus | null
  total_parsed: number
  total_confirmed: number
  total_rejected: number
  imported_at: string
  completed_at: string | null
}

export interface RawImportRecord {
  id: string
  batch_id: string
  raw_text: string | null
  parsed_json: Record<string, unknown> | null
  status: RecordStatus
  transaction_id: string | null
  confidence: RecordConfidence | null
  match_type: RecordMatchType | null
  created_at: string
}

export interface ConfirmRequest {
  record_ids?: string[]
  force?: boolean
}

export interface RejectRequest {
  record_ids?: string[]
}

export interface RecordPatch {
  parsed_json?: Record<string, unknown>
  status?: RecordStatus
}

// ── Query hooks ───────────────────────────────────────────────────────────────

export function useGetImportBatches() {
  return useQuery({
    queryKey: ['imports'],
    queryFn: () => apiGet<ImportBatch[]>('/imports'),
  })
}

export function useGetImportBatch(batchId: string) {
  return useQuery({
    queryKey: ['imports', batchId],
    queryFn: () => apiGet<ImportBatch>(`/imports/${batchId}`),
    enabled: !!batchId,
  })
}

export function useGetImportRecords(batchId: string, status?: RecordStatus) {
  return useQuery({
    queryKey: ['imports', batchId, 'records', status],
    queryFn: () => {
      const qs = status ? `?status=${status}` : ''
      return apiGet<RawImportRecord[]>(`/imports/${batchId}/records${qs}`)
    },
    enabled: !!batchId,
  })
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

export function useUploadPdf() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      file,
      password,
      accountId,
    }: {
      file: File
      password?: string
      accountId?: string
    }) => {
      const form = new FormData()
      form.append('file', file)
      const params = new URLSearchParams()
      if (password) params.set('password', password)
      if (accountId) params.set('account_id', accountId)
      const qs = params.toString() ? `?${params.toString()}` : ''
      return fetch(`/api/v1/imports/pdf${qs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        body: form,
      }).then((r) => {
        if (!r.ok) throw r
        return r.json() as Promise<ImportBatch>
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports'] }),
  })
}

export function usePatchRecord(batchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, patch }: { recordId: string; patch: RecordPatch }) =>
      apiPatch<RawImportRecord>(`/imports/${batchId}/records/${recordId}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports', batchId] }),
  })
}

export function useConfirmRecords(batchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ConfirmRequest) =>
      apiPost<ImportBatch>(`/imports/${batchId}/confirm`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports', batchId] }),
  })
}

export function useRejectRecords(batchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RejectRequest) =>
      apiPost<ImportBatch>(`/imports/${batchId}/reject`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports', batchId] }),
  })
}
