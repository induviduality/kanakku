import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute, createMemoryHistory } from '@tanstack/react-router'
import ImportReview from './ImportReview'

function renderPage(batchId = 'batch-1') {
  const rootRoute = createRootRoute()
  const reviewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/imports/$batchId',
    component: ImportReview,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([reviewRoute]),
    history: createMemoryHistory({ initialEntries: [`/imports/${batchId}`] }),
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}


describe('ImportReview', () => {
  it('shows loading then batch info', async () => {
    renderPage()
    expect(await screen.findByText('hdfc_jan_2026.pdf')).toBeInTheDocument()
  })

  it('shows verification status badge', async () => {
    renderPage()
    expect(await screen.findByText('verified')).toBeInTheDocument()
  })

  it('shows stats line', async () => {
    renderPage()
    expect(await screen.findByText('10')).toBeInTheDocument()
    expect(screen.getByText(/parsed/i)).toBeInTheDocument()
  })

  it('renders tab buttons', async () => {
    renderPage()
    expect(await screen.findByRole('tab', { name: /pending/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /confirmed/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /rejected/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /duplicate/i })).toBeInTheDocument()
  })

  it('renders record rows', async () => {
    renderPage()
    expect(await screen.findByText(/SWIGGY/i)).toBeInTheDocument()
    expect(screen.getByText(/350/i)).toBeInTheDocument()
  })

  it('confirm button is present on pending tab', async () => {
    renderPage()
    await screen.findByText('SWIGGY')
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
  })

  it('reject button is present on pending tab', async () => {
    renderPage()
    await screen.findByText('SWIGGY')
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('edit button shows inline form', async () => {
    renderPage()
    const editBtn = await screen.findByRole('button', { name: /edit/i })
    fireEvent.click(editBtn)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('switching tab clears selection', async () => {
    renderPage()
    await screen.findByText('SWIGGY')
    const confirmedTab = screen.getByRole('tab', { name: /confirmed/i })
    fireEvent.click(confirmedTab)
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
  })

  it('handles record selection and bulk confirm/reject actions', async () => {
    renderPage()
    await screen.findByText('SWIGGY')

    // Find select-all checkbox
    const selectAllCheckbox = screen.getByLabelText('select all')
    expect(selectAllCheckbox).toBeInTheDocument()
    expect(selectAllCheckbox).not.toBeChecked()

    // Toggle select all
    fireEvent.click(selectAllCheckbox)
    expect(selectAllCheckbox).toBeChecked()

    // Bulk buttons are present and clickable
    const bulkConfirmBtn = screen.getByRole('button', { name: /✓ confirm/i })
    const bulkRejectBtn = screen.getByRole('button', { name: /✕ reject/i })

    expect(bulkConfirmBtn).toBeEnabled()
    expect(bulkRejectBtn).toBeEnabled()

    // Click bulk confirm
    fireEvent.click(bulkConfirmBtn)
  })

  it('renders resolved and duplicate items correctly', async () => {
    renderPage()
    await screen.findByText('hdfc_jan_2026.pdf')
    
    // Switch to duplicates tab
    const duplicateTab = screen.getByRole('tab', { name: /duplicate/i })
    fireEvent.click(duplicateTab)

    // Wait for empty state or duplicate records
    await screen.findByText(/no duplicate records/i)
  })
})
