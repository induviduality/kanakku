import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { useTriggerExport, useGetExportJob, useImportArchive } from './portability'

const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('../lib/api-client', () => ({
  apiGet: (...args: any[]) => mockGet(...args),
  apiPost: (...args: any[]) => mockPost(...args)
}))

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('portability API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useTriggerExport triggers export', async () => {
    mockPost.mockResolvedValue({ id: 'job-1' })
    const { result } = renderHook(() => useTriggerExport(), { wrapper: createWrapper() })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/export', {})
  })

  it('useGetExportJob fetches job', async () => {
    mockGet.mockResolvedValue({ id: 'job-1', status: 'done' })
    const { result } = renderHook(() => useGetExportJob('job-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/export/job-1')
  })

  it('useImportArchive imports file successfully', async () => {
    server.use(
      http.post('/api/v1/import-archive', () => {
        return HttpResponse.json({ imported_tables: {}, total_records: 10 })
      })
    )
    const { result } = renderHook(() => useImportArchive(), { wrapper: createWrapper() })
    const file = new File([''], 'test.zip')
    result.current.mutate(file)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useImportArchive handles error', async () => {
    server.use(
      http.post('/api/v1/import-archive', () => {
        return HttpResponse.json({ detail: 'Invalid file' }, { status: 400 })
      })
    )
    const { result } = renderHook(() => useImportArchive(), { wrapper: createWrapper() })
    const file = new File([''], 'test.zip')
    result.current.mutate(file)
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Invalid file')
  })
})
