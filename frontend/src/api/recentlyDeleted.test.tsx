import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as apiClient from '../lib/api-client'
import { useRecentlyDeleted, useRestoreItem } from './recentlyDeleted'

vi.mock('../lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

describe('recentlyDeleted API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useRecentlyDeleted calls apiGet', async () => {
    const mockResponse = { items: [{ id: 'del-1', entity_type: 'payees', label: 'Rahul', deleted_at: '2026-05-01' }] }
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce(mockResponse)
    const qc = createQueryClient()

    const { result } = renderHook(() => useRecentlyDeleted(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockResponse)
    expect(apiClient.apiGet).toHaveBeenCalledWith('/recently-deleted')
  })

  it('useRestoreItem calls apiPost and invalidates query cache', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({})
    const qc = createQueryClient()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRestoreItem(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    result.current.mutate({ entityType: 'payees', id: 'del-1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.apiPost).toHaveBeenCalledWith('/payees/del-1/restore', {})
    expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['recently-deleted'] }))
  })

  it('useRestoreItem handles fallback path logic', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({})
    const qc = createQueryClient()

    const { result } = renderHook(() => useRestoreItem(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })

    // Test a type that does not exist in RESTORE_PATHS mappings to cover the fallback code path `?? entityType`
    result.current.mutate({ entityType: 'unknown-entity-type', id: 'del-2' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiClient.apiPost).toHaveBeenCalledWith('/unknown-entity-type/del-2/restore', {})
  })
})
