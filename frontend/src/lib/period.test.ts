import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolvePeriod, toIsoDate, defaultPeriod, toLocalStartOfDayISO, toLocalEndOfDayISO } from './period'

describe('period lib', () => {
  beforeEach(() => {
    // Mock current date to May 26, 2026, 12:00:00Z for consistent tests
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaultPeriod returns month mode', () => {
    expect(defaultPeriod()).toEqual({ mode: 'month' })
  })

  it('toIsoDate formats Date correctly', () => {
    const d = new Date(2026, 4, 5) // May 5
    expect(toIsoDate(d)).toBe('2026-05-05')
  })

  describe('resolvePeriod', () => {
    it('resolves week mode with provided date', () => {
      // 2026-05-13 is a Wednesday
      const weekOf = new Date(2026, 4, 13) 
      const res = resolvePeriod({ mode: 'week', weekOf })
      
      // Monday should be 2026-05-11
      expect(res.start.getFullYear()).toBe(2026)
      expect(res.start.getMonth()).toBe(4)
      expect(res.start.getDate()).toBe(11)
      
      // Sunday should be 2026-05-17
      expect(res.end.getFullYear()).toBe(2026)
      expect(res.end.getMonth()).toBe(4)
      expect(res.end.getDate()).toBe(17)

      expect(res.label).toBe('May 11–17, 2026')
      expect(res.shortLabel).toBe('Week of May 11')
    })

    it('resolves week mode across months', () => {
      // 2026-05-31 is a Sunday, week starts May 25, ends May 31 (same month)
      // 2026-06-01 is a Monday, ends June 7
      // 2026-05-29 is Friday, Monday is May 25.
      
      // Try a cross-month week. 2026-02-27 is a Friday. Monday is 23. Sunday is Mar 1.
      const weekOf = new Date(2026, 1, 27)
      const res = resolvePeriod({ mode: 'week', weekOf })
      expect(res.label).toBe('Feb 23 – Mar 1, 2026')
    })

    it('resolves week mode without provided date (uses now)', () => {
      // now is 2026-05-26 (Tuesday), monday is 25th
      const res = resolvePeriod({ mode: 'week' })
      expect(res.start.getDate()).toBe(25)
    })

    it('resolves month mode with provided month and year', () => {
      const res = resolvePeriod({ mode: 'month', year: 2025, month: 2 }) // Feb 2025
      expect(res.start.getFullYear()).toBe(2025)
      expect(res.start.getMonth()).toBe(1) // 0-based
      expect(res.start.getDate()).toBe(1)
      
      expect(res.end.getFullYear()).toBe(2025)
      expect(res.end.getMonth()).toBe(1)
      expect(res.end.getDate()).toBe(28) // Feb 28 2025
      
      expect(res.label).toBe('February 2025')
      expect(res.shortLabel).toBe('Feb 2025')
    })

    it('resolves month mode without provided month and year (uses now)', () => {
      const res = resolvePeriod({ mode: 'month' })
      expect(res.start.getFullYear()).toBe(2026)
      expect(res.start.getMonth()).toBe(4) // May
      expect(res.end.getDate()).toBe(31)
    })

    it('resolves quarter mode with provided quarter and year', () => {
      const res = resolvePeriod({ mode: 'quarter', year: 2025, quarter: 1 })
      expect(res.start.getFullYear()).toBe(2025)
      expect(res.start.getMonth()).toBe(0) // Jan
      expect(res.end.getMonth()).toBe(2) // Mar
      expect(res.end.getDate()).toBe(31)
      
      expect(res.label).toBe('Q1 2025 (Jan–Mar)')
      expect(res.shortLabel).toBe('Q1 2025')
    })

    it('resolves quarter mode without provided quarter (uses now)', () => {
      // May 2026 -> Q2
      const res = resolvePeriod({ mode: 'quarter' })
      expect(res.start.getMonth()).toBe(3) // Apr
      expect(res.end.getMonth()).toBe(5) // Jun
      expect(res.shortLabel).toBe('Q2 2026')
    })

    it('resolves year mode with provided year', () => {
      const res = resolvePeriod({ mode: 'year', year: 2024 })
      expect(res.start.getFullYear()).toBe(2024)
      expect(res.start.getMonth()).toBe(0)
      expect(res.end.getMonth()).toBe(11)
      expect(res.end.getDate()).toBe(31)
      
      expect(res.label).toBe('2024')
      expect(res.shortLabel).toBe('2024')
    })

    it('resolves year mode without provided year (uses now)', () => {
      const res = resolvePeriod({ mode: 'year' })
      expect(res.start.getFullYear()).toBe(2026)
    })

    it('resolves custom mode with provided dates', () => {
      const start = new Date(2026, 4, 10)
      const end = new Date(2026, 4, 20)
      const res = resolvePeriod({ mode: 'custom', customStart: start, customEnd: end })
      
      expect(res.start).toBe(start)
      expect(res.end).toBe(end)
      expect(res.label).toContain('10 May 2026')
      expect(res.label).toContain('20 May 2026')
    })

    it('resolves custom mode without provided dates (uses fallback)', () => {
      const res = resolvePeriod({ mode: 'custom' })
      // Fallback: start is 1st of current month, end is now
      expect(res.start.getFullYear()).toBe(2026)
      expect(res.start.getMonth()).toBe(4)
      expect(res.start.getDate()).toBe(1)
      
      expect(res.end.getFullYear()).toBe(2026)
      expect(res.end.getMonth()).toBe(4)
      expect(res.end.getDate()).toBe(26)
    })
  })

  describe('toLocalStartOfDayISO / toLocalEndOfDayISO', () => {
    // Regression for the bug where a period boundary date string had a
    // literal 'Z' reattached (e.g. `${isoDate}T23:59:59.999Z`), silently
    // reinterpreting a local calendar date as UTC. For any positive-offset
    // timezone (e.g. IST, UTC+5:30) that leaks a transaction from the start
    // of the next local day into "today"'s range. These helpers must
    // round-trip to true local midnight / local end-of-day regardless of
    // the runner's timezone.
    it('round-trips to local midnight and local end-of-day', () => {
      const d = new Date(2025, 11, 31) // Dec 31, 2025, local midnight

      const start = new Date(toLocalStartOfDayISO(d))
      expect(start.getFullYear()).toBe(2025)
      expect(start.getMonth()).toBe(11)
      expect(start.getDate()).toBe(31)
      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
      expect(start.getSeconds()).toBe(0)

      const end = new Date(toLocalEndOfDayISO(d))
      expect(end.getFullYear()).toBe(2025)
      expect(end.getMonth()).toBe(11)
      expect(end.getDate()).toBe(31)
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
      expect(end.getSeconds()).toBe(59)
    })

    it('does not equal a naive Z-suffixed date string on a non-UTC runner', () => {
      const d = new Date(2025, 11, 31)
      const offsetMinutes = d.getTimezoneOffset() // 0 only if the runner itself is UTC
      if (offsetMinutes !== 0) {
        expect(toLocalStartOfDayISO(d)).not.toBe('2025-12-31T00:00:00.000Z')
        expect(toLocalEndOfDayISO(d)).not.toBe('2025-12-31T23:59:59.999Z')
      }
    })
  })
})
