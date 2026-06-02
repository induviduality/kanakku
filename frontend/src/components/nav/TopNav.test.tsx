import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithQuery } from '../../test/render-utils'
import TopNav from './TopNav'
import { PeriodContext } from '../../lib/period-context'

let mockPathname = '/'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useRouterState: () => ({
      location: { pathname: mockPathname }
    }),
    Link: ({ children, to, className }: any) => (
      <a href={to} className={className}>{children}</a>
    )
  }
})

describe('TopNav component', () => {
  const mockPeriodContext = {
    period: 'May 2026',
    setPeriod: vi.fn(),
    selection: { mode: 'month', year: 2026, month: 5 },
    setSelection: vi.fn(),
    dashboardParams: {
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    },
    shortLabel: 'May 26',
  }

  it('renders Dashboard as breadcrumb when on /', () => {
    mockPathname = '/'
    renderWithQuery(
      <PeriodContext.Provider value={mockPeriodContext as any}>
        <TopNav />
      </PeriodContext.Provider>
    )
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders Transactions breadcrumb when on /transactions', () => {
    mockPathname = '/transactions'
    renderWithQuery(
      <PeriodContext.Provider value={mockPeriodContext as any}>
        <TopNav />
      </PeriodContext.Provider>
    )
    
    expect(screen.getByText('Transactions')).toBeInTheDocument()
  })

  it('renders nested breadcrumbs when on /transactions/new', () => {
    mockPathname = '/transactions/new'
    renderWithQuery(
      <PeriodContext.Provider value={mockPeriodContext as any}>
        <TopNav />
      </PeriodContext.Provider>
    )
    
    expect(screen.getByText('Transactions')).toBeInTheDocument()
    expect(screen.getByText('New Transaction')).toBeInTheDocument()
  })

  it('renders period picker with shortLabel', () => {
    mockPathname = '/'
    renderWithQuery(
      <PeriodContext.Provider value={mockPeriodContext as any}>
        <TopNav />
      </PeriodContext.Provider>
    )
    
    expect(screen.getByRole('button', { name: /may 26/i })).toBeInTheDocument()
  })
})
