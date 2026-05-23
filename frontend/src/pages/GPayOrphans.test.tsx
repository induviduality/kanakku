import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import GPayOrphans from './GPayOrphans'

function renderWithRouter() {
  const rootRoute = createRootRoute({ component: GPayOrphans })
  const router = createRouter({ routeTree: rootRoute })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('GPayOrphans', () => {
  it('renders page title', async () => {
    renderWithRouter()
    expect(await screen.findByText('GPay Orphans')).toBeInTheDocument()
  })

  it('renders orphan merchant after load', async () => {
    renderWithRouter()
    expect(await screen.findByText(/Mystery shop/)).toBeInTheDocument()
  })

  it('renders orphan badge', async () => {
    renderWithRouter()
    await screen.findByText(/Mystery shop/)
    expect(screen.getByText('orphan')).toBeInTheDocument()
  })

  it('renders amount', async () => {
    renderWithRouter()
    await screen.findByText(/999/)
  })

  it('renders link back to upload', async () => {
    renderWithRouter()
    expect(await screen.findByRole('link', { name: /← Upload another/i })).toBeInTheDocument()
  })
})
