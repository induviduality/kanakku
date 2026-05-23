import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import Subscriptions from './Subscriptions'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'
import { SUBSCRIPTIONS_RESPONSE } from '../test/handlers'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

describe('Subscriptions page', () => {
  it('shows loading state initially', () => {
    renderWithQuery(<Subscriptions />)
    expect(screen.getByText(/loading subscriptions/i)).toBeInTheDocument()
  })

  it('renders subscription list', async () => {
    renderWithQuery(<Subscriptions />)
    await waitFor(() => expect(screen.getByText('Netflix')).toBeInTheDocument())
    expect(screen.getByText('Spotify')).toBeInTheDocument()
  })

  it('shows upcoming status badge in green', async () => {
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByText('Netflix'))
    const badge = screen.getByLabelText('status: upcoming')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('shows overdue status badge in red', async () => {
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByText('Spotify'))
    const badge = screen.getByLabelText('status: overdue')
    expect(badge).toHaveClass('bg-red-100')
    expect(badge).toHaveClass('text-red-800')
  })

  it('shows due_soon status badge in amber', async () => {
    server.use(
      http.get('/api/v1/subscriptions', () =>
        HttpResponse.json([{ ...SUBSCRIPTIONS_RESPONSE[0], status: 'due_soon' }]),
      ),
    )
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByText('Netflix'))
    const badge = screen.getByLabelText('status: due_soon')
    expect(badge).toHaveClass('bg-amber-100')
    expect(badge).toHaveClass('text-amber-800')
  })

  it('shows empty state when no subscriptions', async () => {
    server.use(http.get('/api/v1/subscriptions', () => HttpResponse.json([])))
    renderWithQuery(<Subscriptions />)
    await waitFor(() =>
      expect(screen.getByText(/no subscriptions yet/i)).toBeInTheDocument(),
    )
  })

  it('opens create form on Add subscription click', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByRole('button', { name: /add subscription/i }))
    await user.click(screen.getByRole('button', { name: /add subscription/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument()
  })

  it('shows next billing date', async () => {
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByText('Netflix'))
    expect(screen.getByText(/2026-05-15/)).toBeInTheDocument()
  })
})
