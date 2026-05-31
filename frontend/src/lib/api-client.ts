import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth-storage'

const API_BASE = '/api/v1'

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

// Single in-flight refresh promise — coalesces concurrent 401s so we don't
// burn through refresh tokens by issuing one per dropped request.
let refreshInFlight: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) {
        clearAuth()
        return false
      }
      const data = (await res.json()) as { access_token: string; refresh_token: string }
      setAccessToken(data.access_token)
      setRefreshToken(data.refresh_token)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path}`
  let res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) } })
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) } })
    }
  }
  return res
}

async function parseJsonOrUndefined<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const len = res.headers.get('content-length')
  if (len === '0') return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await authedFetch(path, { method: 'GET' })
  if (!res.ok) throw res
  return parseJsonOrUndefined<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await authedFetch(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw res
  return parseJsonOrUndefined<T>(res)
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await authedFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw res
  return parseJsonOrUndefined<T>(res)
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await authedFetch(path, { method: 'DELETE' })
  if (!res.ok) throw res
  return parseJsonOrUndefined<T>(res)
}
