import { Outlet, useRouterState } from '@tanstack/react-router'
import MobileNav from './MobileNav'
import TopNav from './nav/TopNav'
import SideNav from './nav/SideNav'
import AuthGuard from './AuthGuard'
import { PeriodProvider } from '../lib/period-context'
import { ToastProvider } from '../lib/toast'
import { useIdleLogout } from '../lib/useIdleLogout'

const GUEST_PATHS = ['/login', '/setup', '/accept-invite']

// Mounted only for authenticated routes — signs the user out after 20
// minutes of inactivity and reacts to a token clear from anywhere else in
// the app (e.g. a failed refresh in api-client), bouncing to /login instead
// of leaving the UI silently frozen (docs/decisions/log.md 2026-07-23 #9).
function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  useIdleLogout()
  return <AuthGuard>{children}</AuthGuard>
}

export default function AppLayout() {
  const routerState = useRouterState()
  const path = routerState.location.pathname
  const isGuest = GUEST_PATHS.some((p) => path === p || path.startsWith(p))

  const content = (
    <div className={`relative z-[2] min-h-svh flex flex-col${isGuest ? '' : ' pb-14 md:pb-0'}`}>
      {!isGuest && <TopNav />}

      <div className="flex flex-1 min-h-0">
        {!isGuest && <SideNav />}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {!isGuest && <MobileNav />}
    </div>
  )

  return (
    <>
      {!isGuest && (
        <>
          <div className="kk-ambient" aria-hidden="true">
            <div className="kk-ambient-glow" />
            <div className="kk-ambient-glow kk-ambient-glow--b" />
          </div>
          <div className="kk-grain" aria-hidden="true" />
        </>
      )}

      <ToastProvider>
      <PeriodProvider>
        {isGuest ? content : <AuthenticatedShell>{content}</AuthenticatedShell>}
      </PeriodProvider>
      </ToastProvider>
    </>
  )
}
