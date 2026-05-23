import { Outlet, useRouterState } from '@tanstack/react-router'
import MobileNav from './MobileNav'

const GUEST_PATHS = ['/login', '/setup', '/accept-invite']

export default function AppLayout() {
  const routerState = useRouterState()
  const path = routerState.location.pathname
  const isGuest = GUEST_PATHS.some((p) => path === p || path.startsWith(p))

  return (
    <div className={isGuest ? '' : 'pb-14 md:pb-0'}>
      <Outlet />
      {!isGuest && <MobileNav />}
    </div>
  )
}
