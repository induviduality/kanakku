import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { renderWithQuery } from '../test/render-utils'
import BundleAsSplitModal from './BundleAsSplitModal'

describe('BundleAsSplitModal', () => {
  const defaultProps = {
    expenseTransactionIds: ['txn-1'],
    expenseAmount: '500.00',
    open: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  }

  it('renders when open', () => {
    renderWithQuery(<BundleAsSplitModal {...defaultProps} />)
    expect(screen.getByRole('heading', { name: 'Bundle as Split' })).toBeInTheDocument()
    expect(screen.getByText(/Expense:/)).toBeInTheDocument()
    expect(screen.getAllByText(/500\.00/).length).toBeGreaterThanOrEqual(1)
  })

  it('does not render when closed', () => {
    renderWithQuery(<BundleAsSplitModal {...defaultProps} open={false} />)
    expect(screen.queryByText('Bundle as Split')).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithQuery(<BundleAsSplitModal {...defaultProps} onClose={onClose} />)
    
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithQuery(<BundleAsSplitModal {...defaultProps} onClose={onClose} />)
    
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows no income transactions if empty', async () => {
    server.use(
      http.get('/api/v1/transactions', () => HttpResponse.json({ items: [], total: 0 })),
    )
    renderWithQuery(<BundleAsSplitModal {...defaultProps} />)
    await waitFor(() =>
      expect(screen.getByText('No income transactions in the last 3 months.')).toBeInTheDocument(),
    )
  })

  it('can toggle income transactions', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/v1/transactions', () =>
        HttpResponse.json({
          items: [
            {
              id: 'inc-1',
              amount: '100.00',
              description: 'Refund',
              type: 'income',
              account_id: 'acc-1',
              transacted_at: '2026-05-01T10:00:00Z',
              payee_id: null,
              to_account_id: null,
            },
            {
              id: 'inc-2',
              amount: '50.00',
              description: 'Cashback',
              type: 'income',
              account_id: 'acc-1',
              transacted_at: '2026-05-02T10:00:00Z',
              payee_id: null,
              to_account_id: null,
            },
          ],
          total: 2,
        }),
      ),
    )
    renderWithQuery(<BundleAsSplitModal {...defaultProps} />)

    await waitFor(() => screen.getByText('Refund'))

    // TransactionPicker uses TransactionRow with role="option" for selection;
    // the checkbox is decorative (onChange is a no-op, onClick stops propagation).
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThanOrEqual(2)

    // First option (Refund) starts unselected
    expect(options[0]).toHaveAttribute('aria-selected', 'false')

    await user.click(options[0]) // Select 'Refund'
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    // Deselect
    await user.click(options[0])
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('can add, update, and remove forgiven amounts', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BundleAsSplitModal {...defaultProps} />)
    
    await user.click(screen.getByText('+ Add forgiven amount'))
    const input = screen.getByLabelText('Forgiven amount 1')
    expect(input).toBeInTheDocument()

    await user.type(input, '50')
    expect(input).toHaveValue(50)

    await user.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByLabelText('Forgiven amount 1')).not.toBeInTheDocument()
  })

  it('shows backend error when bundle API fails (over-budget validated server-side)', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/v1/splits/bundle', () => new HttpResponse(null, { status: 422 })),
    )
    renderWithQuery(<BundleAsSplitModal {...defaultProps} />)

    await user.click(screen.getByText('+ Add forgiven amount'))
    const input = screen.getByLabelText('Forgiven amount 1')
    await user.type(input, '600') // Exceeds 500

    await user.click(screen.getByRole('button', { name: /^bundle$/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to bundle split. Please try again.'),
    )
  })

  it('submits with valid data and calls onSuccess', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    
    server.use(
      http.post('/api/v1/splits/bundle', () => HttpResponse.json({ id: 'bundle-1' }))
    )

    renderWithQuery(<BundleAsSplitModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />)
    
    await user.click(screen.getByText('+ Add forgiven amount'))
    await user.type(screen.getByLabelText('Forgiven amount 1'), '50')

    const notesInput = screen.getByLabelText('Notes')
    await user.type(notesInput, 'Test notes')

    await user.click(screen.getByRole('button', { name: /^bundle$/i }))
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error on API failure', async () => {
    const user = userEvent.setup()
    server.use(
      http.post('/api/v1/splits/bundle', () => new HttpResponse(null, { status: 500 }))
    )

    renderWithQuery(<BundleAsSplitModal {...defaultProps} />)
    
    await user.click(screen.getByRole('button', { name: /^bundle$/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to bundle split. Please try again.'))
  })
})
