import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/render-utils'
import { BudgetDrawer } from './BudgetDrawer'
import { useGetBudget, useGetBudgetTransactions } from '../../api/budgets'
import { usePeriod } from '../../lib/period-context'

vi.mock('./TransactionDrawer', () => ({
  TransactionDrawer: () => <div data-testid="mock-transaction-drawer" />
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

vi.mock('../../api/budgets', () => ({
  useGetBudget: vi.fn(),
  useGetBudgets: vi.fn(() => ({ data: [] })),
  useGetBudgetTransactions: vi.fn(),
}))

vi.mock('../../lib/period-context', () => ({
  usePeriod: vi.fn(),
}))

describe('BudgetDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePeriod).mockReturnValue({
      dashboardParams: {
        start_date: '2026-05-01',
        end_date: '2026-05-31',
      }
    } as any)
  })

  it('renders loading state initially', () => {
    vi.mocked(useGetBudget).mockReturnValue({ isLoading: true, data: undefined } as any)
    vi.mocked(useGetBudgetTransactions).mockReturnValue({ isLoading: true, data: undefined } as any)

    renderWithQuery(<BudgetDrawer budgetId="b1" onClose={vi.fn()} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders not found when data is null', () => {
    vi.mocked(useGetBudget).mockReturnValue({ isLoading: false, data: null } as any)
    vi.mocked(useGetBudgetTransactions).mockReturnValue({ isLoading: false, data: null } as any)

    renderWithQuery(<BudgetDrawer budgetId="b1" onClose={vi.fn()} />)
    expect(screen.getByText('Budget not found.')).toBeInTheDocument()
  })

  it('renders budget details and transactions', () => {
    vi.mocked(useGetBudget).mockReturnValue({
      isLoading: false,
      data: {
        id: 'b1',
        name: 'Groceries',
        amount: '10000',
        type: 'recurring',
        recurrence_rule: 'FREQ=MONTHLY',
        end_date: '2026-12-31',
        created_at: '2026-01-01T00:00:00Z',
      }
    } as any)

    vi.mocked(useGetBudgetTransactions).mockReturnValue({
      isLoading: false,
      data: {
        total_spent: '2500',
        items: [
          {
            id: 't1',
            type: 'expense',
            amount: '500',
            description: 'Walmart',
            transacted_at: '2026-05-15T00:00:00Z',
            link_type: 'explicit',
          }
        ]
      }
    } as any)

    renderWithQuery(<BudgetDrawer budgetId="b1" onClose={vi.fn()} />)

    // Wait for the drawer to render
    expect(screen.getAllByText('Groceries')[0]).toBeInTheDocument()
    
    // Spend info
    expect(screen.getByText('₹2,500')).toBeInTheDocument()
    expect(screen.getByText('of ₹10,000')).toBeInTheDocument()
    expect(screen.getByText('₹7,500 remaining')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    
    // Budget details
    expect(screen.getByText('Recurring')).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('31 Dec 2026')).toBeInTheDocument() // end date
    
    // Transactions
    expect(screen.getByText('Transactions (1)')).toBeInTheDocument()
    expect(screen.getByText('Walmart')).toBeInTheDocument()
    expect(screen.getByText('explicit')).toBeInTheDocument()
  })

  it('handles over budget scenario', () => {
    vi.mocked(useGetBudget).mockReturnValue({
      isLoading: false,
      data: {
        id: 'b1',
        name: 'Groceries',
        amount: '10000',
        type: 'recurring',
        created_at: '2026-01-01T00:00:00Z',
      }
    } as any)

    vi.mocked(useGetBudgetTransactions).mockReturnValue({
      isLoading: false,
      data: {
        total_spent: '12000',
        items: []
      }
    } as any)

    renderWithQuery(<BudgetDrawer budgetId="b1" onClose={vi.fn()} />)

    expect(screen.getByText('₹12,000')).toBeInTheDocument()
    expect(screen.getByText('₹2,000 over budget')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument() // clamped to 100
  })
})
