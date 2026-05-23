import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import Login from './pages/Login'
import Setup from './pages/Setup'
import AcceptInvite from './pages/AcceptInvite'
import Settings from './pages/Settings'
import Accounts from './pages/Accounts'
import Payees from './pages/Payees'
import Categories from './pages/Categories'
import Tags from './pages/Tags'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div className="p-8 text-gray-500">Dashboard coming soon.</div>,
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: Setup,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})

const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accept-invite',
  component: AcceptInvite,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

const accountsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accounts',
  component: Accounts,
})

const payeesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/payees',
  component: Payees,
})

const categoriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/categories',
  component: Categories,
})

const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tags',
  component: Tags,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  setupRoute,
  loginRoute,
  acceptInviteRoute,
  settingsRoute,
  accountsRoute,
  payeesRoute,
  categoriesRoute,
  tagsRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
