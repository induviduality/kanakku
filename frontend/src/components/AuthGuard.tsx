import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { isAuthenticated } from '../lib/auth-storage'

interface AuthGuardProps {
  children: React.ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate()
  const authed = isAuthenticated()

  useEffect(() => {
    if (!authed) {
      void navigate({ to: '/login' })
    }
  }, [authed, navigate])

  if (!authed) return null
  return <>{children}</>
}
