/**
 * VITE_DEV_MODE controls frontend dev behaviour:
 *   bypass-auth — auto-login on app load, skip the login page entirely
 *   seeded      — normal login page, but dev credentials are shown and signup is disabled
 *   (unset)     — full prod behaviour
 */
export type DevMode = 'bypass-auth' | 'seeded' | 'none'

const raw = import.meta.env.VITE_DEV_MODE as string | undefined

export const DEV_MODE: DevMode =
  raw === 'bypass-auth' ? 'bypass-auth' :
  raw === 'seeded'      ? 'seeded'      :
  'none'
