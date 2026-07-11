import { createContext, useContext, useState } from 'react'
import { type DashboardParams } from '../api/dashboard'
import {
  defaultPeriod,
  resolvePeriod,
  toIsoDate,
  toLocalEndOfDayISO,
  toLocalExclusiveEndISO,
  toLocalStartOfDayISO,
  type PeriodSelection,
} from './period'

interface PeriodCtx {
  selection: PeriodSelection
  setSelection: (s: PeriodSelection) => void
  dashboardParams: DashboardParams
  // Correct UTC instants for the period's local start-of-day/end-of-day —
  // use these (not dashboardParams.start_date/end_date + a literal 'Z') for
  // any query that filters by full timestamp. dashboardParams.start_date/
  // end_date remain bare "YYYY-MM-DD" for display or date-only params.
  rangeStart: string
  // Inclusive end-of-day (23:59:59.999) — for endpoints using `<= end`
  // (transactions.py).
  rangeEnd: string
  // Exclusive end (start of the next local day) — for endpoints using
  // `< end` (dashboard.py, budgets.py).
  rangeEndExclusive: string
  label: string
  shortLabel: string
}

export const PeriodContext = createContext<PeriodCtx | null>(null)

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<PeriodSelection>(defaultPeriod)

  const resolved = resolvePeriod(selection)
  const dashboardParams: DashboardParams = {
    period: 'custom',
    start_date: toIsoDate(resolved.start),
    end_date: toIsoDate(resolved.end),
  }

  return (
    <PeriodContext.Provider value={{
      selection,
      setSelection,
      dashboardParams,
      rangeStart: toLocalStartOfDayISO(resolved.start),
      rangeEnd: toLocalEndOfDayISO(resolved.end),
      rangeEndExclusive: toLocalExclusiveEndISO(resolved.end),
      label: resolved.label,
      shortLabel: resolved.shortLabel,
    }}>
      {children}
    </PeriodContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePeriod(): PeriodCtx {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used inside PeriodProvider')
  return ctx
}
