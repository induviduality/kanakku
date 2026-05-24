import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const CHART_COLORS = [
  'var(--kk-accent)',
  '#f59e0b',
  '#10b981',
  'var(--kk-negative)',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

const tooltipStyle = {
  backgroundColor: 'var(--kk-bg-3)',
  border: '1px solid var(--kk-border-strong)',
  borderRadius: 'var(--kk-radius-md)',
  color: 'var(--kk-fg)',
  fontSize: 12,
}

const axisStyle = { fill: 'var(--kk-fg-faint)', fontSize: 11 }

interface WidgetRendererProps {
  vizType: 'bar' | 'line' | 'pie' | 'kpi' | 'table'
  vizConfig: Record<string, unknown> | null
  data: Record<string, unknown>[]
  columns: string[]
}

function KPIWidget({ data, vizConfig }: { data: Record<string, unknown>[]; vizConfig: Record<string, unknown> | null }) {
  const valueKey = (vizConfig?.value_key as string) ?? ''
  const label = (vizConfig?.label as string) ?? valueKey
  const value = data[0]?.[valueKey] ?? '—'
  return (
    <div className="flex flex-col items-center justify-center h-full py-4">
      <p className="text-3xl font-bold text-fg kk-mono">{String(value)}</p>
      <p className="text-sm text-fg-muted mt-1">{label}</p>
    </div>
  )
}

function TableWidget({ data, columns }: { data: Record<string, unknown>[]; columns: string[] }) {
  return (
    <div className="overflow-auto h-full text-xs">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-2">
            {columns.map((col) => (
              <th key={col} className="px-2 py-1.5 text-left font-medium text-fg-muted border-b border-border">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-surface-2 transition-colors">
              {columns.map((col) => (
                <td key={col} className="px-2 py-1.5 text-fg-dim border-b border-border">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WidgetRenderer({ vizType, vizConfig, data, columns }: WidgetRendererProps) {
  const xKey = (vizConfig?.x_key as string) ?? columns[0] ?? ''
  const yKey = (vizConfig?.y_key as string) ?? columns[1] ?? ''
  const nameKey = (vizConfig?.name_key as string) ?? columns[0] ?? ''
  const valueKey = (vizConfig?.value_key as string) ?? columns[1] ?? ''

  if (vizType === 'kpi') {
    return <KPIWidget data={data} vizConfig={vizConfig} />
  }
  if (vizType === 'table') {
    return <TableWidget data={data} columns={columns} />
  }
  if (vizType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--kk-border)" />
          <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--kk-accent-subtle)' }} />
          <Bar dataKey={yKey} fill="var(--kk-accent)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }
  if (vizType === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--kk-border)" />
          <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey={yKey} stroke="var(--kk-accent)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  if (vizType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius="70%"
            label={({ name }) => name}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    )
  }
  return null
}
