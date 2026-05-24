import { useRouterState } from '@tanstack/react-router'
import { usePeriod } from '../../lib/period-context'
import PeriodPicker from './PeriodPicker'

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transactions',
  '/accounts': 'Accounts',
  '/budgets': 'Budgets',
  '/subscriptions': 'Subscriptions',
  '/piggy-banks': 'Savings Goals',
  '/splits': 'Splits',
  '/categories': 'Categories',
  '/payees': 'Payees',
  '/tags': 'Tags',
  '/imports': 'Import',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/recently-deleted': 'Recently Deleted',
}

function getTitle(pathname: string): string {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  // prefix match for detail pages
  for (const [prefix, label] of Object.entries(ROUTE_TITLES)) {
    if (prefix !== '/' && pathname.startsWith(prefix)) return label
  }
  return 'Kanakku'
}

export default function TopNav() {
  const routerState = useRouterState()
  const path = routerState.location.pathname
  const title = getTitle(path)
  const { selection, setSelection, shortLabel } = usePeriod()

  return (
    <header className="sticky top-0 z-30 h-12 flex items-center px-4 md:px-6 border-b border-border bg-topbar">
      {/* Left: page title */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-fg truncate">{title}</span>
      </div>

      {/* Right: period picker */}
      <div className="shrink-0">
        <PeriodPicker
          selection={selection}
          shortLabel={shortLabel}
          onChange={setSelection}
        />
      </div>
    </header>
  )
}
