import { useEffect, useRef } from 'react'
import { useLogout } from '../api/auth'
import { isAuthenticated } from './auth-storage'

const IDLE_TIMEOUT_MS = 20 * 60 * 1000

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

/** Signs the user out after IDLE_TIMEOUT_MS of no interaction. */
export function useIdleLogout(): void {
  const logout = useLogout()
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    function resetTimer() {
      if (!isAuthenticated()) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => logout.mutate(), IDLE_TIMEOUT_MS)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
