import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Payees from './Payees'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

describe('Payees page', () => {
  it('renders payee list', async () => {
    renderWithQuery(<Payees />)
    // DataTable renders desktop + mobile views
    await waitFor(() => expect(screen.getAllByText('Swiggy').length).toBeGreaterThan(0))
  })

  it('shows search input', async () => {
    renderWithQuery(<Payees />)
    await waitFor(() => expect(screen.getByRole('searchbox', { name: /search payees/i })).toBeInTheDocument())
  })

  it('opens create modal', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Payees />)
    await waitFor(() => screen.getByRole('button', { name: /add payee/i }))
    await user.click(screen.getByRole('button', { name: /add payee/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('creates a payee', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Payees />)
    await waitFor(() => screen.getByRole('button', { name: /add payee/i }))
    await user.click(screen.getByRole('button', { name: /add payee/i }))
    await waitFor(() => screen.getByLabelText(/^name$/i))

    await user.type(screen.getByLabelText(/^name$/i), 'Zomato')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows empty state when no payees', async () => {
    server.use(http.get('/api/v1/payees', () => HttpResponse.json([])))
    renderWithQuery(<Payees />)
    await waitFor(() => expect(screen.getByText(/no payees found/i)).toBeInTheDocument())
  })

  it('opens edit modal', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Payees />)
    await waitFor(() => screen.getAllByText('Swiggy').length > 0)

    // Multiple Edit buttons — click first
    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Swiggy')).toBeInTheDocument()
  })

  it('deletes a payee after confirm', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Payees />)
    await waitFor(() => screen.getAllByText('Swiggy').length > 0)

    await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0])
    await waitFor(() => screen.getByRole('dialog'))

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i })
    await user.click(confirmBtn)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
