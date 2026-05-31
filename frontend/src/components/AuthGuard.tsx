import { useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { isAuthenticated, subscribeToAuth } from '../lib/auth-storage'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate()
  // Subscribe so a token clear (e.g. from api-client after a failed refresh)
  // re-renders the guard and bounces the user to /login.
  const authed = useSyncExternalStore(subscribeToAuth, isAuthenticated, isAuthenticated)

  useEffect(() => {
    if (!authed) {
      void navigate({ to: '/login' })
    }
  }, [authed, navigate])

  if (!authed) return null
  return <>{children}</>
}
