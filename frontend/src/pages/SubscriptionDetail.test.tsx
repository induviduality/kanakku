import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import SubscriptionDetail from './SubscriptionDetail'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useParams: () => ({ subId: 'sub-1' }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('SubscriptionDetail page', () => {
  it('shows loading while fetching', () => {
    renderWithQuery(<SubscriptionDetail />)
    expect(screen.getByText(/loading subscription/i)).toBeInTheDocument()
  })

  it('renders subscription name and status', async () => {
    renderWithQuery(<SubscriptionDetail />)
    await waitFor(() => expect(screen.getByText('Netflix')).toBeInTheDocument())
    expect(screen.getByLabelText('status: upcoming')).toBeInTheDocument()
  })

  it('lists linked transactions', async () => {
    renderWithQuery(<SubscriptionDetail />)
    await waitFor(() => screen.getByText('Netflix'))
    await waitFor(() => expect(screen.getByText('May salary')).toBeInTheDocument())
  })

  it('shows empty state when no history', async () => {
    server.use(
      http.get('/api/v1/subscriptions/:subId/history', () => HttpResponse.json([])),
    )
    renderWithQuery(<SubscriptionDetail />)
    await waitFor(() => screen.getByText('Netflix'))
    await waitFor(() =>
      expect(
        screen.getByText(/no transactions linked/i),
      ).toBeInTheDocument(),
    )
  })

  it('shows 404 message when subscription not found', async () => {
    server.use(
      http.get('/api/v1/subscriptions/:subId', () =>
        HttpResponse.json({ detail: 'Subscription not found' }, { status: 404 }),
      ),
    )
    renderWithQuery(<SubscriptionDetail />)
    await waitFor(() =>
      expect(screen.getByText(/subscription not found/i)).toBeInTheDocument(),
    )
  })
})
