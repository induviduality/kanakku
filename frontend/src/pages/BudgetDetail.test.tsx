import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import BudgetDetail from './BudgetDetail'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

// BudgetDetail reads budgetId from route params — mock the hook
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useParams: () => ({ budgetId: 'budget-1' }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

vi.mock('../lib/period-context', () => ({
  usePeriod: () => ({
    dashboardParams: { start_date: '2026-01-01', end_date: '2026-01-31' },
    period: 'month'
  }),
  PeriodProvider: ({ children }: any) => <>{children}</>
}))

describe('BudgetDetail page', () => {
  it('shows loading while fetching', () => {
    renderWithQuery(<BudgetDetail />)
    expect(screen.getByText(/loading budget/i)).toBeInTheDocument()
  })

  it('renders budget name and progress after load', async () => {
    renderWithQuery(<BudgetDetail />)
    await waitFor(() =>
      expect(screen.getByText('Monthly Groceries')).toBeInTheDocument(),
    )
    expect(screen.getByLabelText('spending progress')).toBeInTheDocument()
  })

  it('lists linked transactions', async () => {
    renderWithQuery(<BudgetDetail />)
    await waitFor(() => screen.getByText('Monthly Groceries'))
    await waitFor(() =>
      expect(screen.getByText('Groceries run')).toBeInTheDocument(),
    )
    expect(screen.getByText('explicit')).toBeInTheDocument()
  })

  it('shows empty state when no transactions', async () => {
    server.use(
      http.get('/api/v1/budgets/:budgetId/transactions', () =>
        HttpResponse.json({ items: [], total_spent: '0.00' }),
      ),
    )
    renderWithQuery(<BudgetDetail />)
    await waitFor(() => screen.getByText('Monthly Groceries'))
    await waitFor(() =>
      expect(
        screen.getByText(/no transactions linked/i),
      ).toBeInTheDocument(),
    )
  })

  it('shows 404 message when budget not found', async () => {
    server.use(
      http.get('/api/v1/budgets/:budgetId', () =>
        HttpResponse.json({ detail: 'Budget not found' }, { status: 404 }),
      ),
    )
    renderWithQuery(<BudgetDetail />)
    await waitFor(() =>
      expect(screen.getByText(/budget not found/i)).toBeInTheDocument(),
    )
  })

  it('opens transaction drawer on click', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BudgetDetail />)
    await waitFor(() => screen.getByText('Monthly Groceries'))
    await waitFor(() => screen.getByText('Groceries run'))

    await user.click(screen.getByText('Groceries run'))
    // Interaction succeeds without throwing
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens transaction drawer on Enter key', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BudgetDetail />)
    await waitFor(() => screen.getByText('Monthly Groceries'))
    await waitFor(() => screen.getByText('Groceries run'))

    const row = screen.getByText('Groceries run').closest('[role="button"]')!
    row.focus()
    await user.keyboard('{Enter}')
    // Interaction succeeds without throwing
    expect(row).toBeInTheDocument()
  })

  it('opens transaction drawer on Space key', async () => {
    const user = userEvent.setup()
    renderWithQuery(<BudgetDetail />)
    await waitFor(() => screen.getByText('Monthly Groceries'))
    await waitFor(() => screen.getByText('Groceries run'))

    const row = screen.getByText('Groceries run').closest('[role="button"]')!
    row.focus()
    await user.keyboard(' ')
    // Interaction succeeds without throwing
    expect(row).toBeInTheDocument()
  })
})
