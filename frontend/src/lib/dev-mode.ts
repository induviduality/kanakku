/**
 * VITE_DEV_MODE controls frontend dev behaviour:
 *   bypass-auth — auto-login on app load, skip the login page entirely
 *   seeded      — normal login page, but dev credentials are shown and signup is disabled
 *   (unset)     — full prod behaviour
 *
 * VITE_DEV_EMAIL / VITE_DEV_PASSWORD must match DEV_USER_EMAIL / DEV_USER_PASSWORD
 * in backend/app/dev_seed.py.
 */
export type DevMode = 'bypass-auth' | 'seeded' | 'none'

const raw = import.meta.env.VITE_DEV_MODE as string | undefined

export const DEV_MODE: DevMode =
  raw === 'bypass-auth' ? 'bypass-auth' :
  raw === 'seeded'      ? 'seeded'      :
  'none'

export const DEV_EMAIL    = (import.meta.env.VITE_DEV_EMAIL    as string | undefined) ?? 'dev@kanakku.com'
export const DEV_PASSWORD = (import.meta.env.VITE_DEV_PASSWORD as string | undefined) ?? 'dev-password'
