import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SettingsLLMActivity from './SettingsLLMActivity'

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SettingsLLMActivity />
    </QueryClientProvider>,
  )
}

describe('SettingsLLMActivity', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('LLM Activity')).toBeInTheDocument()
  })

  it('renders log rows after load', async () => {
    renderPage()
    // Duration is only in table rows, not in filter options
    expect(await screen.findByText(/420 ms/)).toBeInTheDocument()
  })

  it('shows backend and model in rows', async () => {
    renderPage()
    await screen.findByText(/420 ms/)
    // "qwen2.5:1.5b" only appears in table rows
    expect(screen.getAllByText('qwen2.5:1.5b')).toHaveLength(1)
  })

  it('shows success badge for succeeded row', async () => {
    renderPage()
    await screen.findByText(/420 ms/)
    // The badge text "ok" and "failed" appear in the status column
    expect(screen.getByText('ok')).toBeInTheDocument()
  })

  it('shows duration in ms', async () => {
    renderPage()
    expect(await screen.findByText(/420 ms/)).toBeInTheDocument()
  })

  it('expands payload summary on click', async () => {
    renderPage()
    await screen.findByText(/420 ms/)
    const toggles = screen.getAllByRole('button', { name: /toggle payload summary/i })
    fireEvent.click(toggles[0])
    await waitFor(() => {
      // Expanded JSON will contain the payee key from fixture
      expect(screen.getByText(/Zomato/)).toBeInTheDocument()
    })
  })

  it('operation filter select is present', () => {
    renderPage()
    expect(screen.getByLabelText('Operation')).toBeInTheDocument()
  })

  it('backend filter select is present', () => {
    renderPage()
    expect(screen.getByLabelText('Backend')).toBeInTheDocument()
  })
})
