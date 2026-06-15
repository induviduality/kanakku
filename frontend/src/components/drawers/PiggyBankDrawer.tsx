import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { Drawer, DrawerSection, DrawerRow } from '../Drawer'
import { useGetPiggyBank, useGetContributions, useRemoveContribution, useDeletePiggyBank } from '../../api/piggy_banks'
import ConfirmDialog from '../ConfirmDialog'

function ProgressRing({ pct }: { pct: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, pct))
  const targetOffset = circ * (1 - clamped / 100)
  const [animOffset, setAnimOffset] = useState(circ)
  const color = clamped >= 100 ? 'var(--kk-positive)' : clamped >= 70 ? 'var(--kk-warning)' : 'var(--kk-accent)'

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimOffset(targetOffset))
    return () => cancelAnimationFrame(id)
  }, [targetOffset])

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="rotate-[-90deg]">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="44" cy="44" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={animOffset}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </svg>
  )
}

interface Props {
  piggyId: string | null
  onClose: () => void
}

export function PiggyBankDrawer({ piggyId, onClose }: Props) {
  const { data: pig, isLoading } = useGetPiggyBank(piggyId)
  const { data: contributions = [], isLoading: contribLoading } = useGetContributions(piggyId)
  const remove = useRemoveContribution()
  const deletePiggy = useDeletePiggyBank()
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <Drawer open={!!piggyId} onClose={onClose} title={pig?.name ?? 'Savings goal'}>
      {isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />)}
        </div>
      ) : pig ? (
        <div className="space-y-6 p-5">
          {/* Hero */}
          <div className="kk-panel flex items-center gap-5">
            <div className="relative shrink-0">
              <ProgressRing pct={pig.progress_pct} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-fg kk-mono">{pig.progress_pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">{pig.name}</p>
              {pig.is_completed && (
                <span className="kk-chip kk-chip-positive mt-1">Completed</span>
              )}
              <p className="mt-2 text-xs text-fg-faint kk-mono">
                {pig.currency} {parseFloat(pig.current_amount).toLocaleString('en-IN')}
                {' '}<span className="text-fg-muted">/ {parseFloat(pig.target_amount).toLocaleString('en-IN')}</span>
              </p>
              {pig.target_date && (
                <p className="mt-1 text-xs text-fg-faint">Target: {pig.target_date}</p>
              )}
            </div>
          </div>

          {/* Details */}
          <DrawerSection label="Details">
            <div className="kk-panel">
              <DrawerRow label="Currency" value={pig.currency} />
              <DrawerRow
                label="Progress"
                value={<span className="kk-mono">{pig.progress_pct.toFixed(1)}%</span>}
              />
              {pig.target_date && <DrawerRow label="Target date" value={pig.target_date} />}
              {pig.notes && <DrawerRow label="Notes" value={pig.notes} />}
            </div>
          </DrawerSection>

          {/* Contributions */}
          <DrawerSection label={`Contributions (${contributions.length})`}>
            {contribLoading ? (
              <div className="h-10 animate-pulse rounded-lg bg-surface-2" />
            ) : contributions.length === 0 ? (
              <p className="text-xs text-fg-faint">No contributions yet.</p>
            ) : (
              <div className="kk-panel divide-y divide-border p-0 overflow-hidden">
                {contributions.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-fg kk-mono">₹{parseFloat(c.amount).toLocaleString('en-IN')}</span>
                      <span className="ml-2 text-xs text-fg-muted capitalize">{c.contribution_type}</span>
                      <p className="text-xs text-fg-faint mt-0.5">{c.date}</p>
                    </div>
                    <button
                      onClick={() => setRemoveTarget(c.id)}
                      className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
                      title="Remove contribution"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>

          {/* Danger zone */}
          <div className="pt-2 border-t border-border">
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-1.5 text-xs text-negative-dim hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete piggy bank
            </button>
          </div>
        </div>
      ) : (
        <p className="p-5 text-sm text-negative-dim">Savings goal not found.</p>
      )}

      {removeTarget && pig && (
        <ConfirmDialog
          open
          title="Remove contribution"
          description="Remove this contribution? The amount will be deducted from the total."
          confirmLabel="Remove"
          isDestructive
          onConfirm={() => {
            remove.mutate(
              { piggyId: pig.id, contribId: removeTarget },
              { onSuccess: () => setRemoveTarget(null) },
            )
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      {pig && (
        <ConfirmDialog
          open={deleteOpen}
          title="Delete piggy bank"
          description={`Delete "${pig.name}"? Contributions will be unlinked but the linked transactions will not be deleted. This can be undone within 30 days.`}
          confirmLabel="Delete"
          isDestructive
          onConfirm={() => {
            deletePiggy.mutate(pig.id, { onSuccess: () => { setDeleteOpen(false); onClose() } })
          }}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </Drawer>
  )
}
