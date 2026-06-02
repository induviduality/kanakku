import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import AcceptInvite from './AcceptInvite'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

const mockNavigate = vi.fn()
let mockToken = 'valid-token'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearch: () => ({ token: mockToken }),
  }
})

describe('AcceptInvite page', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockToken = 'valid-token'
  })

  it('renders form after loading invite info', async () => {
    renderWithQuery(<AcceptInvite />)
    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('pre-fills email when invite has a locked email', async () => {
    mockToken = 'with-email-token'
    renderWithQuery(<AcceptInvite />)
    await waitFor(() =>
      expect(screen.getByLabelText(/email/i)).toHaveValue('preset@example.com'),
    )
  })

  it('shows expired message for 410 response', async () => {
    mockToken = 'expired-token'
    renderWithQuery(<AcceptInvite />)
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/expired or already been used/i),
    )
  })

  it('navigates to / on successful acceptance', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AcceptInvite />)

    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/' }))
  })

  it('shows error on API failure', async () => {
    server.use(
      http.post('/api/v1/auth/accept-invite', () =>
        HttpResponse.json({ detail: 'Email already registered' }, { status: 409 }),
      ),
    )
    const user = userEvent.setup()
    renderWithQuery(<AcceptInvite />)

    await waitFor(() => expect(screen.getByLabelText(/email/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/email/i), 'dup@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/could not accept invite/i),
    )
  })
})
