import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TransactionRow } from './TransactionRow'
import type { Transaction } from '../api/transactions'

const BASE_TXN: Transaction = {
  id: 'txn-1',
  user_id: 'user-1',
  type: 'income',
  description: 'Salary credit',
  amount: '80000.00',
  currency: 'INR',
  transacted_at: '2026-05-01T10:00:00Z',
  account_id: 'acc-1',
  payee_id: 'p-1',
  to_account_id: null,
  to_amount: null,
  to_currency: null,
  notes: null,
  external_ref: null,
  payment_method_id: null,
  payment_method_name: null,
  subscription_id: null,
  import_record_id: null,
  split_id: null,
  is_split: false,
  category_ids: [],
  tag_ids: [],
  budget_ids: [],
  deleted_at: null,
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
}

describe('TransactionRow', () => {
  it('renders description and amount', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('Salary credit')).toBeInTheDocument()
    expect(screen.getByText(/80,000/)).toBeInTheDocument()
  })

  it('renders date as "01 May"', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('01 May')).toBeInTheDocument()
  })

  it('shows payee → account for income', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        payeeName="Employer Corp"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('Employer Corp → HDFC Savings')).toBeInTheDocument()
  })

  it('shows account → payee for expense', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, type: 'expense' }}
        accountName="HDFC Credit"
        payeeName="Swiggy"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('HDFC Credit → Swiggy')).toBeInTheDocument()
  })

  it('shows account → toAccount for transfer', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, type: 'transfer', to_account_id: 'acc-2' }}
        accountName="HDFC Savings"
        toAccountName="ICICI Current"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('HDFC Savings → ICICI Current')).toBeInTheDocument()
  })

  it('shows only account name when no payee', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, payee_id: null }}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('HDFC Savings')).toBeInTheDocument()
    expect(screen.queryByText('→')).not.toBeInTheDocument()
  })

  it('renders checkbox when showCheckbox is true', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={true}
      />,
    )
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('does not render checkbox when showCheckbox is false', () => {
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('applies selection highlight when isSelected is true', () => {
    const { container } = render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={true}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(container.firstChild).toHaveClass('bg-accent/10')
  })

  it('calls onClick when the row is clicked', async () => {
    const onClick = vi.fn()
    render(
      <TransactionRow
        transaction={BASE_TXN}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={onClick}
        showCheckbox={false}
      />,
    )
    await userEvent.click(screen.getByText('Salary credit'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('shows dash when description is null', () => {
    render(
      <TransactionRow
        transaction={{ ...BASE_TXN, description: null }}
        accountName="HDFC Savings"
        isSelected={false}
        onClick={vi.fn()}
        showCheckbox={false}
      />,
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
