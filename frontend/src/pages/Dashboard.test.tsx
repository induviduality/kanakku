import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Dashboard from './Dashboard'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'
import { DASHBOARD_RESPONSE } from '../test/handlers'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('Dashboard page', () => {
  it('shows skeleton while loading', () => {
    renderWithQuery(<Dashboard />)
    // Skeleton divs are present (animate-pulse)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders month heading', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument())
  })

  it('renders hero stat cards', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('Dashboard'))
    expect(screen.getByText(/^spent$/i)).toBeInTheDocument()
    expect(screen.getByText(/^income$/i)).toBeInTheDocument()
    expect(screen.getByText(/^net$/i)).toBeInTheDocument()
  })

  it('renders budget progress card', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('Food Budget'))
    expect(screen.getByLabelText('budget status: on_track')).toBeInTheDocument()
    expect(screen.getByLabelText('budget progress bar')).toBeInTheDocument()
  })

  it('renders category breakdown section', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('Spending by Category'))
  })

  it('renders subscription with status badge', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('Netflix'))
    expect(screen.getByLabelText('status: upcoming')).toBeInTheDocument()
  })

  it('renders piggy bank progress ring', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('Europe Trip'))
    expect(screen.getByLabelText('30% progress')).toBeInTheDocument()
  })

  it('renders account balance', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('HDFC Savings'))
    expect(screen.getByText(/87/)).toBeInTheDocument()
  })

  it('renders recent transactions', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('Dinner order'))
  })

  it('renders pending splits summary', async () => {
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText(/Pending Splits/i))
    await waitFor(() => expect(screen.getByText('Swiggy')).toBeInTheDocument())
  })

  it('shows empty states when no data', async () => {
    server.use(
      http.get('/api/v1/dashboard/home', () =>
        HttpResponse.json({
          ...DASHBOARD_RESPONSE,
          budgets_summary: [],
          category_breakdown: [],
          recent_transactions: [],
          pending_splits_summary: { count: 0, total_owed: '0', by_payee: [] },
          piggy_banks_summary: [],
          account_balances: [],
          active_subscriptions: [],
        }),
      ),
    )
    renderWithQuery(<Dashboard />)
    await waitFor(() => screen.getByText('Dashboard'))
    expect(screen.getByText('No active budgets.')).toBeInTheDocument()
    expect(screen.getByText('No active subscriptions.')).toBeInTheDocument()
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
    renderWithQuery(<Dashboard />)
    await waitFor(() =>
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument(),
    )
  })
})
