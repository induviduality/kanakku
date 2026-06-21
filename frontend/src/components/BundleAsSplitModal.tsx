import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useBundleSplit, type ForgivenShareCreate } from '../api/splits'
import { TransactionPicker } from './TransactionPicker'

interface BundleAsSplitModalProps {
  expenseTransactionIds: string[]
  expenseAmount: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function BundleAsSplitModal({
  expenseTransactionIds,
  expenseAmount,
  open,
  onClose,
  onSuccess,
}: BundleAsSplitModalProps) {
  const bundle = useBundleSplit()

  const [selectedIncomeIds, setSelectedIncomeIds] = useState<string[]>([])
  const [forgivenShares, setForgivenShares] = useState<ForgivenShareCreate[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  function addForgiven() {
    setForgivenShares((prev) => [...prev, { amount: '' }])
  }

  function updateForgiven(index: number, amount: string) {
    setForgivenShares((prev) => prev.map((f, i) => (i === index ? { ...f, amount } : f)))
  }

  function removeForgiven(index: number) {
    setForgivenShares((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await bundle.mutateAsync({
        expense_transaction_ids: expenseTransactionIds,
        income_transaction_ids: selectedIncomeIds,
        forgiven_shares: forgivenShares.filter((f) => Number(f.amount) > 0),
        ...(notes && { notes }),
      })
      onSuccess()
      onClose()
    } catch {
      setError('Failed to bundle split. Please try again.')
    }
  }

  function handleClose() {
    setSelectedIncomeIds([])
    setForgivenShares([])
    setNotes('')
    setError('')
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl"
          aria-label="Bundle as split"
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900 mb-1">
            Bundle as Split
          </Dialog.Title>
          <p className="text-sm text-gray-500 mb-4">
            Expense: <strong>₹{expenseAmount}</strong>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Income legs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select income transactions (settlement legs)
              </label>
              <TransactionPicker
                type="income"
                multiple
                value={selectedIncomeIds}
                onChange={(ids) => setSelectedIncomeIds(ids as string[])}
              />
            </div>

            {/* Forgiven shares */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forgiven amounts
              </label>
              <div className="space-y-2">
                {forgivenShares.map((f, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={f.amount}
                      onChange={(e) => updateForgiven(i, e.target.value)}
                      placeholder="0.00"
                      aria-label={`Forgiven amount ${i + 1}`}
                      className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeForgiven(i)}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addForgiven}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  + Add forgiven amount
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="bundle-notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <input
                id="bundle-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bundle.isPending}
                className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {bundle.isPending ? 'Bundling…' : 'Bundle'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
