import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithQuery } from '../test/render-utils'
import TransactionFormPage from './TransactionForm'
import userEvent from '@testing-library/user-event'
import { server } from '../test/server'
import { http, HttpResponse } from 'msw'

const navigateMock = vi.fn()
let mockSearch: Record<string, string> = {}

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearch: () => mockSearch,
  }
})

describe('TransactionForm page', () => {
  it('renders New Transaction when no editId is present', async () => {
    mockSearch = {}
    renderWithQuery(<TransactionFormPage />)
    
    await waitFor(() => {
      expect(screen.getByText('New Transaction')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /add transaction/i })).toBeInTheDocument()
    })
  })

  it('renders Edit Transaction and loads transaction when editId is present', async () => {
    server.use(
      http.get('/api/v1/transactions/txn-1', () => {
        return HttpResponse.json({ id: 'txn-1', amount: '100', type: 'expense', account_id: 'acc-1', date: '2026-05-15T12:00:00Z', payee_id: 'payee-1', description: 'Test', is_transfer: false })
      })
    )
    mockSearch = { editId: 'txn-1' }
    renderWithQuery(<TransactionFormPage />)
    
    expect(screen.getByText(/loading transaction/i)).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByText('Edit Transaction')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
    })
  })

  it('navigates back when Back is clicked', async () => {
    mockSearch = {}
    const user = userEvent.setup()
    renderWithQuery(<TransactionFormPage />)
    
    await waitFor(() => screen.getByRole('button', { name: /back/i }))
    const backBtn = screen.getByRole('button', { name: /back/i })
    await user.click(backBtn)
    
    expect(navigateMock).toHaveBeenCalledWith({ to: '/transactions' })
  })
})
