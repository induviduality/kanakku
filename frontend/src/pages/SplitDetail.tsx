import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  useGetSplit,
  useSettleShare,
  useForgiveShare,
  useUnsettleShare,
  type SplitShare,
  type SplitShareStatus,
} from '../api/splits'
import { useTransactions } from '../api/transactions'
import ConfirmDialog from '../components/ConfirmDialog'

const STATUS_BADGES: Record<SplitShareStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  settled: 'bg-green-100 text-green-800',
  forgiven: 'bg-gray-100 text-gray-600',
}

function ShareRow({
  share,
  splitId,
}: {
  share: SplitShare
  splitId: string
}) {
  const [settleOpen, setSettleOpen] = useState(false)
  const [forgiveOpen, setForgiveOpen] = useState(false)
  const [settleTxnId, setSettleTxnId] = useState('')
  const { data: txnData } = useTransactions({ type: 'income' })
  const incomeTransactions = txnData?.items ?? []

  const settle = useSettleShare(splitId)
  const forgive = useForgiveShare(splitId)
  const unsettle = useUnsettleShare(splitId)

  async function handleSettle() {
    if (!settleTxnId) return
    await settle.mutateAsync({ shareId: share.id, body: { settlement_transaction_id: settleTxnId } })
    setSettleOpen(false)
    setSettleTxnId('')
  }

  return (
    <tr className="border-t border-gray-100">
      <td className="py-3 px-4 text-sm text-gray-700">
        {share.payee_id ? <span className="italic">{share.payee_id.slice(0, 8)}…</span> : <span className="text-gray-400">My share</span>}
      </td>
      <td className="py-3 px-4 text-sm font-medium text-right">₹{share.amount}</td>
      <td className="py-3 px-4 text-center">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[share.status]}`}>
          {share.status}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex gap-2 justify-end">
          {share.status === 'pending' && (
            <>
              <button
                onClick={() => setSettleOpen(true)}
                className="text-xs text-green-700 hover:underline"
              >
                Settle
              </button>
              <button
                onClick={() => setForgiveOpen(true)}
                className="text-xs text-gray-500 hover:underline"
              >
                Forgive
              </button>
            </>
          )}
          {share.status === 'settled' && (
            <button
              onClick={() => unsettle.mutate(share.id)}
              disabled={unsettle.isPending}
              className="text-xs text-amber-600 hover:underline disabled:opacity-50"
            >
              Unsettle
            </button>
          )}
        </div>

        {/* Settle modal (inline) */}
        {settleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-80">
              <h3 className="text-base font-semibold mb-3">Settle share</h3>
              <label className="block text-sm text-gray-700 mb-1">Link income transaction</label>
              <select
                value={settleTxnId}
                onChange={(e) => setSettleTxnId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm mb-4"
              >
                <option value="">Select…</option>
                {incomeTransactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.description ?? t.id.slice(0, 8)} — ₹{t.amount}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSettleOpen(false); setSettleTxnId('') }}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettle}
                  disabled={!settleTxnId || settle.isPending}
                  className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={forgiveOpen}
          title="Forgive share"
          description={`Write off ₹${share.amount} — the amount will count toward your net expense.`}
          onConfirm={() => { forgive.mutate(share.id); setForgiveOpen(false) }}
          onCancel={() => setForgiveOpen(false)}
        />
      </td>
    </tr>
  )
}

export default function SplitDetail() {
  const { splitId } = useParams({ strict: false }) as { splitId: string }
  const { data: split, isLoading, isError } = useGetSplit(splitId)

  if (isLoading) return <div className="p-8 text-gray-500">Loading…</div>
  if (isError || !split) return <div className="p-8 text-red-600">Split not found.</div>

  const totalAmount = split.shares.reduce((sum, s) => sum + Number(s.amount), 0)
  const netExpense = split.shares.reduce(
    (sum, s) => (s.payee_id === null || s.status === 'forgiven' ? sum + Number(s.amount) : sum),
    0,
  )

  return (
    <main className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Split Detail</h1>
      <p className="text-sm text-gray-500 mb-6">Transaction ID: {split.expense_transaction_id}</p>

      <div className="rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div className="bg-gray-50 px-4 py-3 flex justify-between text-sm">
          <span className="font-medium text-gray-700">Total: ₹{totalAmount.toFixed(2)}</span>
          <span className="text-indigo-600 font-medium">Net expense: ₹{netExpense.toFixed(2)}</span>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-t border-gray-200">
            <tr>
              <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase">Payee</th>
              <th className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="py-2 px-4 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {split.shares.map((share) => (
              <ShareRow key={share.id} share={share} splitId={split.id} />
            ))}
          </tbody>
        </table>
      </div>

      {split.notes && (
        <p className="text-sm text-gray-600 italic">Notes: {split.notes}</p>
      )}
    </main>
  )
}
