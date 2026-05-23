import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  keyField: keyof T
  actions?: (row: T) => ReactNode
  emptyMessage?: string
}

export default function DataTable<T>({
  columns,
  rows,
  keyField,
  actions,
  emptyMessage = 'No items found.',
}: Props<T>) {
  if (rows.length === 0) {
    return <p className="text-gray-500 py-8 text-center">{emptyMessage}</p>
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row) => (
              <tr key={String(row[keyField])} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-900">
                    {col.render(row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">{actions(row)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {rows.map((row) => (
          <li
            key={String(row[keyField])}
            className="bg-white rounded-lg border border-gray-200 p-4 space-y-2"
          >
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between text-sm">
                <span className="font-medium text-gray-500">{col.header}</span>
                <span className="text-gray-900">{col.render(row)}</span>
              </div>
            ))}
            {actions && <div className="pt-2 border-t border-gray-100">{actions(row)}</div>}
          </li>
        ))}
      </ul>
    </>
  )
}
