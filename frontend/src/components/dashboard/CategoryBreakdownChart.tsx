import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CategoryBreakdownItem } from '../../api/dashboard'

// Palette chosen for legibility on dark backgrounds — saturated mid-range hues.
const CHART_COLORS = [
  'var(--kk-accent)',       // purple
  '#f97316',                // orange
  'var(--kk-positive)',     // green
  '#3b82f6',                // blue
  '#ec4899',                // pink
  '#06b6d4',                // cyan
  'var(--kk-warning)',      // amber
  'var(--kk-negative)',     // red
  '#84cc16',                // lime
  '#8b5cf6',                // violet
]

const tooltipStyle = {
  backgroundColor: 'var(--kk-bg-3)',
  border: '1px solid var(--kk-border-strong)',
  borderRadius: 'var(--kk-radius-md)',
  color: 'var(--kk-fg)',
  fontSize: 12,
}

export default function CategoryBreakdownChart({ items }: { items: CategoryBreakdownItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-fg-muted text-center py-6">No expenses this month</p>
    )
  }

  const data = items.map((item) => ({
    name: item.name,
    value: parseFloat(item.amount),
    percentage: item.percentage,
  }))

  return (
    <div aria-label="category breakdown chart">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            dataKey="value"
            paddingAngle={2}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={((value: number) => `₹${value.toLocaleString('en-IN')}`) as unknown as never}
            labelStyle={{ color: 'var(--kk-fg-muted)', fontSize: 11 }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: 'var(--kk-fg-muted)', fontSize: 12 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
