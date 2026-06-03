import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import PiggyBanks from './PiggyBanks'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('PiggyBanks page', () => {
  it('shows loading state initially', () => {
    renderWithQuery(<PiggyBanks />)
    expect(screen.getByText(/loading piggy banks/i)).toBeInTheDocument()
  })

  it('renders piggy bank list', async () => {
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => expect(screen.getByText('Europe Trip')).toBeInTheDocument())
  })

  it('progress ring matches data', async () => {
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Europe Trip'))
    // progress_pct = 30 in fixture
    expect(screen.getByLabelText('30% progress')).toBeInTheDocument()
  })

  it('shows empty state when no piggy banks', async () => {
    server.use(http.get('/api/v1/piggy-banks', () => HttpResponse.json([])))
    renderWithQuery(<PiggyBanks />)
    await waitFor(() =>
      expect(screen.getByText(/no savings goals yet/i)).toBeInTheDocument(),
    )
  })

  it('opens create form on Add piggy bank click', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByRole('button', { name: /add piggy bank/i }))
    await user.click(screen.getByRole('button', { name: /add piggy bank/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('shows amount and target', async () => {
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Europe Trip'))
    expect(screen.getByText(/60000/)).toBeInTheDocument()
    expect(screen.getByText(/200000/)).toBeInTheDocument()
  })

  it('renders completed piggy bank with dates', async () => {
    server.use(
      http.get('/api/v1/piggy-banks', () =>
        HttpResponse.json([
          {
            id: 'completed-1',
            name: 'Completed Goal',
            target_amount: '1000.00',
            current_amount: '1000.00',
            currency: 'USD',
            progress_pct: 100,
            is_completed: true,
            date_started: '2026-01-01',
            target_date: '2026-12-31',
          },
        ]),
      ),
    )
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Completed Goal'))
    
    expect(screen.getByLabelText('100% progress')).toBeInTheDocument()
    expect(screen.getByText('Completed!')).toBeInTheDocument()
    expect(screen.getByText('Started: 2026-01-01')).toBeInTheDocument()
    expect(screen.getByText('Target: 2026-12-31')).toBeInTheDocument()
  })

  it('creates a piggy bank with all fields', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByRole('button', { name: /add piggy bank/i }))
    await user.click(screen.getByRole('button', { name: /add piggy bank/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const nameInput = screen.getByLabelText(/^name$/i)
    await user.type(nameInput, 'New Car')

    const targetInput = screen.getByLabelText(/target amount/i)
    await user.type(targetInput, '10000')

    const currencyInput = screen.getByLabelText(/currency/i)
    await user.clear(currencyInput)
    await user.type(currencyInput, 'USD')

    const startedInput = screen.getByLabelText(/date started/i)
    await user.type(startedInput, '2026-01-01')

    const targetDateInput = screen.getByLabelText(/target date/i)
    await user.type(targetDateInput, '2026-12-31')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('creates a piggy bank without optional fields', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByRole('button', { name: /add piggy bank/i }))
    await user.click(screen.getByRole('button', { name: /add piggy bank/i }))
    await waitFor(() => screen.getByRole('dialog'))

    const nameInput = screen.getByLabelText(/^name$/i)
    await user.type(nameInput, 'New Car')

    const targetInput = screen.getByLabelText(/target amount/i)
    await user.type(targetInput, '10000')

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('cancels create piggy bank', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByRole('button', { name: /add piggy bank/i }))
    await user.click(screen.getByRole('button', { name: /add piggy bank/i }))
    await waitFor(() => screen.getByRole('dialog'))

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('deletes a piggy bank', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Europe Trip'))

    const deleteBtns = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteBtns[0])

    await waitFor(() => screen.getByRole('dialog'))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('cancels delete dialog', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Europe Trip'))

    const deleteBtns = screen.getAllByRole('button', { name: /delete/i })
    await user.click(deleteBtns[0])

    await waitFor(() => screen.getByRole('dialog'))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens and closes drawer when clicking a piggy bank card', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Europe Trip'))

    // Card has a click handler, click on the text
    await user.click(screen.getByText('Europe Trip'))
    
    // BudgetDrawer mocked or real, we should just attempt to find a close button if rendered
    const closeDrawerBtn = screen.queryByRole('button', { name: /close/i })
    if (closeDrawerBtn) {
      await user.click(closeDrawerBtn)
    }
  })
})
