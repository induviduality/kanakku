const ORDINALS: Record<string, string> = {
  '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th',
  '6': '6th', '7': '7th', '8': '8th', '9': '9th', '10': '10th',
  '11': '11th', '12': '12th', '13': '13th', '14': '14th', '15': '15th',
  '16': '16th', '17': '17th', '18': '18th', '19': '19th', '20': '20th',
  '21': '21st', '22': '22nd', '23': '23rd', '24': '24th', '25': '25th',
  '26': '26th', '27': '27th', '28': '28th', '29': '29th', '30': '30th',
  '31': '31st', '-1': 'last day',
}

const DAY_NAMES: Record<string, string> = {
  MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday',
  FR: 'Friday', SA: 'Saturday', SU: 'Sunday',
}

/** Convert an RRULE string to a short human-readable label. */
export function rruleLabel(rule: string | null | undefined): string {
  if (!rule) return ''

  const parts: Record<string, string> = {}
  for (const part of rule.split(';')) {
    const [k, v] = part.split('=')
    if (k && v !== undefined) parts[k] = v
  }

  const freq = parts['FREQ']
  const interval = parseInt(parts['INTERVAL'] ?? '1', 10)
  const byDay = parts['BYDAY']
  const byMonthDay = parts['BYMONTHDAY']

  if (!freq) return rule

  switch (freq) {
    case 'DAILY':
      return interval === 1 ? 'Daily' : `Every ${interval} days`

    case 'WEEKLY': {
      const days = byDay ? byDay.split(',').map(d => DAY_NAMES[d] ?? d).join(', ') : ''
      if (interval === 1) return days ? `Weekly on ${days}` : 'Weekly'
      return days ? `Every ${interval} weeks on ${days}` : `Every ${interval} weeks`
    }

    case 'MONTHLY': {
      if (interval === 3) return 'Quarterly'
      if (interval === 6) return 'Every 6 months'
      const base = interval === 1 ? 'Monthly' : `Every ${interval} months`
      if (byMonthDay) {
        const day = ORDINALS[byMonthDay] ?? `day ${byMonthDay}`
        return `${base} on the ${day}`
      }
      if (byDay) {
        const days = byDay.split(',').map(d => DAY_NAMES[d.replace(/\d+/, '')] ?? d).join(', ')
        return `${base} on ${days}`
      }
      return base
    }

    case 'YEARLY':
      return interval === 1 ? 'Yearly' : `Every ${interval} years`

    default:
      return 'Custom'
  }
}
