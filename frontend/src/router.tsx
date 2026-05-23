import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import Login from './pages/Login'
import Setup from './pages/Setup'
import AcceptInvite from './pages/AcceptInvite'
import Settings from './pages/Settings'
import Accounts from './pages/Accounts'
import Payees from './pages/Payees'
import Categories from './pages/Categories'
import Tags from './pages/Tags'
import Transactions from './pages/Transactions'
import TransactionFormPage from './pages/TransactionForm'
import SplitDetail from './pages/SplitDetail'
import Budgets from './pages/Budgets'
import BudgetDetail from './pages/BudgetDetail'
import BudgetFormPage from './pages/BudgetForm'

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

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/transactions',
  component: Transactions,
})

const transactionNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/transactions/new',
  component: TransactionFormPage,
})

const splitDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/splits/$splitId',
  component: SplitDetail,
})

const budgetsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/budgets',
  component: Budgets,
})

const budgetNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/budgets/new',
  component: BudgetFormPage,
})

const budgetDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/budgets/$budgetId',
  component: BudgetDetail,
})

const budgetEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/budgets/$budgetId/edit',
  component: BudgetFormPage,
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
  transactionsRoute,
  transactionNewRoute,
  splitDetailRoute,
  budgetsRoute,
  budgetNewRoute,
  budgetDetailRoute,
  budgetEditRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
