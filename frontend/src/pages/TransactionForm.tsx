import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import TransactionFormComponent from '../components/forms/TransactionForm'
import {
  useCreateTransaction,
  usePatchTransaction,
  useTransaction,
  type TransactionCreate,
  type TransactionPatch,
} from '../api/transactions'

export default function TransactionFormPage() {
  const navigate = useNavigate()
  // editId passed via search param: /transactions/new?editId=<uuid>
  const search = useSearch({ strict: false }) as Record<string, string>
  const editId = search?.editId as string | undefined

  const createTxn = useCreateTransaction()
  const patchTxn = usePatchTransaction()
  const { data: txn, isLoading } = useTransaction(editId)
  const [done, setDone] = useState(false)

  const isEditing = !!editId

  async function handleSubmit(data: TransactionCreate | TransactionPatch): Promise<{ id: string } | void> {
    let result: { id: string } | undefined
    if (isEditing) {
      await patchTxn.mutateAsync({ id: editId!, patch: data as TransactionPatch })
    } else {
      const txn = await createTxn.mutateAsync(data as TransactionCreate)
      result = { id: txn.id }
    }
    setDone(true)
    navigate({ to: '/transactions' })
    return result
  }

  if (done) return null
  if (isEditing && isLoading) return <div className="p-8 text-gray-500">Loading transaction…</div>

  return (
    <main className="p-6 max-w-lg mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: '/transactions' })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Transaction' : 'New Transaction'}
        </h1>
      </div>

      <TransactionFormComponent
        initial={txn}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? 'Update' : 'Add transaction'}
        isSubmitting={createTxn.isPending || patchTxn.isPending}
      />
    </main>
  )
}
