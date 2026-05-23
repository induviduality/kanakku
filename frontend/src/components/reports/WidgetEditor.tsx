import { useState } from 'react'
import type { Widget } from '../../api/reports'
import { useRunQuery } from '../../api/reports'
import QueryEditor from './QueryEditor'
import SchemaReferencePanel from './SchemaReferencePanel'
import StarterQueryLibrary from './StarterQueryLibrary'
import WidgetRenderer from './WidgetRenderer'

type VizType = 'bar' | 'line' | 'pie' | 'kpi' | 'table'

interface WidgetEditorProps {
  initial?: Partial<Widget>
  onSave: (data: Omit<Widget, 'id' | 'dashboard_id' | 'created_at' | 'updated_at'>) => void
  onCancel: () => void
}

const VIZ_TYPES: { value: VizType; label: string }[] = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'kpi', label: 'KPI' },
  { value: 'table', label: 'Table' },
]

export default function WidgetEditor({ initial, onSave, onCancel }: WidgetEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [query, setQuery] = useState(initial?.query ?? '')
  const [vizType, setVizType] = useState<VizType>((initial?.viz_type as VizType) ?? 'table')
  const [vizConfig, setVizConfig] = useState<string>(
    initial?.viz_config ? JSON.stringify(initial.viz_config, null, 2) : '{}',
  )
  const [showSchema, setShowSchema] = useState(false)
  const [previewData, setPreviewData] = useState<{ columns: string[]; rows: Record<string, unknown>[] } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const runQuery = useRunQuery()

  function handleColumnClick(col: string, table: string) {
    setQuery((prev) => prev + (prev ? '\n' : '') + `${table}.${col}`)
  }

  async function handlePreview() {
    setPreviewError(null)
    try {
      const result = await runQuery.mutateAsync({ sql: query })
      setPreviewData({ columns: result.columns, rows: result.rows })
    } catch (err) {
      let msg = 'Query failed'
      if (err instanceof Response) {
        try {
          const body = await err.json()
          msg = body.detail ?? msg
        } catch {}
      }
      setPreviewError(msg)
    }
  }

  function handleSave() {
    let parsedConfig: Record<string, unknown> = {}
    try {
      parsedConfig = JSON.parse(vizConfig)
    } catch {}
    onSave({
      title,
      query,
      viz_type: vizType,
      viz_config: parsedConfig,
      position: initial?.position ?? { x: 0, y: 0, w: 6, h: 4 },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Widget editor">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {initial?.id ? 'Edit Widget' : 'New Widget'}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Schema panel */}
          {showSchema && (
            <div className="w-56 border-r border-gray-200 overflow-y-auto">
              <SchemaReferencePanel onColumnClick={handleColumnClick} />
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Widget title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Spending by Category"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Widget title"
              />
            </div>

            {/* Query */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-700">SQL Query</label>
                <button
                  className="text-xs text-indigo-600 hover:underline"
                  onClick={() => setShowSchema((p) => !p)}
                >
                  {showSchema ? 'Hide schema' : 'Show schema'}
                </button>
              </div>

              {/* Starter queries */}
              <details className="mb-2">
                <summary className="cursor-pointer text-xs text-gray-500 hover:text-indigo-600">
                  Load starter query…
                </summary>
                <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                  <StarterQueryLibrary onSelect={setQuery} />
                </div>
              </details>

              <QueryEditor
                value={query}
                onChange={setQuery}
                onRun={handlePreview}
                disabled={runQuery.isPending}
              />
            </div>

            {/* Preview */}
            {previewError && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{previewError}</p>
            )}
            {previewData && (
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 h-48">
                <WidgetRenderer
                  vizType={vizType}
                  vizConfig={vizConfig ? (() => { try { return JSON.parse(vizConfig) } catch { return {} } })() : {}}
                  data={previewData.rows}
                  columns={previewData.columns}
                />
              </div>
            )}

            {/* Viz type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Visualization type</label>
              <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Visualization type">
                {VIZ_TYPES.map((vt) => (
                  <button
                    key={vt.value}
                    role="radio"
                    aria-checked={vizType === vt.value}
                    onClick={() => setVizType(vt.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      vizType === vt.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {vt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Viz config */}
            {vizType !== 'table' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Chart config (JSON)
                </label>
                <textarea
                  value={vizConfig}
                  onChange={(e) => setVizConfig(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Visualization config"
                  placeholder='{"x_key": "month", "y_key": "total"}'
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !query.trim()}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            aria-label="Save widget"
          >
            Save Widget
          </button>
        </div>
      </div>
    </div>
  )
}
