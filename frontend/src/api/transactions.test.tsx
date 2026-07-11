import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useTransactions,
  useTransaction,
  useInfiniteTransactions,
  useCreateTransaction,
  usePatchTransaction,
  useDeleteTransaction,
  type TransactionCreate,
  type TransactionPatch
} from './transactions'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('../lib/api-client', () => ({
  apiGet: (...args: any[]) => mockGet(...args),
  apiPost: (...args: any[]) => mockPost(...args),
  apiPatch: (...args: any[]) => mockPatch(...args),
  apiDelete: (...args: any[]) => mockDelete(...args)
}))

function createWrapper(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

describe('transactions API hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useTransactions fetches transaction list with params', async () => {
    mockGet.mockResolvedValue({ items: [], next_cursor: null })
    const { result } = renderHook(() => useTransactions({
      type: 'expense',
      account_id: 'a1',
      payee_id: 'p1',
      category_id: 'c1',
      tag_id: 't1',
      budget_id: 'b1',
      from: '2026-01-01',
      to: '2026-01-31'
    }, 20), { wrapper: createWrapper() })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/transactions?type=expense&account_id=a1&payee_id=p1&category_id=c1&tag_id=t1&budget_id=b1&from=2026-01-01&to=2026-01-31&limit=20')
    )
  })

  it('useTransaction fetches a single transaction', async () => {
    mockGet.mockResolvedValue({ id: 'txn-1' })
    const { result } = renderHook(() => useTransaction('txn-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/transactions/txn-1')
  })

  it('useInfiniteTransactions fetches pages', async () => {
    mockGet.mockResolvedValue({ items: [], next_cursor: 'page2' })
    const { result } = renderHook(() => useInfiniteTransactions({}, 10), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockGet).toHaveBeenCalledWith('/transactions?limit=10')

    mockGet.mockResolvedValue({ items: [], next_cursor: null })
    result.current.fetchNextPage()
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenCalledWith('/transactions?limit=10&cursor=page2')
  })

  it('useCreateTransaction creates transaction and invalidates queries', async () => {
    mockPost.mockResolvedValue({ id: 'new-txn' })
    const { result } = renderHook(() => useCreateTransaction(), { wrapper: createWrapper() })
    
    const payload: TransactionCreate = { type: 'expense', amount: '10', account_id: 'a1', transacted_at: '2026-01-01' }
    result.current.mutate(payload)
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPost).toHaveBeenCalledWith('/transactions', payload)
  })

  it('usePatchTransaction updates transaction', async () => {
    mockPatch.mockResolvedValue({ id: 'txn-1' })
    const { result } = renderHook(() => usePatchTransaction(), { wrapper: createWrapper() })
    
    const patch: TransactionPatch = { amount: '20' }
    result.current.mutate({ id: 'txn-1', patch })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockPatch).toHaveBeenCalledWith('/transactions/txn-1', patch)
  })

  it('useDeleteTransaction deletes transaction', async () => {
    mockDelete.mockResolvedValue(null)
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper() })

    result.current.mutate('txn-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockDelete).toHaveBeenCalledWith('/transactions/txn-1')
  })

  it('usePatchTransaction invalidates the single-transaction cache entry, not just the list', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // Seed a stale per-id cache entry the way SplitForm/SplitDrawer/the edit
    // page do via useTransaction(id) / useQueries(['transaction', id]).
    qc.setQueryData(['transaction', 'txn-1'], { id: 'txn-1', amount: '10' })

    mockPatch.mockResolvedValue({ id: 'txn-1', amount: '20' })
    const { result } = renderHook(() => usePatchTransaction(), { wrapper: createWrapper(qc) })

    result.current.mutate({ id: 'txn-1', patch: { amount: '20' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(qc.getQueryState(['transaction', 'txn-1'])?.isInvalidated).toBe(true)
  })

  it('useDeleteTransaction invalidates the single-transaction cache entry', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(['transaction', 'txn-1'], { id: 'txn-1', deleted_at: null })

    mockDelete.mockResolvedValue(null)
    const { result } = renderHook(() => useDeleteTransaction(), { wrapper: createWrapper(qc) })

    result.current.mutate('txn-1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(qc.getQueryState(['transaction', 'txn-1'])?.isInvalidated).toBe(true)
  })
})
