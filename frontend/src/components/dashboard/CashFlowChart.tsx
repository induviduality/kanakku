import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { CashFlowBucket } from '../../api/dashboard'

interface ChartRow {
  label: string
  income: number
  expense: number
  net: number
}

function formatLabel(dateStr: string, bucketCount: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (bucketCount <= 12) {
    // monthly buckets — show "Jan", "Feb"
    return d.toLocaleDateString('en-IN', { month: 'short' })
  }
  if (bucketCount <= 14) {
    // weekly buckets — show "12 Jan"
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  // daily buckets — show "12 Jan"
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatINR(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
  return `₹${value.toFixed(0)}`
}

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="kk-card text-xs py-2 px-3 space-y-1 shadow-lg">
      <p className="font-semibold text-fg mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-fg-muted capitalize">{p.name}</span>
          <span className="ml-auto font-medium text-fg kk-mono">
            ₹{p.value.toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CashFlowChart({ buckets }: { buckets: CashFlowBucket[] }) {
  if (buckets.length === 0) {
    return (
      <p className="text-sm text-fg-muted text-center py-8">No transactions in this period.</p>
    )
  }

  const rows: ChartRow[] = buckets.map(b => {
    const income  = parseFloat(b.income)
    const expense = parseFloat(b.expense)
    return { label: formatLabel(b.date, buckets.length), income, expense, net: income - expense }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} barGap={2} barCategoryGap="30%">
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
          width={52}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: 'var(--kk-fg-muted)', paddingTop: 8 }}
        />
        <Bar dataKey="income"  name="Income"  fill="var(--kk-positive)"      radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar dataKey="expense" name="Expense" fill="var(--kk-negative-dim)"  radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
