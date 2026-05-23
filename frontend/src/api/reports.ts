import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api-client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string
  type: string
  description: string
  foreign_key: string | null
}

export interface TableInfo {
  name: string
  description: string
  columns: ColumnInfo[]
}

export interface SchemaResponse {
  tables: TableInfo[]
}

export interface QueryRequest {
  sql: string
  params?: Record<string, string>
}

export interface QueryResponse {
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
  truncated: boolean
}

export interface Dashboard {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Widget {
  id: string
  dashboard_id: string
  title: string
  query: string
  viz_type: 'bar' | 'line' | 'pie' | 'kpi' | 'table'
  viz_config: Record<string, unknown> | null
  position: { x: number; y: number; w: number; h: number } | null
  created_at: string
  updated_at: string
}

// ── Schema ────────────────────────────────────────────────────────────────────

export function useGetSchema() {
  return useQuery<SchemaResponse>({
    queryKey: ['reports', 'schema'],
    queryFn: () => apiGet<SchemaResponse>('/reports/schema'),
  })
}

// ── Query ─────────────────────────────────────────────────────────────────────

export function useRunQuery() {
  return useMutation<QueryResponse, Response, QueryRequest>({
    mutationFn: (req) => apiPost<QueryResponse>('/reports/query', req),
  })
}

// ── Dashboards ────────────────────────────────────────────────────────────────

export function useGetDashboards() {
  return useQuery<Dashboard[]>({
    queryKey: ['reports', 'dashboards'],
    queryFn: () => apiGet<Dashboard[]>('/reports/dashboards'),
  })
}

export function useGetDashboard(id: string) {
  return useQuery<Dashboard>({
    queryKey: ['reports', 'dashboards', id],
    queryFn: () => apiGet<Dashboard>(`/reports/dashboards/${id}`),
  })
}

export function useCreateDashboard() {
  const qc = useQueryClient()
  return useMutation<Dashboard, Response, { name: string; description?: string }>({
    mutationFn: (body) => apiPost<Dashboard>('/reports/dashboards', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'dashboards'] }),
  })
}

export function useUpdateDashboard(id: string) {
  const qc = useQueryClient()
  return useMutation<Dashboard, Response, { name?: string; description?: string }>({
    mutationFn: (body) => apiPatch<Dashboard>(`/reports/dashboards/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'dashboards'] }),
  })
}

export function useDeleteDashboard() {
  const qc = useQueryClient()
  return useMutation<void, Response, string>({
    mutationFn: (id) => apiDelete(`/reports/dashboards/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'dashboards'] }),
  })
}

// ── Widgets ───────────────────────────────────────────────────────────────────

export function useGetWidgets(dashboardId: string) {
  return useQuery<Widget[]>({
    queryKey: ['reports', 'dashboards', dashboardId, 'widgets'],
    queryFn: () => apiGet<Widget[]>(`/reports/dashboards/${dashboardId}/widgets`),
  })
}

export function useCreateWidget(dashboardId: string) {
  const qc = useQueryClient()
  return useMutation<Widget, Response, Omit<Widget, 'id' | 'dashboard_id' | 'created_at' | 'updated_at'>>({
    mutationFn: (body) => apiPost<Widget>(`/reports/dashboards/${dashboardId}/widgets`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['reports', 'dashboards', dashboardId, 'widgets'] }),
  })
}

export function useUpdateWidget(dashboardId: string, widgetId: string) {
  const qc = useQueryClient()
  return useMutation<Widget, Response, Partial<Omit<Widget, 'id' | 'dashboard_id' | 'created_at' | 'updated_at'>>>({
    mutationFn: (body) =>
      apiPatch<Widget>(`/reports/dashboards/${dashboardId}/widgets/${widgetId}`, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['reports', 'dashboards', dashboardId, 'widgets'] }),
  })
}

export function useDeleteWidget(dashboardId: string) {
  const qc = useQueryClient()
  return useMutation<void, Response, string>({
    mutationFn: (widgetId) =>
      apiDelete(`/reports/dashboards/${dashboardId}/widgets/${widgetId}`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['reports', 'dashboards', dashboardId, 'widgets'] }),
  })
}
