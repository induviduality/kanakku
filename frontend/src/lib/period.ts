export type PeriodMode = 'week' | 'month' | 'quarter' | 'year' | 'custom'

export interface PeriodSelection {
  mode: PeriodMode
  // week: any date within the week (normalised to Monday)
  weekOf?: Date
  // month / quarter / year
  year?: number
  month?: number   // 1–12
  quarter?: number // 1–4
  // custom range
  customStart?: Date
  customEnd?: Date
}

export interface ResolvedPeriod {
  start: Date
  end: Date   // inclusive
  label: string
  shortLabel: string
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toMonday(d: Date): Date {
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}

function lastDayOfMonth(year: number, month: number): Date {
  // month is 1-based
  return new Date(year, month, 0)
}

export function resolvePeriod(sel: PeriodSelection): ResolvedPeriod {
  const now = new Date()

  switch (sel.mode) {
    case 'week': {
      const base = sel.weekOf ?? now
      const monday = toMonday(base)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      const mM = MONTHS_SHORT[monday.getMonth()]
      const sM = MONTHS_SHORT[sunday.getMonth()]
      const label =
        monday.getMonth() === sunday.getMonth()
          ? `${mM} ${monday.getDate()}–${sunday.getDate()}, ${monday.getFullYear()}`
          : `${mM} ${monday.getDate()} – ${sM} ${sunday.getDate()}, ${sunday.getFullYear()}`
      return { start: monday, end: sunday, label, shortLabel: `Week of ${mM} ${monday.getDate()}` }
    }

    case 'month': {
      const y = sel.year ?? now.getFullYear()
      const m = sel.month ?? (now.getMonth() + 1)
      const start = new Date(y, m - 1, 1)
      const end = lastDayOfMonth(y, m)
      const label = start.toLocaleString('default', { month: 'long', year: 'numeric' })
      return { start, end, label, shortLabel: `${MONTHS_SHORT[m - 1]} ${y}` }
    }

    case 'quarter': {
      const y = sel.year ?? now.getFullYear()
      const q = sel.quarter ?? (Math.ceil((now.getMonth() + 1) / 3))
      const startMonth = (q - 1) * 3 // 0-based
      const start = new Date(y, startMonth, 1)
      const end = lastDayOfMonth(y, startMonth + 3)
      return {
        start, end,
        label: `Q${q} ${y} (${MONTHS_SHORT[startMonth]}–${MONTHS_SHORT[startMonth + 2]})`,
        shortLabel: `Q${q} ${y}`,
      }
    }

    case 'year': {
      const y = sel.year ?? now.getFullYear()
      return {
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31),
        label: `${y}`,
        shortLabel: `${y}`,
      }
    }

    case 'custom': {
      const start = sel.customStart ?? new Date(now.getFullYear(), now.getMonth(), 1)
      const end = sel.customEnd ?? now
      const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      const label = `${fmt(start)} – ${fmt(end)}`
      return { start, end, label, shortLabel: label }
    }
  }
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// `ResolvedPeriod.start`/`.end` are built with local-time Date constructors
// (new Date(y, m, d)), so they already represent the correct wall-clock
// instant — .toISOString() converts that to UTC correctly for any timezone.
// The mistake to avoid is round-tripping through a bare "YYYY-MM-DD" string
// and re-attaching a literal 'Z' suffix, which silently reinterprets a local
// calendar date as a UTC one and shifts the boundary by the browser's offset
// (e.g. up to ~5.5 hours for IST) — see docs/decisions/log.md 2026-07-11 (11).
export function toLocalStartOfDayISO(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString()
}

export function toLocalEndOfDayISO(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString()
}

// Exclusive upper bound (local midnight of the day AFTER d) — for endpoints
// that filter with `< end` instead of `<= end` (dashboard.py, budgets.py).
export function toLocalExclusiveEndISO(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).toISOString()
}

export function defaultPeriod(): PeriodSelection {
  return { mode: 'month' }
}
