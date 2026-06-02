import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TransactionDrawer } from './TransactionDrawer'
import { renderWithQuery } from '../../test/render-utils'
import type { Transaction } from '../../api/transactions'

const mockExpenseTxn: Transaction = {
  id: 'txn-expense-1',
  user_id: 'user-1',
  type: 'expense',
  transacted_at: '2026-05-10T14:30:00Z',
  amount: '1250.00',
  currency: 'INR',
  description: 'Dinner with friends',
  account_id: 'acc-1',
  payee_id: 'payee-rahul',
  category_ids: ['cat-food'],
  tag_ids: ['tag-weekend'],
  budget_ids: ['budget-1'],
  notes: 'Split dinner later',
  external_ref: 'REF123456',
  payment_method_id: 'pm-cc',
  payment_method_name: 'Credit Card',
  to_account_id: null,
  to_amount: null,
  to_currency: null,
  subscription_id: 'sub-netflix',
  import_record_id: 'imp-rec-1',
  split_id: 'split-dinner',
  is_split: true,
  created_at: '2026-05-10T14:30:00Z',
  updated_at: '2026-05-11T10:00:00Z',
  deleted_at: null,
}

const mockTransferTxn: Transaction = {
  id: 'txn-transfer-1',
  user_id: 'user-1',
  type: 'transfer',
  transacted_at: '2026-05-12T09:00:00Z',
  amount: '5000.00',
  currency: 'USD',
  description: 'Self transfer',
  account_id: 'acc-1',
  payee_id: null,
  category_ids: [],
  tag_ids: [],
  budget_ids: [],
  notes: null,
  external_ref: null,
  payment_method_id: null,
  payment_method_name: null,
  to_account_id: 'acc-2',
  to_amount: '415000.00',
  to_currency: 'INR',
  subscription_id: null,
  import_record_id: null,
  split_id: null,
  is_split: false,
  created_at: '2026-05-12T09:00:00Z',
  updated_at: '2026-05-12T09:00:00Z',
  deleted_at: null,
}

describe('TransactionDrawer component', () => {
  it('does not render when transaction is null', () => {
    const { container } = renderWithQuery(
      <TransactionDrawer transaction={null} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders expense transaction details correctly', async () => {
    renderWithQuery(
      <TransactionDrawer
        transaction={mockExpenseTxn}
        splitTitle="Taj Dinner Split"
        onClose={vi.fn()}
      />
    )

    // Verify title and hero area
    expect(screen.getByRole('heading', { name: 'Dinner with friends' })).toBeInTheDocument()
    expect(screen.getByText('−₹1,250')).toBeInTheDocument()
    expect(screen.getByText('expense')).toBeInTheDocument()

    // Verify details rows
    expect(screen.getByText('Credit Card')).toBeInTheDocument()
    expect(screen.getByText('REF123456')).toBeInTheDocument()

    // Verify notes
    expect(screen.getByText('Split dinner later')).toBeInTheDocument()

    // Verify linked split is shown and opens SplitDrawer
    const user = userEvent.setup()
    await waitFor(() => {
      expect(screen.getByText('Taj Dinner Split')).toBeInTheDocument()
    })
    const splitTitleText = screen.getByText('Taj Dinner Split')
    const splitButton = splitTitleText.closest('button')
    expect(splitButton).toBeInTheDocument()

    await user.click(splitButton!)
    // Verify SplitDrawer opened (which will fetch split-dinner and render Title)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument()
    })
  })

  it('renders transfer transaction details correctly', () => {
    // Change to_currency to 'EUR' to verify non-INR display rule
    const transferWithEur = { ...mockTransferTxn, to_currency: 'EUR' }
    renderWithQuery(
      <TransactionDrawer
        transaction={transferWithEur}
        onClose={vi.fn()}
      />
    )

    // Verify non-INR source currency displays next to amount
    expect(screen.getByText('USD')).toBeInTheDocument()

    // Verify type
    expect(screen.getByText('transfer')).toBeInTheDocument()

    // Verify transfer-specific rows
    expect(screen.getByText('To amount')).toBeInTheDocument()
    expect(screen.getByText('EUR')).toBeInTheDocument()
  })
})
