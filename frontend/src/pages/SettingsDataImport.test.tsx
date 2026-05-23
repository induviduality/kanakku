import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SettingsDataImport from './SettingsDataImport'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SettingsDataImport />
    </QueryClientProvider>,
  )
}

describe('SettingsDataImport', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Import Data')).toBeInTheDocument()
  })

  it('renders safety warning', () => {
    renderPage()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Warning/i)).toBeInTheDocument()
  })

  it('renders file input', () => {
    renderPage()
    expect(screen.getByLabelText(/select archive file/i)).toBeInTheDocument()
  })

  it('import button is disabled when no file selected', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /start import/i })).toBeDisabled()
  })

  it('import button enables after file selection', async () => {
    renderPage()
    const input = screen.getByLabelText(/select archive file/i)
    const file = new File(['fake-content'], 'archive.tar.gz', { type: 'application/gzip' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start import/i })).not.toBeDisabled(),
    )
  })

  it('shows success message after import', async () => {
    renderPage()
    const input = screen.getByLabelText(/select archive file/i)
    const file = new File(['fake'], 'archive.tar.gz', { type: 'application/gzip' })
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /start import/i }))
    await waitFor(() =>
      expect(screen.getByText(/import complete/i)).toBeInTheDocument(),
    )
  })

  it('shows total record count on success', async () => {
    renderPage()
    const input = screen.getByLabelText(/select archive file/i)
    const file = new File(['fake'], 'archive.tar.gz', { type: 'application/gzip' })
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /start import/i }))
    await waitFor(() =>
      expect(screen.getByText(/12 records loaded/i)).toBeInTheDocument(),
    )
  })
})
