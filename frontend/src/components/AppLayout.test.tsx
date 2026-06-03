import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppLayout from './AppLayout'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let mockPathname = '/'

vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({
    location: { pathname: mockPathname },
  }),
  Outlet: () => <div data-testid="outlet" />,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useMatch: () => ({ pathname: '/' }),
  useMatches: () => [{ pathname: '/' }],
  useRouter: () => ({ subscribe: vi.fn() }),
}))

vi.mock('./nav/TopNav', () => ({ default: () => <div data-testid="top-nav" /> }))
vi.mock('./nav/SideNav', () => ({ default: () => <div data-testid="side-nav" /> }))
vi.mock('./MobileNav', () => ({ default: () => <div data-testid="mobile-nav" /> }))
vi.mock('../lib/period-context', () => ({
  PeriodProvider: ({ children }: any) => <div data-testid="period-provider">{children}</div>,
  usePeriod: () => ({ dashboardParams: {}, setPeriod: vi.fn() }),
}))

function renderLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AppLayout />
    </QueryClientProvider>
  )
}

describe('AppLayout', () => {
  it('renders guest layout for /login', () => {
    mockPathname = '/login'
    renderLayout()
    expect(screen.queryByTestId('top-nav')).not.toBeInTheDocument()
    expect(screen.queryByTestId('side-nav')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument()
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    expect(screen.getByTestId('period-provider')).toBeInTheDocument()
  })

  it('renders normal layout for /', () => {
    mockPathname = '/'
    renderLayout()
    expect(screen.getByTestId('top-nav')).toBeInTheDocument()
    expect(screen.getByTestId('side-nav')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument()
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
    expect(screen.getByTestId('period-provider')).toBeInTheDocument()
  })

  it('renders guest layout for sub-routes like /setup/profile', () => {
    mockPathname = '/setup/profile'
    renderLayout()
    expect(screen.queryByTestId('top-nav')).not.toBeInTheDocument()
  })
})
