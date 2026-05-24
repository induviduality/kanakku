import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { clearAuth, getRefreshToken, storeTokens } from './lib/auth-storage'

const queryClient = new QueryClient()

/**
 * Auth bootstrap — runs once before React mounts.
 *
 * Goal: ensure isAuthenticated() returns an accurate value before any route's
 * beforeLoad fires, so the router can redirect synchronously without a flash.
 *
 * Dev mode  → call /api/v1/auth/dev-login (no credentials needed).
 * Prod mode → if a refresh token exists in localStorage, exchange it for a
 *             fresh access token.  If the exchange fails (expired, revoked)
 *             the stale token is cleared so the user lands on /login cleanly.
 */
async function initAuth(): Promise<void> {
  if (import.meta.env.DEV) {
    try {
      const res = await fetch('/api/v1/auth/dev-login')
      if (res.ok) {
        const data = (await res.json()) as { access_token: string; refresh_token: string }
        storeTokens(data.access_token, data.refresh_token)
      }
    } catch {
      // backend unreachable in dev — fall through to login page
    }
    return
  }

  const refreshToken = getRefreshToken()
  if (!refreshToken) return

  try {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (res.ok) {
      const data = (await res.json()) as { access_token: string; refresh_token: string }
      storeTokens(data.access_token, data.refresh_token)
    } else {
      clearAuth()
    }
  } catch {
    // network error — leave auth state as-is; router will redirect if needed
  }
}

async function bootstrap() {
  await initAuth()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
}

void bootstrap()
