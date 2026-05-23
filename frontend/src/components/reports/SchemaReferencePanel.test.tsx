import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SchemaReferencePanel from './SchemaReferencePanel'

function renderPanel(onColumnClick?: (col: string, tbl: string) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SchemaReferencePanel onColumnClick={onColumnClick} />
    </QueryClientProvider>,
  )
}

describe('SchemaReferencePanel', () => {
  it('renders panel heading', () => {
    renderPanel()
    expect(screen.getByText('Schema Reference')).toBeInTheDocument()
  })

  it('renders search input', () => {
    renderPanel()
    expect(screen.getByRole('textbox', { name: /search schema/i })).toBeInTheDocument()
  })

  it('loads and shows tables', async () => {
    renderPanel()
    expect(await screen.findByText('transactions')).toBeInTheDocument()
    expect(screen.getByText('accounts')).toBeInTheDocument()
  })

  it('expands table to show columns', async () => {
    renderPanel()
    const txnBtn = await screen.findByRole('button', { name: /transactions/i })
    fireEvent.click(txnBtn)
    await waitFor(() => {
      expect(screen.getByText('amount')).toBeInTheDocument()
    })
  })

  it('calls onColumnClick when column is clicked', async () => {
    const spy = vi.fn()
    renderPanel(spy)
    const txnBtn = await screen.findByRole('button', { name: /transactions/i })
    fireEvent.click(txnBtn)
    await waitFor(() => screen.getByText('amount'))
    fireEvent.click(screen.getByText('amount'))
    expect(spy).toHaveBeenCalledWith('amount', 'transactions')
  })
})
