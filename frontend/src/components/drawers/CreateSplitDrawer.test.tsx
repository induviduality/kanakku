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
    expect(screen.queryByText('Expense transactions')).not.toBeInTheDocument()
  })

  it('renders sections and the expense list when open', async () => {
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    expect(screen.getByText('Expense transactions')).toBeInTheDocument()
    expect(screen.getByLabelText('My share amount')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add payee/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Gym membership')).toBeInTheDocument())
  })

  it('disables submit until an expense is selected and shares balance', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    const submit = screen.getByRole('button', { name: 'Create Split' })
    expect(submit).toBeDisabled()

    await waitFor(() => screen.getByText('Gym membership')) // 2500.00
    await user.click(screen.getByText('Gym membership'))

    // Selected but shares don't add up yet
    expect(submit).toBeDisabled()
    expect(screen.getByText('Total selected:')).toBeInTheDocument()

    await user.type(screen.getByLabelText('My share amount'), '2500')
    await waitFor(() => expect(submit).toBeEnabled())
  })

  it('excludes already-split expenses from the picker', async () => {
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)
    await waitFor(() => screen.getByText('Gym membership'))
    // Already-split expenses are excluded entirely from the picker
    expect(screen.queryByText('Dinner at Taj')).not.toBeInTheDocument()
  })

  it('submits an atomic payload with my share + a payee share and reports the new id', async () => {
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
    await user.click(screen.getByText('Gym membership')) // 2500.00
    await user.type(screen.getByLabelText('My share amount'), '1500')

    // Add a payee share for 1000
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

  it('shows an inline error and blocks submit when forgiven exceeds the share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CreateSplitDrawer open onClose={vi.fn()} />)

    await waitFor(() => screen.getByText('Gym membership'))
    await user.click(screen.getByText('Gym membership')) // 2500
    await user.type(screen.getByLabelText('My share amount'), '1500')

    await user.click(screen.getByRole('button', { name: /add payee/i }))
    await user.type(screen.getByRole('combobox'), 'Rahul')
    await user.click(await screen.findByRole('option', { name: 'Rahul' }))
    await user.type(screen.getByLabelText('Amount owed'), '1000')

    await user.click(screen.getByRole('button', { name: /forgive part of this share/i }))
    await user.type(screen.getByLabelText('Forgiven amount'), '1200') // > 1000

    expect(screen.getByRole('alert')).toHaveTextContent(/cannot exceed this payee/i)
    expect(screen.getByRole('button', { name: 'Create Split' })).toBeDisabled()
  })
})
