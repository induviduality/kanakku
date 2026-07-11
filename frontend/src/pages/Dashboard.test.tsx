import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import Dashboard from './Dashboard'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'
import { DASHBOARD_RESPONSE } from '../test/handlers'
import { PeriodContext } from '../lib/period-context'
import userEvent from '@testing-library/user-event'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

vi.mock('@number-flow/react', () => {
  return {
    default: ({ value }: { value: number }) => <span>{value}</span>
  }
})

function renderDashboard() {
  return renderWithQuery(
    <PeriodContext.Provider value={{
      selection: { type: 'month', value: 0 },
      setSelection: vi.fn(),
      dashboardParams: { period: 'custom', start_date: '2026-04-01', end_date: '2026-04-30' },
      label: 'April 2026',
      shortLabel: 'Apr 2026'
    }}>
      <Dashboard />
    </PeriodContext.Provider>
  )
}

describe('Dashboard page', () => {
  it('shows skeleton while loading', () => {
    renderDashboard()
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders hero stat cards', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Total Balance'))
    expect(screen.getByText('Inflow')).toBeInTheDocument()
    expect(screen.getByText('Outflow')).toBeInTheDocument()
    expect(screen.getByText('Savings Rate')).toBeInTheDocument()
  })

  it('renders budget progress card', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Food Budget'))
    expect(screen.getByText('Budgets')).toBeInTheDocument()
  })

  it('renders recent transactions', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText('Swiggy order'))
  })

  it('renders pending splits summary', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText(/Pending Splits/i))
    await waitFor(() => expect(screen.getByText('Swiggy')).toBeInTheDocument())
  })
  
  it('renders account balances as of the period end date', async () => {
    renderDashboard()
    // renderDashboard's PeriodContext override uses end_date: '2026-04-30' —
    // a fixed past date, so the "as of" label should show that date rather
    // than "today".
    await waitFor(() => screen.getByText(/Account Balances — as of 30 Apr 2026/))
    expect(screen.getByText('HDFC Savings')).toBeInTheDocument()
  })

  it('toggles total balance visibility', async () => {
    const user = userEvent.setup()
    renderDashboard()
    await waitFor(() => screen.getByText('Total Balance'))
    
    // Hide balance
    await user.click(screen.getByLabelText(/hide balance/i))
    expect(screen.getByText('••••••')).toBeInTheDocument()
    
    // Show balance
    await user.click(screen.getByLabelText(/show balance/i))
    expect(screen.queryByText('••••••')).not.toBeInTheDocument()
  })

  it('shows empty states when no data', async () => {
    server.use(
      http.get('/api/v1/dashboard/home', () =>
        HttpResponse.json({
          ...DASHBOARD_RESPONSE,
          budgets_summary: [],
          recent_transactions: [],
          pending_splits_summary: { count: 0, total_owed: '0', by_payee: [] },
          piggy_banks_summary: [],
          account_balances: [],
        }),
      ),
    )
    renderDashboard()
    await waitFor(() => screen.getByText('Total Balance'))
    expect(screen.getByText('No active budgets.')).toBeInTheDocument()
    expect(screen.getByText('No savings goals yet.')).toBeInTheDocument()
    expect(screen.getByText('No pending splits.')).toBeInTheDocument()
    expect(screen.getByText('No accounts yet.')).toBeInTheDocument()
    expect(screen.getByText('No transactions yet.')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    server.use(
      http.get('/api/v1/dashboard/home', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 }),
      ),
    )
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument(),
    )
  })
})
