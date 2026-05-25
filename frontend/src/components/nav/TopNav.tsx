import { Link, useRouterState } from '@tanstack/react-router'
import { usePeriod } from '../../lib/period-context'
import { buildBreadcrumbs } from '../../lib/breadcrumbs'
import PeriodPicker from './PeriodPicker'

export default function TopNav() {
  const routerState = useRouterState()
  const path = routerState.location.pathname
  const crumbs = buildBreadcrumbs(path)
  const { selection, setSelection, shortLabel } = usePeriod()

  return (
    <header className="sticky top-0 z-30 h-12 flex items-center border-b border-border bg-topbar">

      {/* Brand — matches SideNav width on desktop */}
      <Link
        to="/"
        className="hidden md:flex items-center justify-center w-52 shrink-0 h-full hover:bg-surface-2 transition-colors"
        aria-label="Home"
      >
        <span className="text-xl font-extrabold text-accent tracking-tight" style={{ fontFamily: 'var(--kk-font-sans)' }}>
          கணக்கு.
        </span>
      </Link>

      {/* Mobile brand */}
      <Link to="/" className="md:hidden flex items-center pl-4 h-full" aria-label="Home">
        <span className="text-xl font-extrabold text-accent">கணக்கு.</span>
      </Link>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex-1 min-w-0 flex items-center gap-1.5 text-sm px-4 md:px-6">
        {crumbs.length === 0 ? (
          <span className="font-semibold text-fg">Dashboard</span>
        ) : (
          crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && (
                  <svg className="w-3 h-3 text-fg-faint shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
                {isLast || !crumb.href ? (
                  <span className={`truncate ${isLast ? 'font-semibold text-fg' : 'text-fg-muted'}`}>
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    to={crumb.href as any}
                    className="truncate text-fg-muted hover:text-fg transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            )
          })
        )}
      </nav>

      {/* Period picker */}
      <div className="shrink-0 pr-4 md:pr-6">
        <PeriodPicker
          selection={selection}
          shortLabel={shortLabel}
          onChange={setSelection}
        />
      </div>
    </header>
  )
}
