import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import GPayImport from './GPayImport'

function renderWithRouter() {
  const rootRoute = createRootRoute({ component: GPayImport })
  const router = createRouter({ routeTree: rootRoute })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('GPayImport', () => {
  it('renders page title', async () => {
    renderWithRouter()
    expect(await screen.findByText(/Import GPay Takeout/i)).toBeInTheDocument()
  })

  it('renders file input', async () => {
    renderWithRouter()
    expect(await screen.findByLabelText(/Takeout JSON file/i)).toBeInTheDocument()
  })

  it('upload button is disabled when no file selected', async () => {
    renderWithRouter()
    const btn = await screen.findByRole('button', { name: /upload/i })
    expect(btn).toBeDisabled()
  })

  it('renders link to review pending', async () => {
    renderWithRouter()
    expect(await screen.findByRole('link', { name: /Review pending/i })).toBeInTheDocument()
  })

  it('renders link to view orphans', async () => {
    renderWithRouter()
    expect(await screen.findByRole('link', { name: /View orphans/i })).toBeInTheDocument()
  })
})
