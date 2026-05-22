import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import Setup from './Setup'
import { renderWithQuery } from '../test/render-utils'
import { server } from '../test/server'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('Setup page', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('renders email and password fields', () => {
    renderWithQuery(<Setup />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('navigates to / on success', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Setup />)

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/' }))
  })

  it('shows error message on API failure', async () => {
    server.use(
      http.post('/api/v1/auth/setup', () =>
        HttpResponse.json({ detail: 'Setup already completed' }, { status: 404 }),
      ),
    )
    const user = userEvent.setup()
    renderWithQuery(<Setup />)

    await user.type(screen.getByLabelText(/email/i), 'admin@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/setup failed/i),
    )
  })

  it('button is enabled before submit', () => {
    renderWithQuery(<Setup />)
    expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled()
  })
})
