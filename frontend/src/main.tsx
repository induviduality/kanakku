import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { clearAuth, getRefreshToken, storeTokens } from './lib/auth-storage'
import { DEV_MODE } from './lib/dev-mode'

const queryClient = new QueryClient()

async function initAuth(): Promise<void> {
  if (DEV_MODE === 'bypass-auth') {
    try {
      const res = await fetch('/api/v1/auth/dev-login')
      if (res.ok) {
        const data = (await res.json()) as { access_token: string; refresh_token: string }
        storeTokens(data.access_token, data.refresh_token)
      }
    } catch {
      // backend unreachable — fall through to login page
    }
    return
  }

  // seeded or unset: normal refresh-token flow
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
