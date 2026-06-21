import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
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
