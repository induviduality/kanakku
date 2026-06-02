import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute } from '@tanstack/react-router'
import ImportUpload from './ImportUpload'

function renderPage() {
  const rootRoute = createRootRoute({ component: ImportUpload })
  const router = createRouter({ routeTree: rootRoute })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('ImportUpload', () => {
  it('renders form fields', async () => {
    renderPage()
    await waitFor(() => {
      expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/pdf password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/account/i)).toBeInTheDocument()
  })

  it('upload button is disabled when no file selected', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: /upload/i })
    expect(btn).toBeDisabled()
  })

  it('cancel link is present', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows account options from API', async () => {
    renderPage()
    expect(await screen.findByText('HDFC Savings')).toBeInTheDocument()
  })

  it('upload button enables after file is chosen', async () => {
    renderPage()
    let input: HTMLInputElement | null = null
    await waitFor(() => {
      input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input).toBeInTheDocument()
    })
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)
    const btn = screen.getByRole('button', { name: /upload/i })
    expect(btn).not.toBeDisabled()
  })
})
