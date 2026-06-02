import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Budgets from './Budgets'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

import { PeriodProvider } from '../lib/period-context'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

function renderBudgets() {
  return renderWithQuery(
    <PeriodProvider>
      <Budgets />
    </PeriodProvider>
  )
}

describe('Budgets page', () => {
  it('shows loading state initially', () => {
    renderBudgets()
    expect(screen.getByText(/loading budgets/i)).toBeInTheDocument()
  })

  it('renders budget list', async () => {
    renderBudgets()
    await waitFor(() =>
      expect(screen.getByText('Monthly Groceries')).toBeInTheDocument(),
    )
  })

  it('shows empty state when no budgets', async () => {
    server.use(http.get('/api/v1/budgets', () => HttpResponse.json([])))
    renderBudgets()
    await waitFor(() =>
      expect(screen.getByText('No budgets')).toBeInTheDocument(),
    )
  })

  it('opens create modal on Add budget click', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getAllByLabelText(/^name$/i).length).toBeGreaterThan(0)
  })

  it('creates a budget', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => screen.getAllByLabelText(/^name$/i))

    const nameInputs = screen.getAllByLabelText(/^name$/i)
    await user.type(nameInputs[0], 'Holiday fund')
    
    const amountInputs = screen.getAllByLabelText(/amount/i)
    await user.clear(amountInputs[0])
    await user.type(amountInputs[0], '20000')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows recurring delete scope dialog for recurring budget', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByText('Monthly Groceries'))

    await user.click(screen.getByRole('button', { name: /delete monthly groceries/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/delete recurring budget/i)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /this instance only/i })).toBeInTheDocument()
  })

  it('shows simple confirm for ad-hoc budget deletion', async () => {
    server.use(
      http.get('/api/v1/budgets', () =>
        HttpResponse.json([
          {
            id: 'budget-adhoc',
            name: 'Holiday trip',
            amount: '10000.00',
            currency: 'INR',
            type: 'adhoc',
            period: null,
            start_date: null,
            end_date: null,
            recurrence_rule: null,
            parent_budget_id: null,
            is_modified_instance: false,
            is_active: true,
            notes: null,
            category_ids: [],
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            deleted_at: null,
          },
        ]),
      ),
    )
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByText('Holiday trip'))

    await user.click(screen.getByRole('button', { name: /delete holiday trip/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    // Ad-hoc shows simple confirm, not the recurring scope options
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('shows progress bar for each budget', async () => {
    renderBudgets()
    await waitFor(() => screen.getByText('Monthly Groceries'))
    expect(screen.getAllByLabelText('budget progress').length).toBeGreaterThan(0)
  })
})
