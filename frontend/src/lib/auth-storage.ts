// Access token lives in memory only — never persisted to disk.
let _accessToken: string | null = null

// Tiny pub-sub so React components can react to auth-state changes (e.g. when
// the api-client clears tokens after a failed refresh). Without this, the
// AuthGuard would not re-render and stale UI would stay mounted.
type Listener = () => void
const _listeners = new Set<Listener>()

function _emit(): void {
  for (const l of _listeners) l()
}

export function subscribeToAuth(listener: Listener): () => void {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

export function getAccessToken(): string | null {
  return _accessToken
}
export function setAccessToken(token: string): void {
  _accessToken = token
  _emit()
}
export function clearAccessToken(): void {
  _accessToken = null
  _emit()
}

// Refresh token persisted in localStorage so sessions survive page reloads.
const REFRESH_KEY = 'kanakku_refresh_token'

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token)
}
export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_KEY)
}

export function isAuthenticated(): boolean {
  return _accessToken !== null
}

export function storeTokens(access: string, refresh: string): void {
  setAccessToken(access)
  setRefreshToken(refresh)
}

export function clearAuth(): void {
  clearAccessToken()
  clearRefreshToken()
}
