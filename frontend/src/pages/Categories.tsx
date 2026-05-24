import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  useCategories,
  useCreateCategory,
  usePatchCategory,
  useDeleteCategory,
  useSeedDefaultCategories,
  type Category,
} from '../api/categories'
import DataTable, { type Column } from '../components/DataTable'
import EntityModal from '../components/EntityModal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Categories() {
  const { data: categories = [], isLoading } = useCategories()
  const createCategory = useCreateCategory()
  const patchCategory = usePatchCategory()
  const deleteCategory = useDeleteCategory()
  const seedDefaults = useSeedDefaultCategories()

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

  function openEdit(c: Category) {
    setEditTarget(c)
    setEditName(c.name)
    setEditIcon(c.icon ?? '')
    setEditColor(c.color ?? '')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createCategory.mutateAsync({
      name,
      icon: icon || undefined,
      color: color || undefined,
      applicability: applicability ?? undefined,
    })
    setName('')
    setIcon('')
    setColor('')
    setApplicability(null)
    setCreateOpen(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    await patchCategory.mutateAsync({
      id: editTarget.id,
      patch: { name: editName, icon: editIcon || undefined, color: editColor || undefined },
    })
    setEditTarget(null)
  }

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (c) => (
        <span>
          {c.icon && <span className="mr-1">{c.icon}</span>}
          {c.name}
        </span>
      ),
    },
    {
      key: 'color',
      header: 'Color',
      render: (c) =>
        c.color ? (
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: c.color }}
            />
            {c.color}
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'applicability', header: 'For', render: (c) => c.applicability ?? 'any' },
  ]

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <div className="flex gap-2">
          {categories.length === 0 && (
            <button
              onClick={() => seedDefaults.mutate()}
              disabled={seedDefaults.isPending}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              {seedDefaults.isPending ? 'Seeding…' : 'Seed defaults'}
            </button>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Add category
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading categories…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={categories}
          keyField="id"
          emptyMessage="No categories yet. Use 'Seed defaults' to get started."
          actions={(c) => (
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        />
      )}

      <EntityModal open={createOpen} onClose={() => setCreateOpen(false)} title="Add category">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="cat-icon" className="block text-sm font-medium text-gray-700">Icon (emoji)</label>
            <input
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🍔"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="cat-color" className="block text-sm font-medium text-gray-700">Color</label>
            <input
              id="cat-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#FF6B6B"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="cat-applicability" className="block text-sm font-medium text-gray-700">Applies to</label>
            <select
              id="cat-applicability"
              value={applicability ?? ''}
              onChange={(e) =>
                setApplicability((e.target.value as Category['applicability']) || null)
              }
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="text-sm text-gray-500">Cancel</button>
            <button
              type="submit"
              disabled={createCategory.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createCategory.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </EntityModal>

      <EntityModal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit category">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-cat-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="edit-cat-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="edit-cat-icon" className="block text-sm font-medium text-gray-700">Icon</label>
            <input
              id="edit-cat-icon"
              value={editIcon}
              onChange={(e) => setEditIcon(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="edit-cat-color" className="block text-sm font-medium text-gray-700">Color</label>
            <input
              id="edit-cat-color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditTarget(null)} className="text-sm text-gray-500">Cancel</button>
            <button
              type="submit"
              disabled={patchCategory.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {patchCategory.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </EntityModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete category"
        description={`Delete "${deleteTarget?.name}"? This can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) await deleteCategory.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  )
}
