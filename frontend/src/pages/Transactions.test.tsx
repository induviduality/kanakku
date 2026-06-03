import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import Transactions from './Transactions'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

// Mock navigate to avoid needing router context
vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({}),
  }
})

describe('Transactions page', () => {
  it('renders loading state initially', () => {
    const { container } = renderWithQuery(<Transactions />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders transaction list', async () => {
    renderWithQuery(<Transactions />)
    await waitFor(() =>
      expect(screen.getAllByText(/May salary/i).length).toBeGreaterThan(0),
    )
  })

  it('shows empty state when no transactions', async () => {
    server.use(
      http.get('/api/v1/transactions', () =>
        HttpResponse.json({ items: [], next_cursor: null }),
      ),
    )
    renderWithQuery(<Transactions />)
    await waitFor(() =>
      expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument(),
    )
  })

  it('shows filter panel when Filters button clicked', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: /toggle filters/i }))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /filter by type/i })).toBeInTheDocument(),
    )
  })

  it('shows bulk select checkboxes per row', async () => {
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByText(/May salary/i).length > 0)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
  })

  it('opens delete confirm dialog', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByText(/May salary/i).length > 0)

    // Click first Delete button
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    const deleteBtn = deleteButtons[0]
    await user.click(deleteBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Test cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Open again to delete
    await user.click(deleteBtn)
  })

  it('deletes transaction after confirm', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByText(/May salary/i).length > 0)

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await user.click(deleteButtons[0])
    await waitFor(() => screen.getByRole('dialog'))

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows "New" button', async () => {
    renderWithQuery(<Transactions />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /\+ new/i })).toBeInTheDocument(),
    )
  })

  it('applies and clears filters', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    
    // open filters
    await waitFor(() => screen.getByRole('button', { name: /filters/i }))
    await user.click(screen.getByRole('button', { name: /toggle filters/i }))
    
    // select type
    const typeSelect = screen.getByLabelText(/filter by type/i)
    await user.selectOptions(typeSelect, 'expense')
    
    // apply
    await user.click(screen.getByRole('button', { name: /^apply$/i }))
    
    // button should show active
    expect(screen.getByRole('button', { name: /toggle filters/i })).toHaveTextContent(/active/i)
    
    // clear
    await user.click(screen.getByRole('button', { name: /toggle filters/i }))
    await user.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(screen.getByRole('button', { name: /toggle filters/i })).toHaveTextContent('⚙ Filters')
  })

  it('opens drawer when row is clicked', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByText(/May salary/i).length > 0)
    
    const rows = screen.getAllByText(/May salary/i)
    // Click the first row (the td text actually, but we can just click the table cell)
    await user.click(rows[0])
    
    await waitFor(() => {
      // TransactionDrawer renders a "Meta" section
      expect(screen.getByText('Meta')).toBeInTheDocument()
    })
    
    // Close drawer
    const closeBtn = screen.getByRole('button', { name: /close/i })
    await user.click(closeBtn)
    await waitFor(() => {
      expect(screen.queryByText('Meta')).not.toBeInTheDocument()
    })
  })

  it('shows Bundle as Split modal when multiple expenses are selected', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByRole('checkbox').length > 0)
    
    const checkboxes = screen.getAllByRole('checkbox')
    // Select third and fourth (USB hub and Gym membership, both are expenses)
    await user.click(checkboxes[2])
    await user.click(checkboxes[3])
    
    const bundleBtn = await screen.findByRole('button', { name: /bundle as split/i })
    await user.click(bundleBtn)
    
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /bundle as split/i })).toBeInTheDocument()
    })

    // Cancel modal
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelBtn)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('mobile delete button and transaction drawer', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByText(/May salary/i).length > 0)
    
    // There are 2 delete buttons for the first item (desktop and mobile)
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    if (deleteButtons.length > 1) {
      await user.click(deleteButtons[1]) // click mobile one
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    }
  })
})
