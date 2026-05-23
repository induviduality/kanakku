import { useState } from 'react'
import { useGetLLMActivity, type LLMActivityLog } from '../api/settings'

const OPERATIONS = ['', 'suggest_category', 'match_gpay_to_bank']
const BACKENDS = ['', 'ollama', 'none']

function SummaryCell({ log }: { log: LLMActivityLog }) {
  const [expanded, setExpanded] = useState(false)
  const preview = JSON.stringify(log.payload_summary)
  return (
    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
      <button
        className="text-left hover:underline text-indigo-600"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-label="Toggle payload summary"
      >
        {expanded ? '▲ hide' : '▼ show'}
      </button>
      {expanded && (
        <pre className="mt-1 whitespace-pre-wrap break-all text-xs bg-gray-50 p-2 rounded">
          {JSON.stringify(log.payload_summary, null, 2)}
        </pre>
      )}
      {!expanded && (
        <span className="ml-2 text-gray-400 text-xs truncate">{preview}</span>
      )}
    </td>
  )
}

function StatusBadge({ succeeded }: { succeeded: boolean }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        succeeded ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
      aria-label={succeeded ? 'success' : 'failed'}
    >
      {succeeded ? 'ok' : 'failed'}
    </span>
  )
}

export default function SettingsLLMActivity() {
  const [operation, setOperation] = useState('')
  const [backend, setBackend] = useState('')

  const { data: logs, isLoading, isError } = useGetLLMActivity({
    operation: operation || undefined,
    backend: backend || undefined,
  })

  return (
    <main className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">LLM Activity</h1>
      <p className="text-sm text-gray-500 mb-6">All local LLM calls recorded for transparency.</p>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="op-filter">
            Operation
          </label>
          <select
            id="op-filter"
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
            className="rounded border border-gray-300 text-sm px-3 py-1.5"
          >
            {OPERATIONS.map((op) => (
              <option key={op} value={op}>{op || 'All'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="be-filter">
            Backend
          </label>
          <select
            id="be-filter"
            value={backend}
            onChange={(e) => setBackend(e.target.value)}
            className="rounded border border-gray-300 text-sm px-3 py-1.5"
          >
            {BACKENDS.map((be) => (
              <option key={be} value={be}>{be || 'All'}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}
      {isError && <p role="alert" className="text-red-600">Failed to load LLM activity.</p>}

      {!isLoading && !isError && (
        <>
          {(!logs || logs.length === 0) ? (
            <p className="text-gray-500 text-center py-12">No LLM calls recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Timestamp</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Operation</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Backend</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Model</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-700">{log.operation}</td>
                      <td className="px-4 py-3 text-gray-600">{log.backend}</td>
                      <td className="px-4 py-3 text-gray-600">{log.model}</td>
                      <td className="px-4 py-3 text-gray-600">{log.duration_ms} ms</td>
                      <td className="px-4 py-3">
                        <StatusBadge succeeded={log.succeeded} />
                      </td>
                      <SummaryCell log={log} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  )
}
