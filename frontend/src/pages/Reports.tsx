import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useGetDashboards, useCreateDashboard, useDeleteDashboard } from '../api/reports'
import type { Dashboard } from '../api/reports'

function DashboardCard({ dashboard, onDelete }: { dashboard: Dashboard; onDelete: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{dashboard.name}</h3>
          {dashboard.description && (
            <p className="text-sm text-gray-500 mt-0.5">{dashboard.description}</p>
          )}
        </div>
        <button
          onClick={() => onDelete(dashboard.id)}
          className="text-gray-400 hover:text-red-500 text-sm ml-2"
          aria-label={`Delete dashboard ${dashboard.name}`}
        >
          ✕
        </button>
      </div>
      <Link
        to={`/reports/${dashboard.id}` as any}
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline font-medium"
      >
        Open dashboard →
      </Link>
    </div>
  )
}

export default function Reports() {
  const { data: dashboards, isLoading } = useGetDashboards()
  const createDashboard = useCreateDashboard()
  const deleteDashboard = useDeleteDashboard()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  async function handleCreate() {
    if (!newName.trim()) return
    await createDashboard.mutateAsync({ name: newName.trim(), description: newDesc.trim() || undefined })
    setNewName('')
    setNewDesc('')
    setShowCreate(false)
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Custom dashboards with SQL-powered widgets</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
          aria-label="Create new dashboard"
        >
          + New Dashboard
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3" role="form" aria-label="Create dashboard form">
          <h2 className="font-semibold text-gray-900">New Dashboard</h2>
          <input
            type="text"
            placeholder="Dashboard name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Dashboard name"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Dashboard description"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createDashboard.isPending}
              className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (!dashboards || dashboards.length === 0) && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">No dashboards yet</p>
          <p className="text-sm mt-1">Create your first dashboard to start building reports.</p>
        </div>
      )}

      {dashboards && dashboards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dashboards.map((d) => (
            <DashboardCard key={d.id} dashboard={d} onDelete={(id) => deleteDashboard.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  )
}
