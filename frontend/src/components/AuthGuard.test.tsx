import { screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AuthGuard from './AuthGuard'
import { renderWithQuery } from '../test/render-utils'
import { clearAccessToken, setAccessToken } from '../lib/auth-storage'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('AuthGuard', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    clearAccessToken()
  })

  it('redirects to /login when not authenticated', () => {
    renderWithQuery(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    )
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login' })
  })

  it('renders children when authenticated', () => {
    setAccessToken('valid-token')
    renderWithQuery(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
