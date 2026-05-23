import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import PiggyBankDetail from './PiggyBankDetail'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useParams: () => ({ piggyId: 'pig-1' }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('PiggyBankDetail page', () => {
  it('shows loading while fetching', () => {
    renderWithQuery(<PiggyBankDetail />)
    expect(screen.getByText(/loading piggy bank/i)).toBeInTheDocument()
  })

  it('renders piggy bank name and progress ring', async () => {
    renderWithQuery(<PiggyBankDetail />)
    await waitFor(() => expect(screen.getByText('Europe Trip')).toBeInTheDocument())
    expect(screen.getByLabelText('30% progress')).toBeInTheDocument()
  })

  it('lists contributions', async () => {
    renderWithQuery(<PiggyBankDetail />)
    await waitFor(() => screen.getByText('Europe Trip'))
    await waitFor(() => expect(screen.getByText('60000.00')).toBeInTheDocument())
    expect(screen.getByText('expense')).toBeInTheDocument()
  })

  it('shows empty state when no contributions', async () => {
    server.use(
      http.get('/api/v1/piggy-banks/:piggyId/contributions', () => HttpResponse.json([])),
    )
    renderWithQuery(<PiggyBankDetail />)
    await waitFor(() => screen.getByText('Europe Trip'))
    await waitFor(() =>
      expect(screen.getByText(/no contributions yet/i)).toBeInTheDocument(),
    )
  })

  it('add contribution button opens form', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBankDetail />)
    await waitFor(() => screen.getByText('Europe Trip'))
    await waitFor(() => screen.getByRole('button', { name: /add contribution/i }))
    await user.click(screen.getByRole('button', { name: /add contribution/i }))
    expect(screen.getByLabelText(/transaction id/i)).toBeInTheDocument()
  })

  it('add contribution refetches piggy bank', async () => {
    const user = userEvent.setup()
    let fetchCount = 0
    server.use(
      http.get('/api/v1/piggy-banks/:piggyId', () => {
        fetchCount++
        return HttpResponse.json({
          id: 'pig-1',
          user_id: 'user-1',
          name: 'Europe Trip',
          target_amount: '200000.00',
          currency: 'INR',
          current_amount: fetchCount > 1 ? '65000.00' : '60000.00',
          target_date: null,
          notes: null,
          is_completed: false,
          progress_pct: fetchCount > 1 ? 32.5 : 30,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          deleted_at: null,
        })
      }),
    )
    renderWithQuery(<PiggyBankDetail />)
    await waitFor(() => screen.getByText('Europe Trip'))
    await waitFor(() => screen.getByRole('button', { name: /add contribution/i }))
    await user.click(screen.getByRole('button', { name: /add contribution/i }))

    await user.type(screen.getByLabelText(/transaction id/i), 'txn-1')
    await user.clear(screen.getByLabelText(/amount/i))
    await user.type(screen.getByLabelText(/amount/i), '5000')
    await user.click(screen.getByRole('button', { name: /^add$/i }))

    // Verify the mutation fired (onSuccess invalidates query → refetch)
    await waitFor(() => expect(fetchCount).toBeGreaterThan(1))
  })

  it('shows not found when piggy bank missing', async () => {
    server.use(
      http.get('/api/v1/piggy-banks/:piggyId', () =>
        HttpResponse.json({ detail: 'Not found' }, { status: 404 }),
      ),
    )
    renderWithQuery(<PiggyBankDetail />)
    await waitFor(() =>
      expect(screen.getByText(/piggy bank not found/i)).toBeInTheDocument(),
    )
  })
})
