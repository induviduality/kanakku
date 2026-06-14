import { Outlet, useRouterState } from '@tanstack/react-router'
import MobileNav from './MobileNav'
import TopNav from './nav/TopNav'
import SideNav from './nav/SideNav'
import { PeriodProvider } from '../lib/period-context'
import { ToastProvider } from '../lib/toast'

const GUEST_PATHS = ['/login', '/setup', '/accept-invite']

export default function AppLayout() {
  const routerState = useRouterState()
  const path = routerState.location.pathname
  const isGuest = GUEST_PATHS.some((p) => path === p || path.startsWith(p))

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
      </PeriodProvider>
      </ToastProvider>
    </>
  )
}
