import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CategoryBreakdownItem } from '../../api/dashboard'

const COLORS = [
  '#6366f1', '#f97316', '#22c55e', '#3b82f6', '#ec4899',
  '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#f59e0b',
]

export default function CategoryBreakdownChart({ items }: { items: CategoryBreakdownItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">No expenses this month</p>
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
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={((value: number) => `₹${value.toLocaleString('en-IN')}`) as any}
        />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-gray-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
    </div>
  )
}
