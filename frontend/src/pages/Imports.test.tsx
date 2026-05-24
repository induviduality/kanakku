import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute } from '@tanstack/react-router'
import Imports from './Imports'

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function renderWithRouter() {
  const rootRoute = createRootRoute({ component: Imports })
  const router = createRouter({ routeTree: rootRoute })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('Imports', () => {
  it('shows loading state', () => {
    renderWithProviders(<Imports />)
    expect(screen.getByText(/loading imports/i)).toBeInTheDocument()
  })

  it('renders batch list after load', async () => {
    renderWithRouter()
    expect(await screen.findByText('hdfc_jan_2026.pdf')).toBeInTheDocument()
    expect(screen.getByText(/completed/i)).toBeInTheDocument()
    expect(screen.getByText(/verified/i)).toBeInTheDocument()
  })

  it('shows parsed/confirmed/rejected counts', async () => {
    renderWithRouter()
    expect(await screen.findByText(/10 parsed/i)).toBeInTheDocument()
    expect(screen.getByText(/8 confirmed/i)).toBeInTheDocument()
  })

  it('renders upload PDF link', async () => {
    renderWithRouter()
    expect(await screen.findByRole('link', { name: /upload pdf/i })).toBeInTheDocument()
  })

  it('renders Review link per batch', async () => {
    renderWithRouter()
    expect(await screen.findByRole('link', { name: /review/i })).toBeInTheDocument()
  })
})
