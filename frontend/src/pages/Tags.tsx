import { useState } from 'react'
import { useTags, useCreateTag, usePatchTag, useDeleteTag, type Tag } from '../api/tags'
import DataTable, { type Column } from '../components/DataTable'
import EntityModal from '../components/EntityModal'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Tags() {
  const { data: tags = [], isLoading } = useTags()
  const createTag = useCreateTag()
  const patchTag = usePatchTag()
  const deleteTag = useDeleteTag()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Tag | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [createError, setCreateError] = useState('')

  function openEdit(t: Tag) {
    setEditTarget(t)
    setEditName(t.name)
    setEditColor(t.color ?? '')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    try {
      await createTag.mutateAsync({ name, color: color || undefined })
      setName('')
      setColor('')
      setCreateOpen(false)
    } catch {
      setCreateError('Tag name already exists.')
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    await patchTag.mutateAsync({ id: editTarget.id, patch: { name: editName, color: editColor || undefined } })
    setEditTarget(null)
  }

  const columns: Column<Tag>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (t) =>
        t.color ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: t.color }}
            />
            {t.name}
          </span>
        ) : (
          t.name
        ),
    },
    { key: 'color', header: 'Color', render: (t) => t.color ?? '—' },
  ]

  return (
    <main className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Add tag
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading tags…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={tags}
          keyField="id"
          emptyMessage="No tags yet."
          actions={(t) => (
            <div className="flex gap-2">
              <button onClick={() => openEdit(t)} className="text-sm text-gray-500 hover:text-gray-700">
                Edit
              </button>
              <button onClick={() => setDeleteTarget(t)} className="text-sm text-red-500 hover:text-red-700">
                Delete
              </button>
            </div>
          )}
        />
      )}

      <EntityModal open={createOpen} onClose={() => { setCreateOpen(false); setCreateError('') }} title="Add tag">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="tag-color" className="block text-sm font-medium text-gray-700">Color</label>
            <input
              id="tag-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#FF0000"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {createError && <p role="alert" className="text-sm text-red-600">{createError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="text-sm text-gray-500">Cancel</button>
            <button
              type="submit"
              disabled={createTag.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createTag.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </EntityModal>

      <EntityModal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit tag">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-tag-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="edit-tag-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="edit-tag-color" className="block text-sm font-medium text-gray-700">Color</label>
            <input
              id="edit-tag-color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditTarget(null)} className="text-sm text-gray-500">Cancel</button>
            <button
              type="submit"
              disabled={patchTag.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {patchTag.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </EntityModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete tag"
        description={`Delete "${deleteTarget?.name}"? This can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) await deleteTag.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  )
}
