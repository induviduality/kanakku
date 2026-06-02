import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { renderWithQuery } from '../test/render-utils'
import { PeriodContext } from '../lib/period-context'
import { SplitsPendingPage, SplitsHistoryPage } from './SplitsAll'

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

function renderPendingSplits() {
  return renderWithQuery(
    <PeriodContext.Provider value={mockPeriodContext as any}>
      <SplitsPendingPage />
    </PeriodContext.Provider>,
  )
}

function renderHistorySplits() {
  return renderWithQuery(
    <PeriodContext.Provider value={mockPeriodContext as any}>
      <SplitsHistoryPage />
    </PeriodContext.Provider>,
  )
}

describe('SplitsAll pages', () => {
  it('renders pending splits page', async () => {
    renderPendingSplits()

    await waitFor(() => {
      expect(screen.getByText('Unsettled Splits')).toBeInTheDocument()
    })
    
    // Dinner at Taj has pending shares
    expect(screen.getByText(/Dinner at Taj/i)).toBeInTheDocument()
    // Weekend trip fuel is also unsettled because owner's share is pending
    expect(screen.getByText(/Weekend trip fuel/i)).toBeInTheDocument()
  })

  it('renders history splits page', async () => {
    renderHistorySplits()

    await waitFor(() => {
      expect(screen.getByText('All Splits')).toBeInTheDocument()
    })
    
    expect(screen.getByText(/Dinner at Taj/i)).toBeInTheDocument()
    expect(screen.getByText(/Weekend trip fuel/i)).toBeInTheDocument()
  })

  it('shows empty states for pending splits', async () => {
    server.use(
      http.get('/api/v1/splits', () => {
        return HttpResponse.json([])
      }),
    )

    renderPendingSplits()

    await waitFor(() => {
      expect(screen.getByText(/No unsettled splits/i)).toBeInTheDocument()
    })
  })

  it('shows empty states for history splits', async () => {
    server.use(
      http.get('/api/v1/splits', () => {
        return HttpResponse.json([])
      }),
    )

    renderHistorySplits()

    await waitFor(() => {
      expect(screen.getByText(/No splits in this period/i)).toBeInTheDocument()
    })
  })

  it('opens split drawer when a split is clicked', async () => {
    const user = userEvent.setup()
    renderHistorySplits()

    await waitFor(() => screen.getAllByText(/Dinner at Taj/i).length > 0)

    // Click the split card
    const splitCards = screen.getAllByText(/Dinner at Taj/i)
    await user.click(splitCards[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getAllByText(/Dinner at Taj/i).length).toBeGreaterThan(1)
    })
  })
})
