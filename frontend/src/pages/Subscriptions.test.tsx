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

  it('can fill out and submit the create form', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByRole('button', { name: /add subscription/i }))
    await user.click(screen.getByRole('button', { name: /add subscription/i }))
    
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    await user.type(screen.getByLabelText(/^name$/i), 'Hulu')
    await user.type(screen.getByLabelText(/^amount$/i), '15')
    await user.clear(screen.getByLabelText(/^currency$/i))
    await user.type(screen.getByLabelText(/^currency$/i), 'USD')
    await user.selectOptions(screen.getByLabelText(/billing cycle/i), 'monthly')
    await user.type(screen.getByLabelText(/billing day/i), '5')
    
    // Select account
    await user.selectOptions(screen.getByLabelText(/account/i), 'acc-1')
    
    server.use(
      http.post('/api/v1/subscriptions', () => {
        return HttpResponse.json({ id: 'new-sub' })
      })
    )

    await user.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not submit form if accountId is missing', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByRole('button', { name: /add subscription/i }))
    await user.click(screen.getByRole('button', { name: /add subscription/i }))
    
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    await user.type(screen.getByLabelText(/^name$/i), 'Hulu')
    await user.type(screen.getByLabelText(/^amount$/i), '15')
    
    // Attempt to submit without selecting an account
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    // Dialog should stay open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('can cancel the create form', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByRole('button', { name: /add subscription/i }))
    await user.click(screen.getByRole('button', { name: /add subscription/i }))
    
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('can delete a subscription', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByText('Netflix'))
    
    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])
    
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/delete "Netflix"/i)).toBeInTheDocument()
    
    server.use(
      http.delete('/api/v1/subscriptions/:id', () => {
        return new HttpResponse(null, { status: 204 })
      })
    )

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('can cancel deleting a subscription', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Subscriptions />)
    await waitFor(() => screen.getByText('Netflix'))
    
    const deleteButtons = screen.getAllByTitle('Delete')
    await user.click(deleteButtons[0])
    
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
