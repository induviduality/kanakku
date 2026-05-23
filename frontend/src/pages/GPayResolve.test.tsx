import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import GPayResolve from './GPayResolve'

function renderWithRouter() {
  const rootRoute = createRootRoute({ component: GPayResolve })
  const router = createRouter({ routeTree: rootRoute })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('GPayResolve', () => {
  it('renders page title', async () => {
    renderWithRouter()
    expect(await screen.findByText(/Pending GPay Matches/i)).toBeInTheDocument()
  })

  it('renders GPay merchant name after load', async () => {
    renderWithRouter()
    expect(await screen.findByText(/Zomato/)).toBeInTheDocument()
  })

  it('renders candidate radio buttons', async () => {
    renderWithRouter()
    await screen.findByText(/Zomato/)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
  })

  it('confirm button disabled until radio selected', async () => {
    renderWithRouter()
    await screen.findByText(/Zomato/)
    const btn = screen.getByRole('button', { name: /Confirm resolution/i })
    expect(btn).toBeDisabled()
  })

  it('confirm button enabled after selecting a candidate', async () => {
    renderWithRouter()
    await screen.findByText(/Zomato/)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[0])
    const btn = screen.getByRole('button', { name: /Confirm resolution/i })
    expect(btn).not.toBeDisabled()
  })

  it('resolves match and shows resolved state', async () => {
    renderWithRouter()
    await screen.findByText(/Zomato/)
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[0])
    const btn = screen.getByRole('button', { name: /Confirm resolution/i })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText(/Resolved/)).toBeInTheDocument()
    })
  })

  it('renders link back to upload', async () => {
    renderWithRouter()
    expect(await screen.findByRole('link', { name: /← Upload another/i })).toBeInTheDocument()
  })
})
