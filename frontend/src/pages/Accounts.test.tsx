import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Accounts from './Accounts'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

describe('Accounts page', () => {
  it('renders account list', async () => {
    renderWithQuery(<Accounts />)
    await waitFor(() => expect(screen.getByText('HDFC Savings')).toBeInTheDocument())
  })

  it('shows loading state initially', () => {
    renderWithQuery(<Accounts />)
    expect(screen.getByText(/loading accounts/i)).toBeInTheDocument()
  })

  it('shows add account button', async () => {
    renderWithQuery(<Accounts />)
    await waitFor(() => expect(screen.getByRole('button', { name: /add account/i })).toBeInTheDocument())
  })

  it('opens create modal when Add account is clicked', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Accounts />)
    await waitFor(() => screen.getByRole('button', { name: /add account/i }))
    await user.click(screen.getByRole('button', { name: /add account/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('creates a new account via the form', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Accounts />)
    await waitFor(() => screen.getByRole('button', { name: /add account/i }))
    await user.click(screen.getByRole('button', { name: /add account/i }))
    await waitFor(() => screen.getByLabelText(/^name$/i))

    await user.type(screen.getByLabelText(/^name$/i), 'SBI Account')
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('shows payment methods panel when toggled', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Accounts />)
    await waitFor(() => screen.getByText('HDFC Savings'))

    await user.click(screen.getByRole('button', { name: /payment methods for HDFC Savings/i }))
    await waitFor(() => expect(screen.getByText(/payment methods/i)).toBeInTheDocument())
  })

  it('shows empty state when no accounts', async () => {
    server.use(http.get('/api/v1/accounts', () => HttpResponse.json([])))
    renderWithQuery(<Accounts />)
    await waitFor(() => expect(screen.getByText(/no accounts yet/i)).toBeInTheDocument())
  })

  it('deletes an account after confirm', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Accounts />)
    await waitFor(() => screen.getByText('HDFC Savings'))

    const deleteBtn = screen.getByRole('button', { name: /^delete$/i })
    await user.click(deleteBtn)
    await waitFor(() => screen.getByRole('dialog'))

    const confirmBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i })
    await user.click(confirmBtn)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
