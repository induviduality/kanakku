import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as apiClient from '../lib/api-client'
import {
  useGetSubscriptions,
  useGetSubscription,
  useCreateSubscription,
  usePatchSubscription,
  useDeleteSubscription,
  useLinkTransaction,
  useGetSubscriptionHistory,
  SubscriptionCreate,
  SubscriptionPatch
} from './subscriptions'

vi.mock('../lib/api-client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

describe('subscriptions API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useGetSubscriptions calls apiGet without includeInactive by default', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce([])
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetSubscriptions(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/subscriptions')
  })

  it('useGetSubscriptions calls apiGet with includeInactive=true', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce([])
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetSubscriptions(true), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/subscriptions?include_inactive=true')
  })

  it('useGetSubscription calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce({ id: 's1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetSubscription('s1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/subscriptions/s1')
  })

  it('useCreateSubscription calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce({ id: 's1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => useCreateSubscription(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    const body: SubscriptionCreate = {
      name: 'Netflix',
      amount: '10.00',
      currency: 'USD',
      billing_cycle: 'monthly',
      billing_day: 15,
      account_id: 'a1'
    }
    result.current.mutate(body)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPost).toHaveBeenCalledWith('/subscriptions', body)
  })

  it('usePatchSubscription calls apiPatch', async () => {
    vi.mocked(apiClient.apiPatch).mockResolvedValueOnce({ id: 's1' })
    const qc = createQueryClient()
    const { result } = renderHook(() => usePatchSubscription(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    const patch: SubscriptionPatch = { name: 'Hulu' }
    result.current.mutate({ id: 's1', patch })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPatch).toHaveBeenCalledWith('/subscriptions/s1', patch)
  })

  it('useDeleteSubscription calls apiDelete', async () => {
    vi.mocked(apiClient.apiDelete).mockResolvedValueOnce(undefined)
    const qc = createQueryClient()
    const { result } = renderHook(() => useDeleteSubscription(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate('s1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiDelete).toHaveBeenCalledWith('/subscriptions/s1')
  })

  it('useLinkTransaction calls apiPost', async () => {
    vi.mocked(apiClient.apiPost).mockResolvedValueOnce(undefined)
    const qc = createQueryClient()
    const { result } = renderHook(() => useLinkTransaction(), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    result.current.mutate({ subId: 's1', transactionId: 't1' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiPost).toHaveBeenCalledWith('/subscriptions/s1/link-transaction', { transaction_id: 't1' })
  })

  it('useGetSubscriptionHistory calls apiGet', async () => {
    vi.mocked(apiClient.apiGet).mockResolvedValueOnce([])
    const qc = createQueryClient()
    const { result } = renderHook(() => useGetSubscriptionHistory('s1'), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.apiGet).toHaveBeenCalledWith('/subscriptions/s1/history')
  })
})
