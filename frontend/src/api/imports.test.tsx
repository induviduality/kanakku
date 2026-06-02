import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as apiClient from '../lib/api-client'
import {
  useGetImportBatches,
  useGetImportBatch,
  useGetImportRecords,
  useUploadPdf,
  usePatchRecord,
  useConfirmRecords,
  useRejectRecords,
  useReplaceExisting
} from './imports'

// Mock the API client
vi.mock('../lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}))

vi.mock('../lib/auth-storage', () => ({
  getAccessToken: vi.fn(() => 'test-token')
}))

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

describe('imports API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock global fetch for useUploadPdf
    global.fetch = vi.fn()
  })

  it('useGetImportBatches calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce([{ id: 'b1' }])
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetImportBatches(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 'b1' }])
    expect(apiClient.apiGet).toHaveBeenCalledWith('/imports')
  })

  it('useGetImportBatch calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce({ id: 'b1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetImportBatch('b1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/imports/b1')
  })

  it('useGetImportRecords calls apiGet with and without status', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValue([])
    const qc = createQueryClient()
    
    const { result, rerender } = renderHook(
      ({ status }) => useGetImportRecords('b1', status as any), 
      {
        initialProps: { status: undefined },
        wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      }
    )
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/imports/b1/records')

    rerender({ status: 'pending' })
    await waitFor(() => expect(apiClient.apiGet).toHaveBeenCalledWith('/imports/b1/records?status=pending'))
  })

  it('useUploadPdf uploads file using fetch', async () => {
    const qc = createQueryClient()
    const { result } = renderHook(() => useUploadPdf(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    const mockResponse = { ok: true, json: () => Promise.resolve({ id: 'new-batch' }) }
    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    result.current.mutate({ file, password: 'pass', accountId: 'a1' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    expect(global.fetch).toHaveBeenCalled()
    const fetchArgs = vi.mocked(global.fetch).mock.calls[0]
    expect(fetchArgs[0]).toContain('/api/v1/imports/pdf')
    expect(fetchArgs[0]).toContain('password=pass')
    expect(fetchArgs[0]).toContain('account_id=a1')
    
    const opts: any = fetchArgs[1]
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer test-token')
    expect(opts.body).toBeInstanceOf(FormData)
  })

  it('useUploadPdf handles error', async () => {
    const qc = createQueryClient()
    const { result } = renderHook(() => useUploadPdf(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    const mockResponse = { ok: false, status: 400 }
    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any)

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
    result.current.mutate({ file })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('usePatchRecord calls apiPatch', async () => {
    vi.mocked(apiClient.apiPatch).mockResolvedValueOnce({ id: 'r1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => usePatchRecord('b1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    result.current.mutate({ recordId: 'r1', patch: { status: 'confirmed' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    expect(apiClient.apiPatch).toHaveBeenCalledWith('/imports/b1/records/r1', { status: 'confirmed' })
  })

  it('useConfirmRecords calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({ id: 'b1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useConfirmRecords('b1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    result.current.mutate({ record_ids: ['r1'] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    expect(apiClient.apiPost).toHaveBeenCalledWith('/imports/b1/confirm', { record_ids: ['r1'] })
  })

  it('useRejectRecords calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({ id: 'b1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useRejectRecords('b1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    result.current.mutate({ record_ids: ['r2'] })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    expect(apiClient.apiPost).toHaveBeenCalledWith('/imports/b1/reject', { record_ids: ['r2'] })
  })

  it('useReplaceExisting calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({ id: 'b1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useReplaceExisting('b1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    result.current.mutate({ recordId: 'r1', body: { transaction_ids: ['t1'] } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    expect(apiClient.apiPost).toHaveBeenCalledWith('/imports/b1/records/r1/replace', { transaction_ids: ['t1'] })
  })
})
