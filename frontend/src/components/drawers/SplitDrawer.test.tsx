import { useState } from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SplitDrawer } from './SplitDrawer'
import { renderWithQuery } from '../../test/render-utils'
import { server } from '../../test/server'
import { http, HttpResponse } from 'msw'

describe('SplitDrawer component', () => {
  it('shows loading state initially', () => {
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)
    const loaders = document.querySelectorAll('.animate-pulse')
    expect(loaders.length).toBeGreaterThan(0)
  })

  it('renders split heading, summary panel, and collapsed share rows', async () => {
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument()
    })

    expect(screen.getByText('Total expense')).toBeInTheDocument()
    expect(screen.getByText('Your net expense')).toBeInTheDocument()

    // All four shares render as collapsed rows
    expect(screen.getByText('Your share')).toBeInTheDocument()
    expect(screen.getByText('Rahul')).toBeInTheDocument()
    expect(screen.getByText('Priya')).toBeInTheDocument()
    expect(screen.getByText('Neel')).toBeInTheDocument()

    // Action buttons are NOT visible until a row is expanded
    expect(screen.queryByText('Record payment')).not.toBeInTheDocument()
    expect(screen.queryByText('Forgive')).not.toBeInTheDocument()
  })

  it('expands a share row on click and shows action buttons', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())

    // Click Rahul's row to expand
    await user.click(screen.getByText('Rahul'))

    // Action buttons appear
    expect(screen.getByText('Record payment')).toBeInTheDocument()
    expect(screen.getByText('Forgive')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('expanding one share collapses the previously expanded share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())

    await user.click(screen.getByText('Rahul'))
    expect(screen.getByText('Record payment')).toBeInTheDocument()

    // Now expand Neel — Rahul's actions should disappear
    await user.click(screen.getByText('Neel'))
    await waitFor(() => {
      expect(screen.getAllByText('Record payment')).toHaveLength(1)
    })
    // Neel expanded, Rahul collapsed — still one "Record payment"
    expect(screen.getByText('Record payment')).toBeInTheDocument()
  })

  it('Your share row shows only Edit action, not Record payment or Forgive', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Your share')).toBeInTheDocument())
    await user.click(screen.getByText('Your share'))

    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.queryByText('Record payment')).not.toBeInTheDocument()
    expect(screen.queryByText('Forgive')).not.toBeInTheDocument()
  })

  it('handles forgiving a payee share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    await user.click(screen.getByText('Rahul'))

    await user.click(screen.getByText('Forgive'))
    expect(screen.getByText('Forgive amount')).toBeInTheDocument()

    const setButton = screen.getByRole('button', { name: /^set$/i })
    await user.click(setButton)

    await waitFor(() => {
      expect(screen.queryByText('Forgive amount')).not.toBeInTheDocument()
    })
  })

  it('handles linking a payment (settling) on a payee share', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    await user.click(screen.getByText('Rahul'))

    await user.click(screen.getByText('Record payment'))
    expect(screen.getByText('Link settlement')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('May salary')).toBeInTheDocument())
    await user.click(screen.getByText('May salary'))

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    await waitFor(() => expect(confirmButton).toBeEnabled())
    await user.click(confirmButton)

    await waitFor(() => {
      expect(screen.queryByText('Link settlement')).not.toBeInTheDocument()
    })
  })

  it('handles resetting a share that has activity', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Priya')).toBeInTheDocument())
    // Priya has forgiven_amount=900 so "Reset" should appear when expanded
    await user.click(screen.getByText('Priya'))

    await user.click(screen.getByText('Reset'))
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

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    // Rahul has a settlement — expand to see it
    await user.click(screen.getByText('Rahul'))

    const unlinkButton = screen.getByTitle('Unlink this payment')
    expect(unlinkButton).toBeInTheDocument()
    await user.click(unlinkButton)

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

  it('shows the metadata accordion collapsed by default and expandable', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Dinner at Taj' })).toBeInTheDocument())

    // "Details" button exists but content is hidden
    const detailsBtn = screen.getByRole('button', { name: /details/i })
    expect(detailsBtn).toBeInTheDocument()
    expect(screen.queryByText(/^ID:/)).not.toBeInTheDocument()

    await user.click(detailsBtn)
    await waitFor(() => {
      expect(screen.getByText(/^ID:/)).toBeInTheDocument()
    })
   })

  it('correctly calculates net expense (BUG-1: own share + payee forgiven amounts)', async () => {
    server.use(
      http.get('/api/v1/splits/:id', () => {
        return HttpResponse.json({
          id: 'split-custom',
          user_id: 'user-1',
          expense_transaction_ids: ['txn-custom'],
          notes: 'Custom Split',
          deleted_at: null,
          created_at: '2026-05-07T10:00:00Z',
          updated_at: '2026-05-12T10:00:00Z',
          shares: [
            {
              id: 'sh-custom-own',
              split_id: 'split-custom',
              payee_id: null,
              amount: '500.00',
              status: 'pending',
              paid_amount: '0.00',
              forgiven_amount: '0.00',
              settlements: [],
            },
            {
              id: 'sh-custom-rahul',
              split_id: 'split-custom',
              payee_id: 'payee-rahul',
              amount: '1000.00',
              status: 'pending',
              paid_amount: '300.00',
              forgiven_amount: '700.00',
              settlements: [],
            },
          ],
        })
      })
    )

    renderWithQuery(<SplitDrawer splitId="split-custom" onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText('₹1,200')).toBeInTheDocument() // 500 + 700 = 1200
    })
  })

  it('validates settle amount input and disables confirm button when invalid (BUG-3)', async () => {
    const user = userEvent.setup()
    renderWithQuery(<SplitDrawer splitId="split-dinner" onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    await user.click(screen.getByText('Rahul'))

    await user.click(screen.getByText('Record payment'))
    await waitFor(() => expect(screen.getByText('May salary')).toBeInTheDocument())
    await user.click(screen.getByText('May salary'))

    const confirmButton = screen.getByRole('button', { name: /confirm/i })
    const input = screen.getByLabelText('Amount to credit')

    // Pre-filled with remaining 450.00, wait for it to be enabled
    await waitFor(() => expect(confirmButton).toBeEnabled())

    // Clear and enter 500.00 (which is > remaining 450.00)
    await user.clear(input)
    await user.type(input, '500.00')
    expect(confirmButton).toBeDisabled()

    // Clear and enter 0
    await user.clear(input)
    await user.type(input, '0')
    expect(confirmButton).toBeDisabled()
  })

  it('resets drawer-level states when splitId changes (BUG-11)', async () => {
    const user = userEvent.setup()

    function TestWrapper() {
      const [splitId, setSplitId] = useState('split-dinner')
      console.log('TestWrapper rendering with splitId:', splitId)
      return (
        <div>
          <button onClick={() => {
            console.log('Switch button clicked!')
            setSplitId('split-fuel')
          }}>Switch to Fuel</button>
          <SplitDrawer splitId={splitId} onClose={vi.fn()} />
        </div>
      )
    }

    renderWithQuery(<TestWrapper />)

    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument())
    await user.click(screen.getByText('Rahul'))
    expect(screen.getByText('Record payment')).toBeInTheDocument() // Rahul is expanded

    const detailsBtn = screen.getByRole('button', { name: /details/i })
    await user.click(detailsBtn)
    expect(screen.getByText(/^ID:/)).toBeInTheDocument() // Details expanded

    const deleteBtn = screen.getByTitle('Delete split')
    await user.click(deleteBtn)
    expect(screen.getByText(/Remove this split\?/i)).toBeInTheDocument() // Delete dialog open

    // Switch splitId
    fireEvent.click(screen.getByText('Switch to Fuel'))

    // Wait for fuel split to load
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Weekend trip fuel' })).toBeInTheDocument())

    // Assert that states were reset
    expect(screen.queryByText('Record payment')).not.toBeInTheDocument() // Rahul collapsed
    expect(screen.queryByText(/^ID:/)).not.toBeInTheDocument() // Details collapsed
    expect(screen.queryByText(/Remove this split\?/i)).not.toBeInTheDocument() // Delete dialog closed
  })
})
