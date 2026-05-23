import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import Reports from './Reports'

function renderPage() {
  const rootRoute = createRootRoute({ component: Reports })
  const router = createRouter({ routeTree: rootRoute })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('Reports', () => {
  it('renders page title', async () => {
    renderPage()
    expect(await screen.findByText('Reports')).toBeInTheDocument()
  })

  it('renders create button', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /new dashboard/i })).toBeInTheDocument()
  })

  it('loads and displays dashboards', async () => {
    renderPage()
    expect(await screen.findByText('Spending Overview')).toBeInTheDocument()
  })

  it('shows create form when button clicked', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: /new dashboard/i })
    fireEvent.click(btn)
    expect(await screen.findByRole('textbox', { name: /dashboard name/i })).toBeInTheDocument()
  })

  it('create form has name and description inputs', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: /new dashboard/i })
    fireEvent.click(btn)
    expect(screen.getByRole('textbox', { name: /dashboard name/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /dashboard description/i })).toBeInTheDocument()
  })

  it('open dashboard link is present', async () => {
    renderPage()
    await screen.findByText('Spending Overview')
    expect(screen.getByRole('link', { name: /open dashboard/i })).toBeInTheDocument()
  })

  it('delete button is present for each dashboard', async () => {
    renderPage()
    await screen.findByText('Spending Overview')
    expect(
      screen.getByRole('button', { name: /delete dashboard spending overview/i }),
    ).toBeInTheDocument()
  })

  it('cancel hides the create form', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: /new dashboard/i })
    fireEvent.click(btn)
    const cancel = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancel)
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /dashboard name/i })).not.toBeInTheDocument()
    })
  })
})
