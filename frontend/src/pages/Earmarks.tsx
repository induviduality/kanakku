import { useState } from 'react'
import { Plus, PiggyBank, Landmark, Pencil, Trash2, Power, AlertTriangle } from 'lucide-react'
import { useGetEarmarks, useToggleEarmark, useDeleteEarmark, type Earmark } from '../api/earmarks'
import { useGetDashboard } from '../api/dashboard'
import { EarmarkDrawer } from '../components/earmarks/EarmarkDrawer'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../lib/toast'

export default function Earmarks() {
  const { data: earmarks = [], isLoading } = useGetEarmarks()
  const { data: dashboard } = useGetDashboard()
  const toggleEarmark = useToggleEarmark()
  const deleteEarmark = useDeleteEarmark()
  const { toast } = useToast()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedEarmarkId, setSelectedEarmarkId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Earmark | null>(null)

  const activeEarmarks = earmarks.filter((e) => e.is_active)
  const inactiveEarmarks = earmarks.filter((e) => !e.is_active)

  const totalEarmarked = activeEarmarks.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0
  )

  const totalCash = dashboard
    ? dashboard.account_balances
        .filter((a) => a.type === 'bank' || a.type === 'cash')
        .reduce((s, a) => s + parseFloat(a.balance), 0)
    : 0

  const availableCash = totalCash - totalEarmarked
  const isOvercommitted = totalEarmarked > totalCash

  const handleEdit = (id: string) => {
    setSelectedEarmarkId(id)
    setDrawerOpen(true)
  }

  const handleCreate = () => {
    setSelectedEarmarkId(null)
    setDrawerOpen(true)
  }

  const handleToggle = (id: string) => {
    toggleEarmark.mutate(id, {
      onSuccess: (res) => {
        toast(res.is_active ? 'Earmark activated.' : 'Earmark paused.')
      },
      onError: (err: any) => {
        const detail = err?.response?.data?.detail || 'Failed to toggle earmark.'
        toast(detail, 'error')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-fg tracking-tight">Earmarks</h1>
          <p className="text-xs md:text-sm text-fg-faint mt-1">
            Reserve portions of your cash for specific purposes without moving money or recording transactions.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="kk-btn kk-btn-primary self-start sm:self-auto flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New Earmark
        </button>
      </div>

      {/* Global Overcommit Alert Banner */}
      {isOvercommitted && (
        <div className="kk-panel bg-negative/10 border-negative/30 flex items-start gap-3 py-3 px-4">
          <AlertTriangle className="w-5 h-5 text-negative shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-negative">Total Earmarks exceed Cash in Hand</p>
            <p className="text-fg-dim mt-0.5">
              You have earmarked ₹{totalEarmarked.toLocaleString('en-IN')}, but your cash balance is ₹{totalCash.toLocaleString('en-IN')}. Consider releasing or reducing earmarks.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="kk-card">
          <p className="kk-label">Total Earmarked</p>
          <p className="text-2xl font-bold text-fg mt-1 kk-mono">
            ₹{totalEarmarked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-fg-faint mt-1">
            {activeEarmarks.length} active reservation{activeEarmarks.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="kk-card">
          <p className="kk-label">Available Cash</p>
          <p className={`text-2xl font-bold mt-1 kk-mono ${isOvercommitted ? 'text-negative' : 'text-positive-dim'}`}>
            ₹{availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-fg-faint mt-1">
            Safe to spend without touching earmarks
          </p>
        </div>

        <div className="kk-card">
          <p className="kk-label">Total Cash in Hand</p>
          <p className="text-2xl font-bold text-fg mt-1 kk-mono">
            ₹{totalCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-fg-faint mt-1">
            Across all bank & cash accounts
          </p>
        </div>
      </div>

      {/* Content */}
      {earmarks.length === 0 ? (
        <EmptyState
          title="No earmarks yet"
          description="Earmarks let you mentally set aside money (e.g. ₹50k for emergency fund, ₹10k for laptop) from your cash balance."
          action={
            <button
              onClick={handleCreate}
              className="kk-btn kk-btn-primary inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Earmark
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Active Earmarks */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
              <span>Active Earmarks</span>
              <span className="text-xs font-normal text-fg-faint">({activeEarmarks.length})</span>
            </h2>

            {activeEarmarks.length === 0 ? (
              <p className="text-xs text-fg-faint italic">No active earmarks. All earmarks are paused.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeEarmarks.map((e) => (
                  <div
                    key={e.id}
                    className="kk-card relative hover:border-accent/40 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      {/* Top row: Icon/Color, Name, Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-base shadow-sm"
                            style={{ backgroundColor: e.color ? `${e.color}20` : 'var(--kk-surface-2)' }}
                          >
                            {e.icon || '🏷️'}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-fg truncate">{e.name}</h3>
                            <p className="text-lg font-bold text-fg kk-mono mt-0.5">
                              ₹{parseFloat(e.amount).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggle(e.id)}
                            className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                            title="Pause earmark"
                          >
                            <Power className="w-4 h-4 text-positive" />
                          </button>
                          <button
                            onClick={() => handleEdit(e.id)}
                            className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                            title="Edit earmark"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(e)}
                            className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
                            title="Delete earmark"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Notes if any */}
                      {e.notes && (
                        <p className="text-xs text-fg-muted mt-3 line-clamp-2">{e.notes}</p>
                      )}
                    </div>

                    {/* Footer Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border text-[11px]">
                      {e.account_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 text-fg-dim">
                          <Landmark className="w-3 h-3 text-fg-faint" />
                          {e.account_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 text-fg-faint">
                          General Cash Pool
                        </span>
                      )}

                      {e.piggy_bank_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-positive/10 text-positive-dim font-medium">
                          <PiggyBank className="w-3 h-3 text-positive" />
                          Goal: {e.piggy_bank_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inactive / Paused Earmarks */}
          {inactiveEarmarks.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h2 className="text-sm font-semibold text-fg-muted flex items-center gap-2">
                <span>Paused Earmarks</span>
                <span className="text-xs font-normal text-fg-faint">({inactiveEarmarks.length})</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60 hover:opacity-100 transition-opacity">
                {inactiveEarmarks.map((e) => (
                  <div
                    key={e.id}
                    className="kk-card bg-surface/50 border-dashed relative flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center shrink-0 text-base grayscale">
                            {e.icon || '🏷️'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-fg line-through truncate">{e.name}</h3>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-2 text-fg-faint">
                                Paused
                              </span>
                            </div>
                            <p className="text-base font-semibold text-fg-muted kk-mono mt-0.5">
                              ₹{parseFloat(e.amount).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggle(e.id)}
                            className="p-1.5 rounded text-fg-muted hover:text-positive hover:bg-surface-2 transition-colors"
                            title="Activate earmark"
                          >
                            <Power className="w-4 h-4 text-fg-faint hover:text-positive" />
                          </button>
                          <button
                            onClick={() => handleEdit(e.id)}
                            className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                            title="Edit earmark"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(e)}
                            className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
                            title="Delete earmark"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      <EarmarkDrawer
        open={drawerOpen}
        earmarkId={selectedEarmarkId}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete Earmark"
          description={`Delete "${deleteTarget.name}"? The earmarked amount will be released back to available cash. This can be undone within 30 days.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={() => {
            deleteEarmark.mutate(deleteTarget.id, {
              onSuccess: () => {
                setDeleteTarget(null)
                toast('Earmark deleted.')
              },
              onError: () => toast('Failed to delete earmark.', 'error'),
            })
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
