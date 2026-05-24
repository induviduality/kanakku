import { Outlet, useRouterState } from '@tanstack/react-router'
import MobileNav from './MobileNav'
import TopNav from './nav/TopNav'
import { PeriodProvider } from '../lib/period-context'

const GUEST_PATHS = ['/login', '/setup', '/accept-invite']

export default function AppLayout() {
  const routerState = useRouterState()
  const path = routerState.location.pathname
  const isGuest = GUEST_PATHS.some((p) => path === p || path.startsWith(p))

  return (
    <>
      {/* Atmospheric background — only rendered for authenticated pages.
          Purely decorative; aria-hidden keeps them out of the a11y tree. */}
      {!isGuest && (
        <>
          <div className="kk-ambient" aria-hidden="true">
            <div className="kk-ambient-glow" />
            <div className="kk-ambient-glow kk-ambient-glow--b" />
          </div>
          <div className="kk-grain" aria-hidden="true" />
        </>
      )}

      {/* Main content sits above the atmospheric layers */}
      <PeriodProvider>
        <div className={`relative z-[2] min-h-svh flex flex-col${isGuest ? '' : ' pb-14 md:pb-0'}`}>
          {!isGuest && <TopNav />}
          <div className="flex-1">
            <Outlet />
          </div>
          {!isGuest && <MobileNav />}
        </div>
      </PeriodProvider>
    </>
  )
}
