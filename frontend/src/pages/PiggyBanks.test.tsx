import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import PiggyBanks from './PiggyBanks'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('PiggyBanks page', () => {
  it('shows loading state initially', () => {
    renderWithQuery(<PiggyBanks />)
    expect(screen.getByText(/loading piggy banks/i)).toBeInTheDocument()
  })

  it('renders piggy bank list', async () => {
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => expect(screen.getByText('Europe Trip')).toBeInTheDocument())
  })

  it('progress ring matches data', async () => {
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Europe Trip'))
    // progress_pct = 30 in fixture
    expect(screen.getByLabelText('30% progress')).toBeInTheDocument()
  })

  it('shows empty state when no piggy banks', async () => {
    server.use(http.get('/api/v1/piggy-banks', () => HttpResponse.json([])))
    renderWithQuery(<PiggyBanks />)
    await waitFor(() =>
      expect(screen.getByText(/no piggy banks yet/i)).toBeInTheDocument(),
    )
  })

  it('opens create form on Add piggy bank click', async () => {
    const user = userEvent.setup()
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByRole('button', { name: /add piggy bank/i }))
    await user.click(screen.getByRole('button', { name: /add piggy bank/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('shows amount and target', async () => {
    renderWithQuery(<PiggyBanks />)
    await waitFor(() => screen.getByText('Europe Trip'))
    expect(screen.getByText(/60000/)).toBeInTheDocument()
    expect(screen.getByText(/200000/)).toBeInTheDocument()
  })
})
