import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import * as Dialog from '@radix-ui/react-dialog'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: HomeIcon },
  { to: '/transactions', label: 'Transactions', icon: ListIcon },
  { to: '/budgets', label: 'Budgets', icon: PieIcon },
]

const MORE_LINKS = [
  { to: '/accounts', label: 'Accounts' },
  { to: '/payees', label: 'Payees' },
  { to: '/categories', label: 'Categories' },
  { to: '/tags', label: 'Tags' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/piggy-banks', label: 'Piggy Banks' },
  { to: '/imports', label: 'Imports' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function PieIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export default function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  function isActive(to: string) {
    if (to === '/') return currentPath === '/'
    return currentPath.startsWith(to)
  }

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-200 safe-area-pb"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around h-14">
          {NAV_ITEMS.slice(0, 2).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-3 gap-0.5 text-xs ${
                isActive(to) ? 'text-violet-700' : 'text-gray-500'
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}

          {/* FAB — Add transaction */}
          <Link
            to="/transactions/new"
            aria-label="Add transaction"
            className="flex items-center justify-center w-12 h-12 rounded-full bg-violet-600 text-white shadow-lg -mt-4"
          >
            <PlusIcon />
          </Link>

          {NAV_ITEMS.slice(2).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-3 gap-0.5 text-xs ${
                isActive(to) ? 'text-violet-700' : 'text-gray-500'
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}

          {/* More */}
          <button
            type="button"
            aria-label="More navigation options"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-3 gap-0.5 text-xs text-gray-500"
          >
            <MenuIcon />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <Dialog.Content
            aria-label="More links"
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white rounded-t-2xl p-4 pb-8 shadow-xl"
          >
            <Dialog.Title className="text-sm font-semibold text-gray-500 mb-3">More</Dialog.Title>
            <div className="grid grid-cols-3 gap-2">
              {MORE_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center justify-center min-h-[44px] px-2 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-xl hover:bg-violet-50 hover:text-violet-700 text-center"
                >
                  {label}
                </Link>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
