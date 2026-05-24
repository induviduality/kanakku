import * as Popover from '@radix-ui/react-popover'
import { DayPicker } from 'react-day-picker'
import { useState } from 'react'
import { type PeriodMode, type PeriodSelection, resolvePeriod } from '../../lib/period'

// ── helpers ──────────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MODE_LABELS: Record<PeriodMode, string> = {
  week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year', custom: 'Custom',
}

function toMonday(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}

// ── sub-pickers ───────────────────────────────────────────────────────────────

function YearNav({
  year,
  onPrev,
  onNext,
}: {
  year: number
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <button onClick={onPrev} className="p-1 rounded hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-sm font-semibold text-fg">{year}</span>
      <button onClick={onNext} className="p-1 rounded hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

function WeekPicker({
  current,
  onSelect,
}: {
  current: PeriodSelection
  onSelect: (s: PeriodSelection) => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(current.weekOf?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(current.weekOf?.getMonth() ?? today.getMonth())

  const selectedMonday = current.weekOf ? toMonday(current.weekOf) : toMonday(today)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1)
  const startDay = toMonday(firstDay)
  // always render 6 rows
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDay)
    d.setDate(startDay.getDate() + i)
    days.push(d)
  }
  const weeks: Date[][] = []
  for (let i = 0; i < 6; i++) weeks.push(days.slice(i * 7, i * 7 + 7))

  function isSelectedWeek(monday: Date) {
    return monday.toDateString() === selectedMonday.toDateString()
  }

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-fg">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-fg-faint py-1">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => {
        const monday = toMonday(week[0])
        const sel = isSelectedWeek(monday)
        return (
          <button
            key={wi}
            onClick={() => onSelect({ mode: 'week', weekOf: monday })}
            className={`w-full grid grid-cols-7 rounded-md mb-0.5 transition-colors ${
              sel ? 'bg-accent/20' : 'hover:bg-surface-2'
            }`}
          >
            {week.map((day, di) => (
              <div
                key={di}
                className={`text-center text-xs py-1.5 rounded-sm ${
                  day.getMonth() !== viewMonth ? 'text-fg-faint' : 'text-fg'
                } ${sel && di === 0 ? 'text-accent font-semibold' : ''}`}
              >
                {day.getDate()}
              </div>
            ))}
          </button>
        )
      })}
    </div>
  )
}

function MonthPicker({
  current,
  onSelect,
}: {
  current: PeriodSelection
  onSelect: (s: PeriodSelection) => void
}) {
  const now = new Date()
  const [year, setYear] = useState(current.year ?? current.weekOf?.getFullYear() ?? now.getFullYear())
  const selYear = current.mode === 'month' ? (current.year ?? now.getFullYear()) : -1
  const selMonth = current.mode === 'month' ? (current.month ?? (now.getMonth() + 1)) : -1

  return (
    <div className="w-52">
      <YearNav year={year} onPrev={() => setYear(y => y - 1)} onNext={() => setYear(y => y + 1)} />
      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((m, i) => {
          const isSel = year === selYear && i + 1 === selMonth
          return (
            <button
              key={m}
              onClick={() => onSelect({ mode: 'month', year, month: i + 1 })}
              className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                isSel
                  ? 'bg-accent text-white'
                  : 'text-fg hover:bg-surface-2'
              }`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function QuarterPicker({
  current,
  onSelect,
}: {
  current: PeriodSelection
  onSelect: (s: PeriodSelection) => void
}) {
  const now = new Date()
  const [year, setYear] = useState(current.year ?? now.getFullYear())
  const selYear = current.mode === 'quarter' ? (current.year ?? now.getFullYear()) : -1
  const selQ = current.mode === 'quarter' ? (current.quarter ?? Math.ceil((now.getMonth() + 1) / 3)) : -1

  const QUARTERS = [
    { q: 1, label: 'Q1', sub: 'Jan–Mar' },
    { q: 2, label: 'Q2', sub: 'Apr–Jun' },
    { q: 3, label: 'Q3', sub: 'Jul–Sep' },
    { q: 4, label: 'Q4', sub: 'Oct–Dec' },
  ]

  return (
    <div className="w-52">
      <YearNav year={year} onPrev={() => setYear(y => y - 1)} onNext={() => setYear(y => y + 1)} />
      <div className="grid grid-cols-2 gap-2">
        {QUARTERS.map(({ q, label, sub }) => {
          const isSel = year === selYear && q === selQ
          return (
            <button
              key={q}
              onClick={() => onSelect({ mode: 'quarter', year, quarter: q })}
              className={`flex flex-col items-center py-3 rounded-lg transition-colors ${
                isSel ? 'bg-accent text-white' : 'text-fg hover:bg-surface-2'
              }`}
            >
              <span className="text-sm font-bold">{label}</span>
              <span className={`text-xs mt-0.5 ${isSel ? 'text-white/70' : 'text-fg-faint'}`}>{sub}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function YearPicker({
  current,
  onSelect,
}: {
  current: PeriodSelection
  onSelect: (s: PeriodSelection) => void
}) {
  const now = new Date()
  const selYear = current.mode === 'year' ? (current.year ?? now.getFullYear()) : -1
  // show a decade window centered around selected/current year
  const center = selYear > 0 ? selYear : now.getFullYear()
  const [decadeStart, setDecadeStart] = useState(Math.floor(center / 10) * 10)
  const years = Array.from({ length: 12 }, (_, i) => decadeStart + i)

  return (
    <div className="w-52">
      <YearNav
        year={decadeStart}
        onPrev={() => setDecadeStart(d => d - 10)}
        onNext={() => setDecadeStart(d => d + 10)}
      />
      <div className="grid grid-cols-3 gap-1.5">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onSelect({ mode: 'year', year: y })}
            className={`py-2 rounded-lg text-xs font-medium transition-colors ${
              y === selYear ? 'bg-accent text-white' : 'text-fg hover:bg-surface-2'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}

function CustomRangePicker({
  current,
  onSelect,
}: {
  current: PeriodSelection
  onSelect: (s: PeriodSelection) => void
}) {
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: current.customStart,
    to: current.customEnd,
  })

  function handleSelect(r: { from?: Date; to?: Date } | undefined) {
    const next = r ?? {}
    setRange(next)
    if (next.from && next.to) {
      onSelect({ mode: 'custom', customStart: next.from, customEnd: next.to })
    }
  }

  return (
    <div>
      <DayPicker
        mode="range"
        selected={range.from && range.to ? { from: range.from, to: range.to } : undefined}
        onSelect={handleSelect as any}
        numberOfMonths={1}
        classNames={{
          root: 'rdp-root',
          months: 'flex gap-4',
          month: 'space-y-2',
          month_caption: 'flex justify-center items-center h-7 mb-2',
          caption_label: 'text-sm font-semibold text-fg',
          nav: 'flex items-center gap-1',
          button_previous: 'absolute left-0 p-1 rounded hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors',
          button_next: 'absolute right-0 p-1 rounded hover:bg-surface-2 text-fg-faint hover:text-fg transition-colors',
          month_grid: 'w-full border-collapse',
          weekdays: 'flex',
          weekday: 'w-8 text-xs text-fg-faint text-center py-1',
          weeks: 'space-y-0.5',
          week: 'flex',
          day: 'relative',
          day_button: [
            'w-8 h-8 text-xs rounded-full flex items-center justify-center',
            'hover:bg-surface-2 text-fg transition-colors cursor-pointer',
          ].join(' '),
          selected: '[&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent',
          range_start: '[&>button]:bg-accent [&>button]:text-white [&>button]:rounded-full',
          range_end: '[&>button]:bg-accent [&>button]:text-white [&>button]:rounded-full',
          range_middle: '[&>button]:bg-accent/15 [&>button]:rounded-none [&>button]:text-fg',
          today: '[&>button]:font-bold [&>button]:text-accent',
          outside: '[&>button]:text-fg-faint [&>button]:opacity-40',
          disabled: '[&>button]:opacity-25 [&>button]:cursor-not-allowed',
          chevron: 'fill-fg-faint w-4 h-4',
        }}
      />
      {range.from && !range.to && (
        <p className="text-xs text-fg-faint mt-1 text-center">Select end date</p>
      )}
    </div>
  )
}

// ── Main PeriodPicker ─────────────────────────────────────────────────────────

interface PeriodPickerProps {
  selection: PeriodSelection
  label: string
  shortLabel: string
  onChange: (s: PeriodSelection) => void
}

export default function PeriodPicker({ selection, label, shortLabel, onChange }: PeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const [draftMode, setDraftMode] = useState<PeriodMode>(selection.mode)

  function handleSelect(s: PeriodSelection) {
    onChange(s)
    // Close automatically for non-custom, or when custom has both dates
    if (s.mode !== 'custom' || (s.customStart && s.customEnd)) {
      setOpen(false)
    }
  }

  function handleModeChange(m: PeriodMode) {
    setDraftMode(m)
  }

  // Resolved label for display
  const resolved = resolvePeriod(selection)

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraftMode(selection.mode) }}>
      <Popover.Trigger asChild>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface text-sm text-fg hover:bg-surface-2 transition-colors">
          <svg className="w-3.5 h-3.5 text-fg-faint shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-medium">{resolved.shortLabel}</span>
          <svg className="w-3 h-3 text-fg-faint" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 rounded-xl border border-border bg-surface shadow-xl p-4 outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          {/* Mode tabs */}
          <div className="flex gap-1 mb-4 bg-surface-2 rounded-lg p-1">
            {(['week', 'month', 'quarter', 'year', 'custom'] as PeriodMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 text-xs py-1.5 px-1 rounded-md font-medium transition-colors ${
                  draftMode === m
                    ? 'bg-surface text-fg shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Mode-specific picker */}
          {draftMode === 'week'    && <WeekPicker    current={selection} onSelect={handleSelect} />}
          {draftMode === 'month'   && <MonthPicker   current={selection} onSelect={handleSelect} />}
          {draftMode === 'quarter' && <QuarterPicker current={selection} onSelect={handleSelect} />}
          {draftMode === 'year'    && <YearPicker    current={selection} onSelect={handleSelect} />}
          {draftMode === 'custom'  && <CustomRangePicker current={selection} onSelect={handleSelect} />}

          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
