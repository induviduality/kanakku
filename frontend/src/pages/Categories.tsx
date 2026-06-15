import { useState } from 'react'
import {
  useCategories,
  useCreateCategory,
  usePatchCategory,
  useDeleteCategory,
  useSeedDefaultCategories,
  type Category,
} from '../api/categories'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../lib/toast'

const APPLICABILITY_LABELS: Record<string, string> = {
  expense: 'Expenses',
  income: 'Income',
  both: 'Both',
}

export default function Categories() {
  const { data: categories = [], isLoading } = useCategories()
  const createCategory = useCreateCategory()
  const patchCategory = usePatchCategory()
  const deleteCategory = useDeleteCategory()
  const seedDefaults = useSeedDefaultCategories()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('')
  const [applicability, setApplicability] = useState<Category['applicability']>(null)

  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editApplicability, setEditApplicability] = useState<Category['applicability']>(null)

  function openEdit(c: Category) {
    setEditTarget(c)
    setEditName(c.name)
    setEditIcon(c.icon ?? '')
    setEditColor(c.color ?? '')
    setEditApplicability(c.applicability)
  }

  function closeCreate() {
    setCreateOpen(false)
    setName('')
    setIcon('')
    setColor('')
    setApplicability(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createCategory.mutateAsync({
        name,
        icon: icon || undefined,
        color: color || undefined,
        applicability: applicability ?? undefined,
      })
      closeCreate()
    } catch {
      toast('Failed to create category. Please try again.', 'error')
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    try {
      await patchCategory.mutateAsync({
        id: editTarget.id,
        patch: {
          name: editName,
          icon: editIcon || undefined,
          color: editColor || undefined,
          applicability: editApplicability ?? undefined,
        },
      })
      setEditTarget(null)
    } catch {
      toast('Failed to update category. Please try again.', 'error')
    }
  }

  const active = categories.filter((c) => !c.deleted_at)

  return (
    <main className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-fg">Categories</h1>
        <div className="flex gap-2">
          {active.length === 0 && (
            <button
              onClick={() => seedDefaults.mutate()}
              disabled={seedDefaults.isPending}
              className="kk-btn-ghost disabled:opacity-50 text-sm"
            >
              {seedDefaults.isPending ? 'Seeding…' : 'Seed defaults'}
            </button>
          )}
          <button onClick={() => setCreateOpen(true)} className="kk-btn-primary text-sm">
            + Add category
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse bg-surface-2 rounded-xl" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="kk-card py-16 text-center">
          <p className="text-fg-faint text-sm mb-4">No categories yet.</p>
          <button
            onClick={() => seedDefaults.mutate()}
            disabled={seedDefaults.isPending}
            className="kk-btn-primary text-sm"
          >
            {seedDefaults.isPending ? 'Seeding…' : 'Seed defaults'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {active.map((c) => (
            <div key={c.id} className="kk-card flex items-center gap-3 px-4 py-3">
              {c.color ? (
                <span
                  className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm"
                  style={{ backgroundColor: c.color + '33', color: c.color }}
                >
                  {c.icon ?? '●'}
                </span>
              ) : (
                <span className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm bg-surface-2 text-fg-faint">
                  {c.icon ?? '●'}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-fg truncate">{c.name}</p>
                {c.applicability && (
                  <p className="text-xs text-fg-faint">{APPLICABILITY_LABELS[c.applicability]}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => openEdit(c)}
                  className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteTarget(c)}
                  className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeCreate() }}
        >
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm border border-border/50">
            <div className="px-5 py-4 border-b border-border/50">
              <h2 className="font-semibold text-fg">Add category</h2>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              <CategoryFields
                name={name} setName={setName}
                icon={icon} setIcon={setIcon}
                color={color} setColor={setColor}
                applicability={applicability} setApplicability={setApplicability}
              />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeCreate} className="kk-btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={createCategory.isPending} className="kk-btn-primary text-sm disabled:opacity-50">
                  {createCategory.isPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null) }}
        >
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm border border-border/50">
            <div className="px-5 py-4 border-b border-border/50">
              <h2 className="font-semibold text-fg">Edit category</h2>
            </div>
            <form onSubmit={handleEdit} className="px-5 py-4 space-y-4">
              <CategoryFields
                name={editName} setName={setEditName}
                icon={editIcon} setIcon={setEditIcon}
                color={editColor} setColor={setEditColor}
                applicability={editApplicability} setApplicability={setEditApplicability}
              />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditTarget(null)} className="kk-btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={patchCategory.isPending} className="kk-btn-primary text-sm disabled:opacity-50">
                  {patchCategory.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete category"
        description={`Delete "${deleteTarget?.name}"? This can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) {
            try {
              await deleteCategory.mutateAsync(deleteTarget.id)
            } catch {
              toast('Failed to delete category. Please try again.', 'error')
            }
          }
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  )
}

function CategoryFields({
  name, setName,
  icon, setIcon,
  color, setColor,
  applicability, setApplicability,
}: {
  name: string; setName: (v: string) => void
  icon: string; setIcon: (v: string) => void
  color: string; setColor: (v: string) => void
  applicability: Category['applicability']; setApplicability: (v: Category['applicability']) => void
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-fg-muted mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="kk-input"
          placeholder="e.g. Groceries"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-fg-muted mb-1">Icon (emoji)</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="🛒"
            className="kk-input"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-fg-muted mb-1">Color</label>
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6366F1"
            className="kk-input"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-fg-muted mb-1">Applies to</label>
        <select
          value={applicability ?? ''}
          onChange={(e) => setApplicability((e.target.value as Category['applicability']) || null)}
          className="kk-input"
        >
          <option value="">Any transaction</option>
          <option value="expense">Expenses only</option>
          <option value="income">Income only</option>
          <option value="both">Both</option>
        </select>
      </div>
    </>
  )
}
