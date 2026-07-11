import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { TRANSACTIONS_RESPONSE } from '../../test/handlers'
import { renderWithQuery } from '../../test/render-utils'
import { CreateSplitDrawer } from './CreateSplitDrawer'

describe('CreateSplitDrawer', () => {
  it('does not render content when closed', () => {
    renderWithQuery(<CreateSplitDrawer open={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Expenses')).not.toBeInTheDocument()
  })

  it('renders Notes, Expenses, Shares sections and the expense list when open', async () => {
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Shares')).toBeInTheDocument()
    expect(screen.getByLabelText('Your share amount')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add payee/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Gym membership')).toBeInTheDocument())
  })

  it('disables submit until an expense is selected and shares balance', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    const submit = screen.getByRole('button', { name: 'Create Split' })
    expect(submit).toBeDisabled()

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))

    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Your share amount'), '2500')
    await waitFor(() => expect(submit).toBeEnabled())
  })

  it('hides Your share amount and excludes it from allocation when "not part of this split" is checked', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))
    await user.type(screen.getByLabelText('Your share amount'), '2500')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Split' })).toBeEnabled())

    await user.click(screen.getByText("I'm not part of this split"))
    expect(screen.queryByLabelText('Your share amount')).not.toBeInTheDocument()
    // No payee shares yet, so allocation drops to 0 and submit is disabled again.
    expect(screen.getByRole('button', { name: 'Create Split' })).toBeDisabled()

    await user.click(screen.getByText("I'm not part of this split"))
    expect(screen.getByLabelText('Your share amount')).toHaveValue(2500)
  })

  it('shows a standalone Done button next to the picker instead of relabeling Add expense', async () => {
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Gym membership'))
    // Picker is open by default in create mode.
    expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('excludes already-split expenses from the picker', async () => {
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Gym membership'))
    expect(screen.queryByText('Dinner at Taj')).not.toBeInTheDocument()
  })

  it('submits an atomic payload with your share + a payee share', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const onClose = vi.fn()
    let captured: any = null
    server.use(
      http.post('/api/v1/splits', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ id: 'new-split', shares: [] }, { status: 201 })
      }),
    )

    renderWithQuery(<CreateSplitDrawer open onClose={onClose} onCreated={onCreated} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))
    await user.type(screen.getByLabelText('Your share amount'), '1500')

    await user.click(screen.getByRole('button', { name: /add payee/i }))
    const combobox = screen.getByRole('combobox')
    await user.type(combobox, 'Rahul')
    await user.click(await screen.findByRole('option', { name: 'Rahul' }))
    await user.type(screen.getByLabelText('Amount owed'), '1000')

    const submit = screen.getByRole('button', { name: 'Create Split' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new-split'))
    expect(onClose).toHaveBeenCalled()
    expect(captured.expense_transaction_ids).toEqual(['txn-may-gym'])
    expect(captured.shares).toHaveLength(2)
    const own = captured.shares.find((s: any) => s.payee_id === null)
    const payee = captured.shares.find((s: any) => s.payee_id === 'payee-rahul')
    expect(own.amount).toBe('1500.00')
    expect(payee.amount).toBe('1000.00')
  })

  it('applies the amount of a transaction found via the year-long search tier', async () => {
    const user = userEvent.setup()
    // A transaction older than the 3-month window — only reachable via search.
    const oldTxn = {
      ...TRANSACTIONS_RESPONSE.items[0],
      id: 'txn-jan-movie',
      type: 'expense',
      transacted_at: '2026-01-06T10:00:00Z',
      amount: '1925.30',
      description: 'District movie ticket',
      payee_id: null,
      is_split: false,
      split_id: null,
    }
    server.use(
      http.get('/api/v1/transactions', ({ request }) => {
        const url = new URL(request.url)
        const type = url.searchParams.get('type')
        const from = url.searchParams.get('from')
        const q = url.searchParams.get('q')?.toLowerCase()
        let items = [...TRANSACTIONS_RESPONSE.items, oldTxn]
        if (type) items = items.filter((t) => t.type === type)
        if (from) items = items.filter((t) => t.transacted_at >= from)
        if (q) items = items.filter((t) => (t.description ?? '').toLowerCase().includes(q))
        return HttpResponse.json({ items, total: items.length, next_cursor: null })
      }),
      http.get('/api/v1/transactions/:id', ({ params }) => {
        const found = [...TRANSACTIONS_RESPONSE.items, oldTxn].find((t) => t.id === params.id)
        if (!found) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
        return HttpResponse.json(found)
      }),
    )

    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.type(screen.getByPlaceholderText('Search transactions…'), 'district')
    await user.click(await screen.findByText('District movie ticket'))

    // Selected row + total reflect the picked transaction's amount
    await waitFor(() => expect(screen.getByText('Total to split')).toBeInTheDocument())
    expect(screen.getAllByText(/1,925\.3/).length).toBeGreaterThan(0)

    // "Use remainder" fills the resolved amount, making the form submittable
    await user.click(screen.getByRole('button', { name: 'Use remainder' }))
    expect(screen.getByLabelText('Your share amount')).toHaveValue(1925.3)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Split' })).toBeEnabled())
  })

  it('does not show validation errors on a freshly added payee card', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByRole('button', { name: /add payee/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('auto-fills amount owed from a linked payment when the field is untouched', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))

    await user.click(screen.getByRole('button', { name: /add payee/i }))
    await user.type(screen.getByRole('combobox'), 'Rahul')
    await user.click(await screen.findByRole('option', { name: 'Rahul' }))

    // Amount owed left blank — link a payment without typing an amount first.
    await user.click(screen.getByRole('button', { name: /link payments/i }))
    await waitFor(() => screen.getByText('May salary'))
    await user.click(screen.getByText('May salary'))

    await waitFor(() => expect(screen.getByLabelText('Amount owed')).toHaveValue(85000))
    // Allocated total reacts to the auto-filled amount, not just the input.
    expect(screen.getByText('₹85,000 / ₹2,500')).toBeInTheDocument()

    // Unlinking brings it back down to the remaining linked total.
    await user.click(screen.getByRole('button', { name: 'Unlink payment' }))
    await waitFor(() => expect(screen.getByLabelText('Amount owed')).toHaveValue(0))
    expect(screen.getByText('₹0 / ₹2,500')).toBeInTheDocument()
  })

  it('shows an inline error when linked payments exceed the share amount', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership'))
    await user.type(screen.getByLabelText('Your share amount'), '1500')

    await user.click(screen.getByRole('button', { name: /add payee/i }))
    await user.type(screen.getByRole('combobox'), 'Rahul')
    await user.click(await screen.findByRole('option', { name: 'Rahul' }))
    await user.type(screen.getByLabelText('Amount owed'), '1000')

    // Open the link-payments panel
    await user.click(screen.getByRole('button', { name: /link payments/i }))

    // Select an income transaction (May salary = 85000 > 1000 share)
    await waitFor(() => screen.getByText('May salary'))
    await user.click(screen.getByText('May salary'))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/cannot exceed this payee/i)
    })
    expect(screen.getByRole('button', { name: 'Create Split' })).toBeDisabled()
  })
})
