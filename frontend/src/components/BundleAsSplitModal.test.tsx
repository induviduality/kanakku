import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import BundleAsSplitModal from './BundleAsSplitModal'

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
    </QueryClientProvider>,
  )
}

describe('BundleAsSplitModal', () => {
  it('renders when open', () => {
    wrap(
      <BundleAsSplitModal
        expenseTransactionId="txn-1"
        expenseAmount="500.00"
        open={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Bundle as Split' })).toBeInTheDocument()
    expect(screen.getByText(/Expense:/)).toBeInTheDocument()
    expect(screen.getAllByText(/500\.00/).length).toBeGreaterThanOrEqual(1)
  })

  it('does not render when closed', () => {
    wrap(
      <BundleAsSplitModal
        expenseTransactionId="txn-1"
        expenseAmount="500.00"
        open={false}
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    )
    expect(screen.queryByText('Bundle as Split')).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    wrap(
      <BundleAsSplitModal
        expenseTransactionId="txn-1"
        expenseAmount="500.00"
        open={true}
        onClose={onClose}
        onSuccess={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('can add and remove forgiven amounts', () => {
    wrap(
      <BundleAsSplitModal
        expenseTransactionId="txn-1"
        expenseAmount="500.00"
        open={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('+ Add forgiven amount'))
    expect(screen.getByLabelText('Forgiven amount 1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(screen.queryByLabelText('Forgiven amount 1')).not.toBeInTheDocument()
  })

  it('submits and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    wrap(
      <BundleAsSplitModal
        expenseTransactionId="txn-1"
        expenseAmount="500.00"
        open={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    )
    fireEvent.click(screen.getByText('Bundle'))
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})
