import { createContext, useContext, useState } from 'react'
import { type DashboardParams } from '../api/dashboard'
import { defaultPeriod, resolvePeriod, toIsoDate, type PeriodSelection } from './period'

interface PeriodCtx {
  selection: PeriodSelection
  setSelection: (s: PeriodSelection) => void
  dashboardParams: DashboardParams
  label: string
  shortLabel: string
}

const PeriodContext = createContext<PeriodCtx | null>(null)

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
