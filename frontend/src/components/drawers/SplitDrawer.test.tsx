import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SplitDrawer } from './SplitDrawer'
import { renderWithQuery } from '../../test/render-utils'
import { server } from '../../test/server'
import { http, HttpResponse } from 'msw'

describe('SplitDrawer component', () => {
  it('shows loading state initially', () => {
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)
    const loaders = screen.getAllByClassName ? screen.getAllByClassName('animate-pulse') : document.querySelectorAll('.animate-pulse')
    expect(loaders.length).toBeGreaterThan(0)
  })

  it('renders split detail, summary, and shares correctly', async () => {
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    // Wait for the drawer title / notes to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument()
    })

    // Check summary panel values
    expect(screen.getByText('Total expense')).toBeInTheDocument()
    expect(screen.getByText('Your net expense')).toBeInTheDocument()
    // own (900) + Priya forgiven (900) = 1800
    expect(screen.getByText('₹1,800')).toBeInTheDocument()

    // Check shares
    expect(screen.getByText('My share')).toBeInTheDocument()
    expect(screen.getByText('Rahul')).toBeInTheDocument()
    expect(screen.getByText('Priya')).toBeInTheDocument()
    expect(screen.getByText('Neel')).toBeInTheDocument()
  })

  it('handles forgiving a share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument())

    // Click "Forgive" under My share (pending with 900 remaining)
    const forgiveButtons = screen.getAllByText('Forgive')
    await user.click(forgiveButtons[0])

    expect(screen.getByText('Forgive amount')).toBeInTheDocument()
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveValue(900) // remaining amount

    const setForgivenButton = screen.getByRole('button', { name: /set forgiven/i })
    await user.click(setForgivenButton)

    // Verify it closes form after saving
    await waitFor(() => {
      expect(screen.queryByText('Forgive amount')).not.toBeInTheDocument()
    })
  })

  it('handles linking a payment (settling)', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument())

    // Click "+ Add payment" under My share
    const addPaymentButtons = screen.getAllByText('+ Add payment')
    await user.click(addPaymentButtons[0])

    expect(screen.getByText('Link income transaction')).toBeInTheDocument()
    const select = screen.getByRole('combobox')
    
    // Select an income transaction
    await user.selectOptions(select, 'txn-may-salary')

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.queryByText('Link income transaction')).not.toBeInTheDocument()
    })
  })

  it('handles resetting a share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument())

    // Click "Reset" on the share that has activity (Priya has forgiven_amount = 900)
    const resetButtons = screen.getAllByText('Reset')
    await user.click(resetButtons[0])

    // Verify confirm dialog opens
    expect(screen.getByText('Reset share')).toBeInTheDocument()
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.queryByText('Reset share')).not.toBeInTheDocument()
    })
  })

  it('handles unlinking a settlement', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument())

    const unlinkButton = screen.getByTitle('Unlink this payment')
    expect(unlinkButton).toBeInTheDocument()

    await user.click(unlinkButton)

    // Unlinking triggers immediately and does not open a dialog, wait for mutations
    await waitFor(() => {
      expect(unlinkButton).not.toBeDisabled()
    })
  })

  it('shows error state when split is not found', async () => {
    renderWithQuery(<SplitDrawer splitId="not-found" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Split not found.')).toBeInTheDocument()
    })
  })
})
