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
    renderWithQuery(<Transactions />)
    expect(screen.getByText(/loading transactions/i)).toBeInTheDocument()
  })

  it('renders transaction list', async () => {
    renderWithQuery(<Transactions />)
    await waitFor(() =>
      expect(screen.getAllByText('Coffee').length).toBeGreaterThan(0),
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
    await waitFor(() => screen.getAllByText('Coffee').length > 0)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
  })

  it('opens delete confirm dialog', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByText('Coffee').length > 0)

    // Click first Delete button
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i })
    await user.click(deleteButtons[0])
    await waitFor(() =>
      expect(screen.getByRole('dialog')).toBeInTheDocument(),
    )
  })

  it('deletes transaction after confirm', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Transactions />)
    await waitFor(() => screen.getAllByText('Coffee').length > 0)

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
})
