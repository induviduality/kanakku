import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as apiClient from '../lib/api-client'
import {
  useGetSchema,
  useRunQuery,
  useGetDashboards,
  useGetDashboard,
  useCreateDashboard,
  useUpdateDashboard,
  useDeleteDashboard,
  useGetWidgets,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget
} from './reports'

vi.mock('../lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

describe('reports API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useGetSchema calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce({ tables: [] })
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetSchema(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/reports/schema')
  })

  it('useRunQuery calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({ row_count: 0 })
    const qc = createQueryClient()
    const { result } = renderHook(() => useRunQuery(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate({ sql: 'SELECT 1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPost).toHaveBeenCalledWith('/reports/query', { sql: 'SELECT 1' })
  })

  it('useGetDashboards calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce([{ id: 'd1' }])
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetDashboards(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/reports/dashboards')
  })

  it('useGetDashboard calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce({ id: 'd1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetDashboard('d1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/reports/dashboards/d1')
  })

  it('useCreateDashboard calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({ id: 'd1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useCreateDashboard(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate({ name: 'Test Dash' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPost).toHaveBeenCalledWith('/reports/dashboards', { name: 'Test Dash' })
  })

  it('useUpdateDashboard calls apiPatch', async () => {
    vi.mocked(apiClient.apiPatch).mockResolvedValueOnce({ id: 'd1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useUpdateDashboard('d1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate({ name: 'New Name' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPatch).toHaveBeenCalledWith('/reports/dashboards/d1', { name: 'New Name' })
  })

  it('useDeleteDashboard calls apiDelete', async () => {
    vi.mocked(apiClient.apiDelete).mockResolvedValueOnce(undefined)
    const qc = createQueryClient()
    const { result } = renderHook(() => useDeleteDashboard(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate('d1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiDelete).toHaveBeenCalledWith('/reports/dashboards/d1')
  })

  it('useGetWidgets calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce([{ id: 'w1' }])
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetWidgets('d1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/reports/dashboards/d1/widgets')
  })

  it('useCreateWidget calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({ id: 'w1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useCreateWidget('d1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate({ title: 'W', query: 'Q', viz_type: 'table', viz_config: null, position: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPost).toHaveBeenCalledWith('/reports/dashboards/d1/widgets', expect.any(Object))
  })

  it('useUpdateWidget calls apiPatch', async () => {
    vi.mocked(apiClient.apiPatch).mockResolvedValueOnce({ id: 'w1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useUpdateWidget('d1', 'w1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate({ title: 'New W' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPatch).toHaveBeenCalledWith('/reports/dashboards/d1/widgets/w1', { title: 'New W' })
  })

  it('useDeleteWidget calls apiDelete', async () => {
    vi.mocked(apiClient.apiDelete).mockResolvedValueOnce(undefined)
    const qc = createQueryClient()
    const { result } = renderHook(() => useDeleteWidget('d1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate('w1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiDelete).toHaveBeenCalledWith('/reports/dashboards/d1/widgets/w1')
  })
})
