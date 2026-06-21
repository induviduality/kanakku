import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import AppLayout from './components/AppLayout'
import { isAuthenticated } from './lib/auth-storage'
import { DEV_MODE } from './lib/dev-mode'
import Dashboard from './pages/Dashboard'
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
import Subscriptions from './pages/Subscriptions'
import SubscriptionDetail from './pages/SubscriptionDetail'
import SubscriptionFormPage from './pages/SubscriptionForm'
import PiggyBanks from './pages/PiggyBanks'
import PiggyBankDetail from './pages/PiggyBankDetail'
import PiggyBankFormPage from './pages/PiggyBankForm'
import Imports from './pages/Imports'
import ImportUpload from './pages/ImportUpload'
import ImportReview from './pages/ImportReview'
import SettingsLLMActivity from './pages/SettingsLLMActivity'
import Splits from './pages/Splits'
import { SplitsPendingPage, SplitsHistoryPage } from './pages/SplitsAll'
import Reports from './pages/Reports'
import ReportDashboard from './pages/ReportDashboard'
import SettingsDataExport from './pages/SettingsDataExport'
import SettingsDataImport from './pages/SettingsDataImport'
import RecentlyDeleted from './pages/RecentlyDeleted'
import Disputes from './pages/Disputes'

// Guest-only paths that must never trigger the auth redirect.
const GUEST_PATHS = ['/login', '/setup', '/accept-invite']

const rootRoute = createRootRoute({
  component: AppLayout,
  // Runs synchronously before any component renders — no flash of wrong content.
  // Protected routes redirect to /login; the login page redirects to / if
  // already authenticated.  Auth state is resolved in main.tsx before mount.
  beforeLoad: ({ location }) => {
    const isGuest = GUEST_PATHS.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
    )
    if (!isGuest && !isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: Setup,
  beforeLoad: () => {
    if (DEV_MODE !== 'none') throw redirect({ to: '/login' })
  },
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: '/' })
  },
})

const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accept-invite',
  component: AcceptInvite,
  beforeLoad: () => {
    if (DEV_MODE !== 'none') throw redirect({ to: '/login' })
  },
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

const splitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/splits',
  component: Splits,
})

const splitsPendingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/splits/pending',
  component: SplitsPendingPage,
})

const splitsHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/splits/history',
  component: SplitsHistoryPage,
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

const subscriptionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subscriptions',
  component: Subscriptions,
})

const subscriptionNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subscriptions/new',
  component: SubscriptionFormPage,
})

const subscriptionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subscriptions/$subId',
  component: SubscriptionDetail,
})

const subscriptionEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subscriptions/$subId/edit',
  component: SubscriptionFormPage,
})

const piggyBanksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/piggy-banks',
  component: PiggyBanks,
})

const piggyBankNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/piggy-banks/new',
  component: PiggyBankFormPage,
})

const piggyBankDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/piggy-banks/$piggyId',
  component: PiggyBankDetail,
})

const piggyBankEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/piggy-banks/$piggyId/edit',
  component: PiggyBankFormPage,
})

const importsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/imports',
  component: Imports,
})

const importUploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/imports/upload',
  component: ImportUpload,
})

const importReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/imports/$batchId',
  component: ImportReview,
})

const settingsLLMActivityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/llm-activity',
  component: SettingsLLMActivity,
})

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: Reports,
})

const reportDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports/$dashboardId',
  component: ReportDashboard,
})

const settingsDataExportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/export',
  component: SettingsDataExport,
})

const settingsDataImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/import',
  component: SettingsDataImport,
})

const recentlyDeletedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recently-deleted',
  component: RecentlyDeleted,
})

const disputesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/disputes',
  component: Disputes,
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
  splitsRoute,
  splitsPendingRoute,
  splitsHistoryRoute,
  splitDetailRoute,
  budgetsRoute,
  budgetNewRoute,
  budgetDetailRoute,
  budgetEditRoute,
  subscriptionsRoute,
  subscriptionNewRoute,
  subscriptionDetailRoute,
  subscriptionEditRoute,
  piggyBanksRoute,
  piggyBankNewRoute,
  piggyBankDetailRoute,
  piggyBankEditRoute,
  importsRoute,
  importUploadRoute,
  importReviewRoute,
  settingsLLMActivityRoute,
  reportsRoute,
  reportDashboardRoute,
  settingsDataExportRoute,
  settingsDataImportRoute,
  recentlyDeletedRoute,
  disputesRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
