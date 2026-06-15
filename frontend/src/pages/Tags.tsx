import { useState } from 'react'
import { useCreateTag, useDeleteTag, usePatchTag, useTags, type Tag } from '../api/tags'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../lib/toast'

export default function Tags() {
  const { data: tags = [], isLoading } = useTags()
  const createTag = useCreateTag()
  const patchTag = usePatchTag()
  const deleteTag = useDeleteTag()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Tag | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null)

  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  function openEdit(t: Tag) {
    setEditTarget(t)
    setEditName(t.name)
    setEditColor(t.color ?? '')
  }

  function closeCreate() {
    setCreateOpen(false)
    setName('')
    setColor('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createTag.mutateAsync({ name, color: color || undefined })
      closeCreate()
    } catch {
      toast('Failed to create tag. Please try again.', 'error')
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    try {
      await patchTag.mutateAsync({ id: editTarget.id, patch: { name: editName, color: editColor || undefined } })
      setEditTarget(null)
    } catch {
      toast('Failed to update tag. Please try again.', 'error')
    }
  }

  const active = tags.filter((t) => !t.deleted_at)

  return (
    <main className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-fg">Tags</h1>
        <button onClick={() => setCreateOpen(true)} className="kk-btn-primary text-sm">
          + Add tag
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-24 animate-pulse bg-surface-2 rounded-full" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="kk-card py-16 text-center">
          <p className="text-fg-faint text-sm mb-4">No tags yet.</p>
          <button onClick={() => setCreateOpen(true)} className="kk-btn-primary text-sm">
            Create your first tag
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {active.map((t) => (
            <div key={t.id} className="kk-card flex items-center gap-2 px-3 py-2">
              {t.color && (
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              )}
              <span className="text-sm font-medium text-fg">{t.name}</span>
              <div className="flex gap-0.5 ml-1">
                <button
                  onClick={() => openEdit(t)}
                  className="p-1 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                  title="Edit"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => setDeleteTarget(t)}
                  className="p-1 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
              <h2 className="font-semibold text-fg">Add tag</h2>
            </div>
            <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
              <TagFields name={name} setName={setName} color={color} setColor={setColor} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeCreate} className="kk-btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={createTag.isPending} className="kk-btn-primary text-sm disabled:opacity-50">
                  {createTag.isPending ? 'Adding…' : 'Add'}
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
              <h2 className="font-semibold text-fg">Edit tag</h2>
            </div>
            <form onSubmit={handleEdit} className="px-5 py-4 space-y-4">
              <TagFields name={editName} setName={setEditName} color={editColor} setColor={setEditColor} />
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditTarget(null)} className="kk-btn-ghost text-sm">Cancel</button>
                <button type="submit" disabled={patchTag.isPending} className="kk-btn-primary text-sm disabled:opacity-50">
                  {patchTag.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete tag"
        description={`Delete "${deleteTarget?.name}"? This can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) {
            try { await deleteTag.mutateAsync(deleteTarget.id) }
            catch { toast('Failed to delete tag. Please try again.', 'error') }
          }
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  )
}

function TagFields({
  name, setName, color, setColor,
}: {
  name: string; setName: (v: string) => void
  color: string; setColor: (v: string) => void
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
          placeholder="e.g. weekend, work"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-fg-muted mb-1">Color (optional)</label>
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          placeholder="#6366F1"
          className="kk-input"
        />
      </div>
    </>
  )
}
