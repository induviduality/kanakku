import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { renderWithQuery } from '../test/render-utils'
import { PeriodContext } from '../lib/period-context'
import Splits from './Splits'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

const mockPeriodContext = {
  period: 'May 2026',
  setPeriod: () => {},
  dashboardParams: {
    start_date: '2026-05-01',
    end_date: '2026-05-31',
  },
  shortLabel: 'May 26',
}

function renderSplits() {
  return renderWithQuery(
    <PeriodContext.Provider value={mockPeriodContext as any}>
      <Splits />
    </PeriodContext.Provider>,
  )
}

describe('Splits page', () => {
  it('renders unsettled and all splits sections', async () => {
    renderSplits()

    await waitFor(() => {
      expect(screen.getByText(/Unsettled/i)).toBeInTheDocument()
    })
    
    expect(screen.getAllByText(/Dinner at Taj/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Weekend trip fuel/i).length).toBeGreaterThan(0)
  })

  it('shows empty states when no splits exist', async () => {
    server.use(
      http.get('/api/v1/splits', () => {
        return HttpResponse.json([])
      }),
    )

    renderSplits()

    await waitFor(() => {
      expect(screen.getByText(/No unsettled splits/i)).toBeInTheDocument()
      expect(screen.getByText(/No splits in this period/i)).toBeInTheDocument()
    })
  })

  it('opens split drawer when a split is clicked', async () => {
    const user = userEvent.setup()
    renderSplits()

    await waitFor(() => screen.getAllByText(/Dinner at Taj/i).length > 0)

    // Click the split card
    const splitCards = screen.getAllByText(/Dinner at Taj/i)
    await user.click(splitCards[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // Now there should be one more "Dinner at Taj" for the drawer title
      expect(screen.getAllByText(/Dinner at Taj/i).length).toBeGreaterThan(1)
    })
  })
})
