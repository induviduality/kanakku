import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { apiPost as apiPostAuthed } from '../lib/api-client'
import { clearAuth, getRefreshToken, storeTokens } from '../lib/auth-storage'

const API_BASE = '/api/v1'

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw res
  return res.json() as Promise<T>
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface InviteInfo {
  expires_at: string
  email: string | null
}

export async function fetchInviteInfo(token: string): Promise<InviteInfo> {
  const res = await fetch(`${API_BASE}/auth/invites/${token}/info`)
  if (!res.ok) throw res
  return res.json() as Promise<InviteInfo>
}

export function useSetup() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiPost<TokenResponse>('/auth/setup', { email, password }),
    onSuccess: (data) => storeTokens(data.access_token, data.refresh_token),
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiPost<TokenResponse>('/auth/login', { email, password }),
    onSuccess: (data) => storeTokens(data.access_token, data.refresh_token),
  })
}

/**
 * Clears local auth state and navigates to /login immediately, then
 * best-effort revokes the refresh token server-side — a slow or failed
 * revoke call should never delay the user actually being signed out.
 */
export function useLogout() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: async () => {
      const refreshToken = getRefreshToken()
      clearAuth()
      void navigate({ to: '/login' })
      if (refreshToken) {
        await apiPostAuthed('/auth/logout', { refresh_token: refreshToken }).catch(() => {})
      }
    },
  })
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: ({
      token,
      email,
      password,
    }: {
      token: string
      email: string
      password: string
    }) => apiPost<TokenResponse>('/auth/accept-invite', { token, email, password }),
    onSuccess: (data) => storeTokens(data.access_token, data.refresh_token),
  })
}
