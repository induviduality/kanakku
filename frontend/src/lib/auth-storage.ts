// Access token lives in memory only — never persisted to disk.
let _accessToken: string | null = null

export function getAccessToken(): string | null {
  return _accessToken
}
export function setAccessToken(token: string): void {
  _accessToken = token
}
export function clearAccessToken(): void {
  _accessToken = null
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
