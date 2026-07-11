import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { CashFlowAccountBucket } from '../../api/dashboard'

const ACCOUNT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
]

function bucketUnit(startDate: string, endDate: string): 'day' | 'week' | 'month' {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const days = (end.getTime() - start.getTime()) / 86_400_000
  if (days > 91) return 'month'
  if (days > 31) return 'week'
  return 'day'
}

function formatLabel(dateStr: string, unit: 'day' | 'week' | 'month'): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (unit === 'month') {
    const mon = d.toLocaleDateString('en-IN', { month: 'short' })
    const yr = d.getFullYear().toString().slice(2)
    return `${mon} '${yr}`
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Truncate (not round) to 1 decimal so a displayed value never overstates
// the real amount — e.g. ₹81,483 must read "₹81.4K", not "₹81.5K" or "₹81K".
function truncate1(value: number, divisor: number): string {
  return (Math.floor((value / divisor) * 10) / 10).toFixed(1)
}

export function formatINR(value: number) {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 100_000) return `${sign}₹${truncate1(abs, 100_000)}L`
  if (abs >= 1_000) return `${sign}₹${truncate1(abs, 1_000)}K`
  return `${sign}₹${abs.toFixed(0)}`
}

interface TooltipEntry { name: string; value: number; color: string; payload: Record<string, number | null> }

export function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  // Filter out __net hidden keys; recharts passes all dataKeys
  const lines = payload.filter(p => !p.name.endsWith('__net'))
  return (
    <div className="kk-card text-xs py-2 px-3 space-y-1.5 shadow-lg min-w-[160px]">
      <p className="font-semibold text-fg mb-1">{label}</p>
      {lines.map((p) => {
        const net = p.payload[`${p.name}__net`] as number | null
        return (
          <div key={p.name} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="text-fg-muted truncate max-w-[100px]">{p.name}</span>
              <span className="ml-auto font-semibold kk-mono text-fg">{formatINR(p.value)}</span>
            </div>
            {net != null && net !== 0 && (
              <p className={`text-right kk-mono pl-4 ${net > 0 ? 'text-positive-dim' : 'text-negative-dim'}`}>
                {net > 0 ? '+' : ''}{formatINR(net)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface CashFlowChartProps {
  byAccount: CashFlowAccountBucket[]
  periodStart: string  // "YYYY-MM-DD"
  periodEnd: string
}

export default function CashFlowChart({ byAccount = [], periodStart, periodEnd }: CashFlowChartProps) {
  if (byAccount.length === 0) {
    return (
      <p className="text-sm text-fg-muted text-center py-8">No transactions in this period.</p>
    )
  }

  const unit = bucketUnit(periodStart, periodEnd)

  // Unique sorted dates and account names
  const dates = [...new Set(byAccount.map(b => b.date))].sort()
  const accountNames = [...new Set(byAccount.map(b => b.account_name))].sort()

  // Build lookup: date → accountName → { balance, net }
  const lookup = new Map<string, Map<string, { balance: number; net: number }>>()
  for (const b of byAccount) {
    if (!lookup.has(b.date)) lookup.set(b.date, new Map())
    lookup.get(b.date)!.set(b.account_name, {
      balance: parseFloat(b.balance),
      net: parseFloat(b.net),
    })
  }

  const rows = dates.map(date => {
    const row: Record<string, string | number | null> = { label: formatLabel(date, unit) }
    for (const name of accountNames) {
      const entry = lookup.get(date)?.get(name)
      row[name] = entry?.balance ?? null
      row[`${name}__net`] = entry?.net ?? null
    }
    return row
  })

  const unitLabel = unit === 'month' ? 'monthly' : unit === 'week' ? 'weekly' : 'daily'

  return (
    <div>
      <p className="text-xs text-fg-faint mb-3">
        {unitLabel} buckets &middot; {accountNames.length} account{accountNames.length !== 1 ? 's' : ''} &middot; closing balance per bucket
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--kk-border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--kk-fg-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatINR}
            tick={{ fontSize: 11, fill: 'var(--kk-fg-faint)' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: 'var(--kk-fg-muted)', paddingTop: 8 }}
          />
          {accountNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
