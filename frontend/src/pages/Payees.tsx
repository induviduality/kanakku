import { useState } from 'react'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { usePayees, useCreatePayee, usePatchPayee, useDeletePayee, type Payee } from '../api/payees'
import DataTable, { type Column } from '../components/DataTable'
import EntityModal from '../components/EntityModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { PayeeDrawer } from '../components/drawers/PayeeDrawer'

export default function Payees() {
  const [search, setSearch] = useState('')
  const { data: payees = [], isLoading } = usePayees(search || undefined)
  const createPayee = useCreatePayee()
  const patchPayee = usePatchPayee()
  const deletePayee = useDeletePayee()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Payee | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Payee | null>(null)
  const [drawerPayee, setDrawerPayee] = useState<Payee | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<Payee['type']>('merchant')
  const [notes, setNotes] = useState('')

  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<Payee['type']>('merchant')
  const [editNotes, setEditNotes] = useState('')

  function openEdit(p: Payee) {
    setEditTarget(p)
    setEditName(p.name)
    setEditType(p.type)
    setEditNotes(p.notes ?? '')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createPayee.mutateAsync({ name, type, notes: notes || undefined })
    setName('')
    setType('merchant')
    setNotes('')
    setCreateOpen(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    await patchPayee.mutateAsync({ id: editTarget.id, patch: { name: editName, type: editType, notes: editNotes || undefined } })
    setEditTarget(null)
  }

  const columns: Column<Payee>[] = [
    { key: 'name', header: 'Name', render: (p) => p.name },
    { key: 'type', header: 'Type', render: (p) => p.type },
    { key: 'notes', header: 'Notes', render: (p) => p.notes ?? '—' },
    { key: 'status', header: 'Status', render: (p) => (p.is_active ? 'Active' : 'Inactive') },
  ]

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payees</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Add payee
        </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search payees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Search payees"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading payees…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={payees}
          keyField="id"
          emptyMessage="No payees found."
          actions={(p) => (
            <div className="flex gap-1">
              <button onClick={() => setDrawerPayee(p)} className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors" title="View">
                <Eye className="w-4 h-4" />
              </button>
              <button onClick={() => openEdit(p)} className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => setDeleteTarget(p)} className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        />
      )}

      <EntityModal open={createOpen} onClose={() => setCreateOpen(false)} title="Add payee">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="payee-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="payee-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="payee-type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              id="payee-type"
              value={type}
              onChange={(e) => setType(e.target.value as Payee['type'])}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="merchant">Merchant</option>
              <option value="person">Person</option>
              <option value="business">Business</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="payee-notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <input
              id="payee-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="text-sm text-gray-500">Cancel</button>
            <button
              type="submit"
              disabled={createPayee.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createPayee.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </EntityModal>

      <EntityModal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit payee">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-payee-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="edit-payee-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="edit-payee-type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              id="edit-payee-type"
              value={editType}
              onChange={(e) => setEditType(e.target.value as Payee['type'])}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="merchant">Merchant</option>
              <option value="person">Person</option>
              <option value="business">Business</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-payee-notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <input
              id="edit-payee-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditTarget(null)} className="text-sm text-gray-500">Cancel</button>
            <button
              type="submit"
              disabled={patchPayee.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {patchPayee.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </EntityModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete payee"
        description={`Delete "${deleteTarget?.name}"? This can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) await deletePayee.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <PayeeDrawer payee={drawerPayee} onClose={() => setDrawerPayee(null)} />
    </main>
  )
}
