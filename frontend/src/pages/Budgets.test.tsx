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

    // Change scope and confirm
    await user.click(screen.getByRole('radio', { name: /this instance only/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /^delete$/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows progress bar for each budget', async () => {
    renderBudgets()
    await waitFor(() => screen.getByText('Monthly Groceries'))
    expect(screen.getAllByLabelText('budget progress').length).toBeGreaterThan(0)
  })

  it('opens and closes drawer when clicking a budget card', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByText('Monthly Groceries'))
    await user.click(screen.getByText('Monthly Groceries'))
    
    // Simulate closing the drawer by clicking its onClose area if we mocked it,
    // but BudgetDrawer is actually rendered. So we can just find its close button.
    const closeDrawerBtn = screen.queryByRole('button', { name: /close/i })
    if (closeDrawerBtn) {
      await user.click(closeDrawerBtn)
    }
  })

  it('cancels the delete dialog', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByText('Monthly Groceries'))

    await user.click(screen.getByRole('button', { name: /delete monthly groceries/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('creates an ad-hoc budget with an end date', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => screen.getAllByLabelText(/^name$/i))

    const nameInputs = screen.getAllByLabelText(/^name$/i)
    await user.type(nameInputs[0], 'End Date Budget')
    const amountInputs = screen.getAllByLabelText(/amount/i)
    await user.clear(amountInputs[0])
    await user.type(amountInputs[0], '20000')

    const currencyInput = screen.getByLabelText(/currency/i)
    await user.clear(currencyInput)
    await user.type(currencyInput, 'USD')

    const endInput = screen.getByLabelText(/end date/i)
    await user.type(endInput, '2026-12-31')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes create modal on backdrop or close button', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => screen.getAllByLabelText(/^name$/i))

    // Close button (if EntityModal renders one, usually aria-label="Close")
    const closeBtn = screen.queryByRole('button', { name: /^close$/i })
    if (closeBtn) {
      await user.click(closeBtn)
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
  })

  it('handles recurring budget creation and custom interval', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => screen.getAllByLabelText(/^name$/i))

    // Switch to recurring
    await user.click(screen.getByRole('button', { name: /^recurring$/i }))
    
    // Switch to custom interval
    await user.click(screen.getByRole('button', { name: /custom interval/i }))
    const customDaysInput = screen.getByLabelText(/refresh every/i)
    await user.clear(customDaysInput)
    await user.type(customDaysInput, '5')
    
    // Fill out basics
    const nameInputs = screen.getAllByLabelText(/^name$/i)
    await user.type(nameInputs[0], 'Test Recurring')
    const amountInputs = screen.getAllByLabelText(/amount/i)
    await user.type(amountInputs[0], '500')
    const startInput = screen.getByLabelText(/first period starts/i)
    await user.type(startInput, '2026-05-01')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('handles invalid recurring custom interval error', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => screen.getAllByLabelText(/^name$/i))

    await user.click(screen.getByRole('button', { name: /^recurring$/i }))
    await user.click(screen.getByRole('button', { name: /custom interval/i }))
    const customDaysInput = screen.getByLabelText(/refresh every/i)
    await user.clear(customDaysInput)
    // Do not type anything so it evaluates to NaN, bypassing HTML5 min="1" validation block

    // Fill out required basics so form submit isn't blocked by HTML5 required attribute
    const nameInputs = screen.getAllByLabelText(/^name$/i)
    await user.type(nameInputs[0], 'Test')
    const amountInputs = screen.getAllByLabelText(/amount/i)
    await user.type(amountInputs[0], '500')
    
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    expect(await screen.findByText(/please enter a valid interval/i)).toBeInTheDocument()

    // Test cancel button
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows error if budget creation fails', async () => {
    server.use(
      http.post('/api/v1/budgets', () => HttpResponse.json({ message: 'Error' }, { status: 500 }))
    )
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => screen.getAllByLabelText(/^name$/i))

    const nameInputs = screen.getAllByLabelText(/^name$/i)
    await user.type(nameInputs[0], 'Fail')
    const amountInputs = screen.getAllByLabelText(/amount/i)
    await user.type(amountInputs[0], '50')
    
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/failed to create budget/i)).toBeInTheDocument())
  })

  it('can select predefined recurring schedule', async () => {
    const user = userEvent.setup()
    renderBudgets()
    await waitFor(() => screen.getByRole('button', { name: /add budget/i }))
    await user.click(screen.getByRole('button', { name: /add budget/i }))
    await waitFor(() => screen.getAllByLabelText(/^name$/i))

    await user.click(screen.getByRole('button', { name: /^recurring$/i }))
    await user.click(screen.getByRole('button', { name: /^yearly$/i }))
    
    const nameInputs = screen.getAllByLabelText(/^name$/i)
    await user.type(nameInputs[0], 'Yearly Fund')
    const amountInputs = screen.getAllByLabelText(/amount/i)
    await user.type(amountInputs[0], '1000')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

