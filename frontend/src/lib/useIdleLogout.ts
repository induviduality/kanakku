import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { apiPost } from './api-client'
import { clearAuth, getRefreshToken, isAuthenticated } from './auth-storage'

const IDLE_TIMEOUT_MS = 20 * 60 * 1000

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

/** Signs the user out after IDLE_TIMEOUT_MS of no interaction. */
export function useIdleLogout(): void {
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    function logout() {
      const refreshToken = getRefreshToken()
      clearAuth()
      void navigate({ to: '/login' })
      if (refreshToken) {
        // Best-effort revoke; the client-side tokens are already cleared
        // above regardless of whether this succeeds.
        apiPost('/auth/logout', { refresh_token: refreshToken }).catch(() => {})
      }
    }

    function resetTimer() {
      if (!isAuthenticated()) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS)
    }

    resetTimer()
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, resetTimer)
      }
    }
  }, [navigate])
}
