import { useState } from 'react'
import { useGetSchema } from '../../api/reports'
import type { TableInfo } from '../../api/reports'

interface SchemaReferencePanelProps {
  onColumnClick?: (column: string, table: string) => void
}

function TableEntry({ table, onColumnClick }: { table: TableInfo; onColumnClick?: (col: string, tbl: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
      >
        <span className="font-mono text-indigo-700">{table.name}</span>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <ul className="px-3 pb-2 space-y-0.5" aria-label={`Columns of ${table.name}`}>
          {table.columns.map((col) => (
            <li key={col.name}>
              <button
                className="w-full flex items-center justify-between text-xs py-0.5 hover:text-indigo-600 text-left group"
                onClick={() => onColumnClick?.(col.name, table.name)}
                title={col.description}
              >
                <span className="font-mono text-gray-700 group-hover:text-indigo-600">{col.name}</span>
                <span className="text-gray-400 ml-2 truncate">{col.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SchemaReferencePanel({ onColumnClick }: SchemaReferencePanelProps) {
  const { data, isLoading } = useGetSchema()
  const [search, setSearch] = useState('')

  const filtered = (data?.tables ?? []).filter(
    (t) =>
      t.name.includes(search.toLowerCase()) ||
      t.columns.some((c) => c.name.includes(search.toLowerCase())),
  )

  return (
    <div className="flex flex-col h-full" aria-label="Schema reference panel">
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Schema Reference</h3>
        <input
          type="text"
          placeholder="Search tables / columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
          aria-label="Search schema"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="p-3 text-xs text-gray-500">Loading schema…</p>
        )}
        {filtered.map((table) => (
          <TableEntry key={table.name} table={table} onColumnClick={onColumnClick} />
        ))}
      </div>
    </div>
  )
}
