import { useState } from 'react'
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import {
  useAccounts,
  useCreateAccount,
  usePatchAccount,
  useDeleteAccount,
  usePaymentMethods,
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  type Account,
  type PaymentMethod,
} from '../api/accounts'
import DataTable, { type Column } from '../components/DataTable'
import EntityModal from '../components/EntityModal'
import ConfirmDialog from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { AccountDrawer } from '../components/drawers/AccountDrawer'

// ── Payment methods sub-panel ────────────────────────────────────────────────

function PaymentMethodsPanel({ account }: { account: Account }) {
  const { data: methods = [], isLoading } = usePaymentMethods(account.id)
  const createPm = useCreatePaymentMethod(account.id)
  const deletePm = useDeletePaymentMethod(account.id)

  const [addOpen, setAddOpen] = useState(false)
  const [pmName, setPmName] = useState('')
  const [pmType, setPmType] = useState<PaymentMethod['type']>('debit_card')
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null)

  async function handleAddPm(e: React.FormEvent) {
    e.preventDefault()
    await createPm.mutateAsync({ name: pmName, type: pmType })
    setPmName('')
    setPmType('debit_card')
    setAddOpen(false)
  }

  const cols: Column<PaymentMethod>[] = [
    { key: 'name', header: 'Name', render: (pm) => pm.name },
    { key: 'type', header: 'Type', render: (pm) => pm.type.replace('_', ' ') },
  ]

  return (
    <div className="mt-4 pl-4 border-l-2 border-indigo-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">Payment methods</h3>
        <button
          onClick={() => setAddOpen(true)}
          className="p-1 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          title="Add payment method"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : (
        <DataTable
          columns={cols}
          rows={methods}
          keyField="id"
          emptyMessage="No payment methods yet."
          actions={(pm) => (
            <button
              onClick={() => setDeleteTarget(pm)}
              className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        />
      )}

      <EntityModal open={addOpen} onClose={() => setAddOpen(false)} title="Add payment method">
        <form onSubmit={handleAddPm} className="space-y-4">
          <div>
            <label htmlFor="pm-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="pm-name"
              value={pmName}
              onChange={(e) => setPmName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="pm-type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              id="pm-type"
              value={pmType}
              onChange={(e) => setPmType(e.target.value as PaymentMethod['type'])}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="debit_card">Debit card</option>
              <option value="credit_card">Credit card</option>
              <option value="netbanking">Netbanking</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPm.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createPm.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </EntityModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete payment method"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone immediately.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) await deletePm.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ── Main Accounts page ───────────────────────────────────────────────────────

export default function Accounts() {
  const { data: accounts = [], isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const patchAccount = usePatchAccount()
  const deleteAccount = useDeleteAccount()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drawerAccount, setDrawerAccount] = useState<Account | null>(null)

  // Create form state
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('bank')
  const [currency, setCurrency] = useState('INR')

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editActive, setEditActive] = useState(true)

  function openEdit(acc: Account) {
    setEditTarget(acc)
    setEditName(acc.name)
    setEditActive(acc.is_active)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createAccount.mutateAsync({ name, type, currency })
    setName('')
    setType('bank')
    setCurrency('INR')
    setCreateOpen(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    await patchAccount.mutateAsync({ id: editTarget.id, patch: { name: editName, is_active: editActive } })
    setEditTarget(null)
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Add account
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading accounts…</p>
      ) : (
        <div className="space-y-4">
          {accounts.length === 0 && (
            <EmptyState title="No accounts yet" description="Add your first account to start tracking finances." />
          )}
          {accounts.map((acc) => (
            <div key={acc.id} className="border border-gray-200 rounded-lg bg-white">
              <div className="flex items-center justify-between p-4">
                <div
                  className="cursor-pointer flex-1 min-w-0 mr-3"
                  onClick={() => setDrawerAccount(acc)}
                >
                  <p className="font-medium text-gray-900">{acc.name}</p>
                  <p className="text-sm text-gray-500">
                    {acc.type.replace('_', ' ')} · {acc.currency} {acc.current_balance}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === acc.id ? null : acc.id)
                    }
                    className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                    aria-expanded={expandedId === acc.id}
                    aria-label={`${expandedId === acc.id ? 'Hide' : 'Show'} payment methods for ${acc.name}`}
                    title="Payment methods"
                  >
                    {expandedId === acc.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(acc)}
                    className="p-1.5 rounded text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(acc)}
                    className="p-1.5 rounded text-fg-muted hover:text-negative-dim hover:bg-negative/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedId === acc.id && (
                <div className="px-4 pb-4">
                  <PaymentMethodsPanel account={acc} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <EntityModal open={createOpen} onClose={() => setCreateOpen(false)} title="Add account">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="acc-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="acc-type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              id="acc-type"
              value={type}
              onChange={(e) => setType(e.target.value as Account['type'])}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="credit_card">Credit card</option>
              <option value="loan">Loan</option>
            </select>
          </div>
          <div>
            <label htmlFor="acc-currency" className="block text-sm font-medium text-gray-700">Currency</label>
            <input
              id="acc-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createAccount.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createAccount.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </EntityModal>

      {/* Edit modal */}
      <EntityModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit account"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label htmlFor="edit-acc-name" className="block text-sm font-medium text-gray-700">Name</label>
            <input
              id="edit-acc-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="edit-acc-active"
              type="checkbox"
              checked={editActive}
              onChange={(e) => setEditActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="edit-acc-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditTarget(null)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              type="submit"
              disabled={patchAccount.isPending}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {patchAccount.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </EntityModal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete account"
        description={`Delete "${deleteTarget?.name}"? This action can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) await deleteAccount.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <AccountDrawer account={drawerAccount} onClose={() => setDrawerAccount(null)} />
    </main>
  )
}
