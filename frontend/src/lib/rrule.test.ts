import { describe, it, expect } from 'vitest'
import { rruleLabel } from './rrule'

describe('rrule lib', () => {
  it('returns empty string for null/undefined/empty rule', () => {
    expect(rruleLabel(null)).toBe('')
    expect(rruleLabel(undefined)).toBe('')
    expect(rruleLabel('')).toBe('')
  })

  it('returns raw rule if no FREQ is present or parts are malformed', () => {
    expect(rruleLabel('BYMONTHDAY=1')).toBe('BYMONTHDAY=1')
    expect(rruleLabel('FREQ;INTERVAL=1')).toBe('FREQ;INTERVAL=1') // v is undefined
    expect(rruleLabel('=DAILY;FREQ=DAILY')).toBe('Daily') // k is empty
  })

  it('handles DAILY rules', () => {
    expect(rruleLabel('FREQ=DAILY')).toBe('Daily')
    expect(rruleLabel('FREQ=DAILY;INTERVAL=1')).toBe('Daily')
    expect(rruleLabel('FREQ=DAILY;INTERVAL=3')).toBe('Every 3 days')
  })

  it('handles WEEKLY rules', () => {
    expect(rruleLabel('FREQ=WEEKLY')).toBe('Weekly')
    expect(rruleLabel('FREQ=WEEKLY;INTERVAL=2')).toBe('Every 2 weeks')
    expect(rruleLabel('FREQ=WEEKLY;BYDAY=MO')).toBe('Weekly on Monday')
    expect(rruleLabel('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('Weekly on Monday, Wednesday, Friday')
    expect(rruleLabel('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH')).toBe('Every 2 weeks on Tuesday, Thursday')
    expect(rruleLabel('FREQ=WEEKLY;BYDAY=FOO')).toBe('Weekly on FOO') // Fallback for unknown day
  })

  it('handles MONTHLY rules', () => {
    expect(rruleLabel('FREQ=MONTHLY')).toBe('Monthly')
    expect(rruleLabel('FREQ=MONTHLY;INTERVAL=3')).toBe('Quarterly')
    expect(rruleLabel('FREQ=MONTHLY;INTERVAL=6')).toBe('Every 6 months')
    expect(rruleLabel('FREQ=MONTHLY;INTERVAL=2')).toBe('Every 2 months')
    
    // By month day
    expect(rruleLabel('FREQ=MONTHLY;BYMONTHDAY=1')).toBe('Monthly on the 1st')
    expect(rruleLabel('FREQ=MONTHLY;BYMONTHDAY=21')).toBe('Monthly on the 21st')
    expect(rruleLabel('FREQ=MONTHLY;BYMONTHDAY=-1')).toBe('Monthly on the last day')
    expect(rruleLabel('FREQ=MONTHLY;BYMONTHDAY=99')).toBe('Monthly on the day 99') // Fallback
    
    // Interval with month day
    expect(rruleLabel('FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15')).toBe('Every 2 months on the 15th')

    // By day
    expect(rruleLabel('FREQ=MONTHLY;BYDAY=1MO')).toBe('Monthly on Monday')
    expect(rruleLabel('FREQ=MONTHLY;BYDAY=-1FR')).toBe('Monthly on Friday')
    expect(rruleLabel('FREQ=MONTHLY;BYDAY=1FOO')).toBe('Monthly on 1FOO') // Fallback for unknown day
  })

  it('handles YEARLY rules', () => {
    expect(rruleLabel('FREQ=YEARLY')).toBe('Yearly')
    expect(rruleLabel('FREQ=YEARLY;INTERVAL=1')).toBe('Yearly')
    expect(rruleLabel('FREQ=YEARLY;INTERVAL=5')).toBe('Every 5 years')
  })

  it('handles unknown frequency (Custom)', () => {
    expect(rruleLabel('FREQ=MINUTELY')).toBe('Custom')
  })
})
