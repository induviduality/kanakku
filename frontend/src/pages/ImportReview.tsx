import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  useGetImportBatch,
  useGetImportRecords,
  usePatchRecord,
  useConfirmRecords,
  useRejectRecords,
  type RawImportRecord,
  type RecordStatus,
} from '../api/imports'

const TAB_LABELS: { status: RecordStatus; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'duplicate', label: 'Duplicate' },
]

function parsedField(record: RawImportRecord, field: string): string {
  const val = record.parsed_json?.[field]
  return val != null ? String(val) : ''
}

function RecordRow({
  record,
  batchId,
  selected,
  onToggle,
}: {
  record: RawImportRecord
  batchId: string
  selected: boolean
  onToggle: () => void
}) {
  const patchMutation = usePatchRecord(batchId)
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(parsedField(record, 'description'))
  const [amount, setAmount] = useState(parsedField(record, 'amount'))
  const [type, setType] = useState(parsedField(record, 'type') || 'expense')

  function saveEdit() {
    const updated = {
      ...record.parsed_json,
      description,
      amount,
      type,
    }
    patchMutation.mutate(
      { recordId: record.id, patch: { parsed_json: updated } },
      { onSuccess: () => setEditing(false) },
    )
  }

  const isPending = record.status === 'pending' || record.status === 'duplicate'

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-2 text-sm">
        {isPending && (
          <input
            type="checkbox"
            aria-label={`select record ${record.id}`}
            checked={selected}
            onChange={onToggle}
            className="rounded"
          />
        )}
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">{parsedField(record, 'date')}</td>
      <td className="px-3 py-2 text-sm">
        {editing ? (
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        ) : (
          parsedField(record, 'description')
        )}
      </td>
      <td className="px-3 py-2 text-sm text-right">
        {editing ? (
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-right"
          />
        ) : (
          parsedField(record, 'amount')
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {editing ? (
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>
        ) : (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              parsedField(record, 'type') === 'income'
                ? 'bg-green-100 text-green-800'
                : 'bg-orange-100 text-orange-800'
            }`}
          >
            {parsedField(record, 'type') || 'expense'}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {record.confidence && (
          <span className="text-xs text-gray-400">{record.confidence}</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {record.status === 'pending' || record.status === 'duplicate' ? (
          editing ? (
            <div className="flex gap-1">
              <button
                onClick={saveEdit}
                disabled={patchMutation.isPending}
                className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-600 hover:underline"
            >
              Edit
            </button>
          )
        ) : null}
      </td>
    </tr>
  )
}

export default function ImportReview() {
  const { batchId } = useParams({ strict: false }) as { batchId: string }
  const [activeTab, setActiveTab] = useState<RecordStatus>('pending')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: batch, isLoading: batchLoading } = useGetImportBatch(batchId)
  const { data: records = [] } = useGetImportRecords(batchId, activeTab)
  const confirmMutation = useConfirmRecords(batchId)
  const rejectMutation = useRejectRecords(batchId)

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)))
    }
  }

  function confirmSelected(force = false) {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    confirmMutation.mutate(
      { record_ids: ids, force },
      { onSuccess: () => setSelectedIds(new Set()) },
    )
  }

  function rejectSelected() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    rejectMutation.mutate(
      { record_ids: ids },
      { onSuccess: () => setSelectedIds(new Set()) },
    )
  }

  if (batchLoading) return <p className="p-8 text-gray-500">Loading…</p>
  if (!batch) return <p className="p-8 text-red-500">Import batch not found.</p>

  const hasDuplicates = activeTab === 'duplicate'
  const isPendingTab = activeTab === 'pending' || hasDuplicates

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">{batch.filename}</h1>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {batch.status}
          </span>
          {batch.verification_status && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {batch.verification_status}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {batch.total_parsed} parsed · {batch.total_confirmed} confirmed · {batch.total_rejected} rejected
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {TAB_LABELS.map(({ status, label }) => (
          <button
            key={status}
            onClick={() => {
              setActiveTab(status)
              setSelectedIds(new Set())
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === status
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            aria-selected={activeTab === status}
            role="tab"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {isPendingTab && records.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-500">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'All'}
          </span>
          <button
            onClick={() => confirmSelected(false)}
            disabled={confirmMutation.isPending}
            className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
          >
            Confirm
          </button>
          {hasDuplicates && (
            <button
              onClick={() => confirmSelected(true)}
              disabled={confirmMutation.isPending}
              className="rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Force confirm
            </button>
          )}
          <button
            onClick={rejectSelected}
            disabled={rejectMutation.isPending}
            className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {/* Records table */}
      {records.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No {activeTab} records.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
                <th className="px-3 py-2">
                  {isPendingTab && (
                    <input
                      type="checkbox"
                      aria-label="select all"
                      checked={selectedIds.size === records.length && records.length > 0}
                      onChange={toggleAll}
                      className="rounded"
                    />
                  )}
                </th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <RecordRow
                  key={record.id}
                  record={record}
                  batchId={batchId}
                  selected={selectedIds.has(record.id)}
                  onToggle={() => toggleSelect(record.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
