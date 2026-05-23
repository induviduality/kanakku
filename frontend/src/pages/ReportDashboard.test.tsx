import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportDashboard from './ReportDashboard'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useParams: () => ({ dashboardId: 'dash-1' }),
    useNavigate: () => vi.fn(),
  }
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ReportDashboard />
    </QueryClientProvider>,
  )
}

describe('ReportDashboard', () => {
  it('renders dashboard name', async () => {
    renderPage()
    expect(await screen.findByText('Spending Overview')).toBeInTheDocument()
  })

  it('renders add widget button', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /add widget/i })).toBeInTheDocument()
  })

  it('renders widget titles', async () => {
    renderPage()
    expect(await screen.findByText('Top Expenses')).toBeInTheDocument()
  })

  it('renders edit and delete buttons for widgets', async () => {
    renderPage()
    await screen.findByText('Top Expenses')
    expect(screen.getByRole('button', { name: /edit widget top expenses/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete widget top expenses/i })).toBeInTheDocument()
  })
})
