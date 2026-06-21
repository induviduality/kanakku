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
})
