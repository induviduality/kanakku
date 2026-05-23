import { useState } from 'react'
import type { SplitShareCreate } from '../api/splits'
import { usePayees } from '../api/payees'

interface SplitSharesEditorProps {
  totalAmount: number
  shares: SplitShareCreate[]
  onChange: (shares: SplitShareCreate[]) => void
}

export default function SplitSharesEditor({
  totalAmount,
  shares,
  onChange,
}: SplitSharesEditorProps) {
  const { data: payees = [] } = usePayees()
  const [error, setError] = useState('')

  const sumShares = shares.reduce((acc, s) => acc + (Number(s.amount) || 0), 0)
  const remaining = totalAmount - sumShares

  function addShare() {
    onChange([...shares, { payee_id: undefined, amount: '' }])
    setError('')
  }

  function removeShare(index: number) {
    onChange(shares.filter((_, i) => i !== index))
    setError('')
  }

  function updateShare(index: number, patch: Partial<SplitShareCreate>) {
    const next = shares.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange(next)
    setError('')
  }

  function fillRemaining(index: number) {
    const otherSum = shares.reduce(
      (acc, s, i) => (i === index ? acc : acc + (Number(s.amount) || 0)),
      0,
    )
    const fill = Math.max(0, totalAmount - otherSum)
    updateShare(index, { amount: fill.toFixed(2) })
  }

  const isBalanced = Math.abs(remaining) < 0.005 && shares.length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Shares</span>
        <span
          className={`text-xs font-medium ${Math.abs(remaining) < 0.005 ? 'text-green-600' : 'text-amber-600'}`}
        >
          {Math.abs(remaining) < 0.005
            ? '✓ Balanced'
            : `Remaining: ${remaining.toFixed(2)}`}
        </span>
      </div>

      {shares.map((share, index) => (
        <div key={index} className="flex gap-2 items-center">
          <select
            aria-label={`Share ${index + 1} payee`}
            value={share.payee_id ?? ''}
            onChange={(e) => updateShare(index, { payee_id: e.target.value || undefined })}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">My share</option>
            {payees.filter((p) => !p.deleted_at).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0.01"
            aria-label={`Share ${index + 1} amount`}
            value={share.amount}
            onChange={(e) => updateShare(index, { amount: e.target.value })}
            placeholder="0.00"
            className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            aria-label={`Fill remaining for share ${index + 1}`}
            onClick={() => fillRemaining(index)}
            className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
          >
            Fill
          </button>
          <button
            type="button"
            aria-label={`Remove share ${index + 1}`}
            onClick={() => removeShare(index)}
            className="text-gray-400 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addShare}
        className="text-sm text-indigo-600 hover:underline"
      >
        + Add share
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!isBalanced && shares.length > 0 && (
        <p className="text-xs text-amber-600" role="alert">
          Shares must sum to {totalAmount.toFixed(2)} before saving.
        </p>
      )}
    </div>
  )
}
