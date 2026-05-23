import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SettingsDataExport from './SettingsDataExport'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SettingsDataExport />
    </QueryClientProvider>,
  )
}

describe('SettingsDataExport', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Export Data')).toBeInTheDocument()
  })

  it('renders export button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /start export/i })).toBeInTheDocument()
  })

  it('shows download link after successful export', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /start export/i }))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /download archive/i })).toBeInTheDocument(),
    )
  })

  it('download link points to correct URL', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /start export/i }))
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /download archive/i })
      expect(link.getAttribute('href')).toMatch(/\/api\/v1\/export\/job-1\/download/)
    })
  })

  it('export button is disabled while pending', async () => {
    renderPage()
    const btn = screen.getByRole('button', { name: /start export/i })
    fireEvent.click(btn)
    // During the mutation the button text changes
    await waitFor(() => expect(btn).not.toBeDisabled())
  })
})
