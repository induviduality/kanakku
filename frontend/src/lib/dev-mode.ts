/**
 * VITE_DEV_MODE controls frontend auth behaviour:
 *   bypass-auth — auto-login on app load, skip the login page entirely
 *   seeded      — normal login page, but dev credentials are shown and signup is disabled
 *   (unset)     — full prod behaviour
 *
 * VITE_DEV_EMAIL / VITE_DEV_PASSWORD must match DEV_USER_EMAIL / DEV_USER_PASSWORD
 * in backend/app/dev_seed.py.
 *
 * VITE_MOCK_API=true — intercept all /api/* calls with MSW stub responses so
 * you can develop the UI without any backend running. Automatically implies
 * bypass-auth (the mock worker handles /api/v1/auth/dev-login too).
 */
export type DevMode = 'bypass-auth' | 'seeded' | 'none'

const raw = import.meta.env.VITE_DEV_MODE as string | undefined

export const DEV_MODE: DevMode =
  raw === 'bypass-auth' ? 'bypass-auth' :
  raw === 'seeded'      ? 'seeded'      :
  'none'

export const DEV_EMAIL    = (import.meta.env.VITE_DEV_EMAIL    as string | undefined) ?? ''
export const DEV_PASSWORD = (import.meta.env.VITE_DEV_PASSWORD as string | undefined) ?? ''

/** When true, MSW intercepts all API requests — no backend needed. */
export const MOCK_API = import.meta.env.VITE_MOCK_API === 'true'
