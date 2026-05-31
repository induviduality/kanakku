import { useState, useEffect, useRef } from 'react'
import { useParams } from '@tanstack/react-router'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const GridLayoutAsAny = GridLayout as any
import {
  useGetDashboard,
  useGetWidgets,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget,
  useRunQuery,
} from '../api/reports'
import { apiPatch } from '../lib/api-client'
import type { Widget } from '../api/reports'
import WidgetRenderer from '../components/reports/WidgetRenderer'
import WidgetEditor from '../components/reports/WidgetEditor'

interface WidgetWithData extends Widget {
  queryData?: { columns: string[]; rows: Record<string, unknown>[] }
  queryError?: string
}

function WidgetCard({
  widget,
  onEdit,
  onDelete,
}: {
  widget: WidgetWithData
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-800 truncate">{widget.title}</span>
        <div className="flex gap-1 ml-2">
          <button
            onClick={onEdit}
            className="text-xs text-gray-400 hover:text-indigo-600 px-1"
            aria-label={`Edit widget ${widget.title}`}
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-gray-400 hover:text-red-500 px-1"
            aria-label={`Delete widget ${widget.title}`}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 p-2">
        {widget.queryError ? (
          <p className="text-xs text-red-500 p-2">{widget.queryError}</p>
        ) : widget.queryData ? (
          <WidgetRenderer
            vizType={widget.viz_type}
            vizConfig={widget.viz_config}
            data={widget.queryData.rows}
            columns={widget.queryData.columns}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-gray-400">
            Loading…
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportDashboard() {
  const { dashboardId } = useParams({ strict: false }) as { dashboardId: string }
  const { data: dashboard } = useGetDashboard(dashboardId)
  const { data: widgets, isLoading } = useGetWidgets(dashboardId)
  const createWidget = useCreateWidget(dashboardId)
  const deleteWidget = useDeleteWidget(dashboardId)
  const runQuery = useRunQuery()

  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [widgetData, setWidgetData] = useState<Record<string, { columns: string[]; rows: Record<string, unknown>[] } | { error: string }>>({})
  const loadingRef = useRef(new Set<string>())

  async function loadWidgetData(widget: Widget) {
    if (loadingRef.current.has(widget.id)) return
    loadingRef.current.add(widget.id)
    try {
      const result = await runQuery.mutateAsync({ sql: widget.query })
      setWidgetData((prev) => ({
        ...prev,
        [widget.id]: { columns: result.columns, rows: result.rows },
      }))
    } catch {
      setWidgetData((prev) => ({ ...prev, [widget.id]: { error: 'Failed to load' } }))
    }
  }

  useEffect(() => {
    if (widgets) {
      widgets.forEach((widget) => {
        if (!widgetData[widget.id]) {
          loadWidgetData(widget)
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets])

  const updateWidget = useUpdateWidget(dashboardId, editingWidget?.id ?? 'noop')

  async function handleSaveWidget(data: Omit<Widget, 'id' | 'dashboard_id' | 'created_at' | 'updated_at'>) {
    if (editingWidget) {
      await updateWidget.mutateAsync(data)
    } else {
      await createWidget.mutateAsync(data)
    }
    setEditingWidget(null)
    setShowCreate(false)
  }

  const layout = (widgets ?? []).map((w) => ({
    i: w.id,
    x: w.position?.x ?? 0,
    y: w.position?.y ?? 0,
    w: w.position?.w ?? 6,
    h: w.position?.h ?? 4,
  }))

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{dashboard?.name ?? '…'}</h1>
          {dashboard?.description && (
            <p className="text-sm text-gray-500">{dashboard.description}</p>
          )}
        </div>
        <button
          onClick={() => { setEditingWidget(null); setShowCreate(true) }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          aria-label="Add widget"
        >
          + Add Widget
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!isLoading && widgets && widgets.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="font-medium">No widgets yet</p>
          <p className="text-sm mt-1">Add a widget to start visualizing your data.</p>
        </div>
      )}

      {widgets && widgets.length > 0 && (
        <div className="overflow-x-auto">
          <GridLayoutAsAny
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={60}
            width={1200}
            onLayoutChange={(newLayout: any) => {
              newLayout.forEach((item: any) => {
                apiPatch(
                  `/reports/dashboards/${dashboardId}/widgets/${item.i}`,
                  { position: { x: item.x, y: item.y, w: item.w, h: item.h } },
                ).catch(() => {})
              })
            }}
          >
            {widgets.map((widget) => {
              const wd = widgetData[widget.id]
              const withData: WidgetWithData = {
                ...widget,
                queryData: wd && 'columns' in wd ? wd : undefined,
                queryError: wd && 'error' in wd ? wd.error : undefined,
              }
              return (
                <div key={widget.id}>
                  <WidgetCard
                    widget={withData}
                    onEdit={() => { setEditingWidget(widget); setShowCreate(true) }}
                    onDelete={() => deleteWidget.mutate(widget.id)}
                  />
                </div>
              )
            })}
          </GridLayoutAsAny>
        </div>
      )}

      {(showCreate || editingWidget) && (
        <WidgetEditor
          initial={editingWidget ?? undefined}
          onSave={handleSaveWidget}
          onCancel={() => { setShowCreate(false); setEditingWidget(null) }}
        />
      )}
    </div>
  )
}
