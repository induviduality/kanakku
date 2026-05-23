import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import TransactionFormComponent from '../components/forms/TransactionForm'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'
import { ACCOUNTS_RESPONSE, CATEGORIES_RESPONSE, TAGS_RESPONSE, PAYEES_RESPONSE } from '../test/handlers'

describe('TransactionForm component', () => {
  it('renders all core fields', async () => {
    renderWithQuery(<TransactionFormComponent onSubmit={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText(/date & time/i)).toBeInTheDocument())
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^account/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
  })

  it('renders type toggle with expense selected by default', async () => {
    renderWithQuery(<TransactionFormComponent onSubmit={vi.fn()} />)
    await waitFor(() => screen.getByRole('group', { name: /transaction type/i }))
    const expenseBtn = screen.getByRole('button', { name: /expense/i })
    expect(expenseBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows destination account field when transfer is selected', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TransactionFormComponent onSubmit={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: /transfer/i }))
    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await waitFor(() => expect(screen.getByLabelText(/to account/i)).toBeInTheDocument())
  })

  it('hides payee and categories fields for transfers', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TransactionFormComponent onSubmit={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: /transfer/i }))
    await user.click(screen.getByRole('button', { name: /transfer/i }))
    await waitFor(() => {
      expect(screen.queryByLabelText(/payee/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/categories/i)).not.toBeInTheDocument()
    })
  })

  it('shows categories when expense is selected', async () => {
    renderWithQuery(<TransactionFormComponent onSubmit={vi.fn()} />)
    await waitFor(() =>
      expect(screen.getByText(CATEGORIES_RESPONSE[0].name)).toBeInTheDocument(),
    )
  })

  it('auto-populates categories when a payee with defaults is selected', async () => {
    renderWithQuery(<TransactionFormComponent onSubmit={vi.fn()} />)
    await waitFor(() => screen.getByLabelText(/payee/i))

    // Type into the payee autocomplete to trigger the dropdown
    const payeeInput = screen.getByLabelText(/payee/i)
    await userEvent.type(payeeInput, 'Swi')
    await waitFor(() => screen.getByRole('option', { name: /swiggy/i }))
    await userEvent.click(screen.getByRole('option', { name: /swiggy/i }))

    // The payee has default_category_ids: ['cat-1'] which maps to 'Food & Dining'
    await waitFor(() => {
      const catBtn = screen.getByRole('button', { name: CATEGORIES_RESPONSE[0].name })
      expect(catBtn).toHaveClass('bg-indigo-600')
    })
  })

  it('shows validation error when amount is missing', async () => {
    const user = userEvent.setup()
    renderWithQuery(<TransactionFormComponent onSubmit={vi.fn()} />)
    await waitFor(() => screen.getByRole('button', { name: /^save$/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/account is required/i),
    )
  })

  it('calls onSubmit with correct payload', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithQuery(<TransactionFormComponent onSubmit={onSubmit} submitLabel="Add transaction" />)

    await waitFor(() => screen.getByLabelText(/amount/i))

    // Fill in amount
    await user.clear(screen.getByLabelText(/amount/i))
    await user.type(screen.getByLabelText(/amount/i), '250')

    // Select account
    const accountSelect = screen.getByLabelText(/^account/i)
    await user.selectOptions(accountSelect, ACCOUNTS_RESPONSE[0].id)

    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    const [payload] = onSubmit.mock.calls[0]
    expect(payload.amount).toBe('250')
    expect(payload.account_id).toBe(ACCOUNTS_RESPONSE[0].id)
    expect(payload.type).toBe('expense')
  })
})
