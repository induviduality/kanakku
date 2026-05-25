import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  useGetImportBatch,
  useGetImportRecords,
  usePatchRecord,
  useConfirmRecords,
  useRejectRecords,
  type RawImportRecord,
  type RecordStatus,
} from '../api/imports'

const TABS: { status: RecordStatus; label: string }[] = [
  { status: 'pending',   label: 'Pending' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'rejected',  label: 'Rejected' },
  { status: 'duplicate', label: 'Duplicate' },
]

const CONFIDENCE_CLS: Record<string, string> = {
  high:   'text-positive-dim',
  medium: 'text-warning-dim',
  low:    'text-negative-dim',
}

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
    patchMutation.mutate(
      { recordId: record.id, patch: { parsed_json: { ...record.parsed_json, description, amount, type } } },
      { onSuccess: () => setEditing(false) },
    )
  }

  const isPending = record.status === 'pending' || record.status === 'duplicate'
  const txnType = parsedField(record, 'type') || 'expense'

  return (
    <tr className="border-b border-border/50 hover:bg-surface-2/40 transition-colors">
      <td className="px-3 py-2.5">
        {isPending && (
          <input
            type="checkbox"
            aria-label={`select record ${record.id}`}
            checked={selected}
            onChange={onToggle}
            className="rounded accent-accent"
          />
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-fg-muted whitespace-nowrap kk-mono">
        {parsedField(record, 'date')}
      </td>
      <td className="px-3 py-2.5 text-sm max-w-[280px]">
        {editing ? (
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="kk-input h-7 text-xs"
          />
        ) : (
          <span className="text-fg truncate block">{parsedField(record, 'description') || '—'}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        {editing ? (
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="kk-input h-7 text-xs w-28 text-right"
          />
        ) : (
          <span className="text-sm font-medium kk-mono text-fg">
            ₹{Number(parsedField(record, 'amount')).toLocaleString('en-IN')}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {editing ? (
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="kk-input h-7 text-xs w-28"
          >
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>
        ) : (
          <span className={`kk-chip ${txnType === 'income' ? 'kk-chip-positive' : 'kk-chip-negative'}`}>
            {txnType}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">
        {record.confidence && (
          <span className={`font-medium ${CONFIDENCE_CLS[record.confidence] ?? 'text-fg-faint'}`}>
            {record.confidence}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {isPending && (
          editing ? (
            <div className="flex gap-1">
              <button
                onClick={saveEdit}
                disabled={patchMutation.isPending}
                className="kk-btn-primary h-7 text-xs px-2 disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setEditing(false)} className="kk-btn-ghost h-7 text-xs px-2">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
              Edit
            </button>
          )
        )}
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
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === records.length ? new Set() : new Set(records.map(r => r.id)))
  }

  function confirmSelected(force = false) {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    confirmMutation.mutate({ record_ids: ids, force }, { onSuccess: () => setSelectedIds(new Set()) })
  }

  function rejectSelected() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    rejectMutation.mutate({ record_ids: ids }, { onSuccess: () => setSelectedIds(new Set()) })
  }

  if (batchLoading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse bg-surface-2 rounded-xl" />)}
      </div>
    )
  }
  if (!batch) return <p className="p-8 text-negative-dim text-center">Import batch not found.</p>

  const hasDuplicates = activeTab === 'duplicate'
  const isPendingTab = activeTab === 'pending' || hasDuplicates
  const pendingRemaining = batch.total_parsed - batch.total_confirmed - batch.total_rejected

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <Link to="/imports" className="text-xs text-fg-faint hover:text-accent transition-colors">
          ← Back to imports
        </Link>
        <div className="flex items-center gap-2 flex-wrap mt-2 mb-1">
          <h1 className="text-xl font-bold text-fg">{batch.filename}</h1>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            batch.status === 'completed' ? 'bg-positive/10 text-positive-dim' :
            batch.status === 'failed'    ? 'bg-negative/10 text-negative-dim' :
            batch.status === 'processing'? 'bg-accent/15 text-accent' :
                                           'bg-warning/15 text-warning-dim'
          }`}>
            {batch.status}
          </span>
          {batch.verification_status && (
            <span className="text-[10px] text-fg-faint border border-border/50 px-1.5 py-0.5 rounded-full">
              {batch.verification_status}
            </span>
          )}
        </div>
        <p className="text-xs text-fg-faint">
          <span className="kk-mono">{batch.total_parsed}</span> parsed &nbsp;·&nbsp;
          <span className="kk-mono text-positive-dim">{batch.total_confirmed}</span> confirmed &nbsp;·&nbsp;
          <span className="kk-mono text-negative-dim">{batch.total_rejected}</span> rejected &nbsp;·&nbsp;
          <span className="kk-mono text-warning-dim">{pendingRemaining}</span> pending
        </p>
      </div>

      {/* Tabs */}
      <div className="kk-seg mb-4 self-start inline-flex">
        {TABS.map(({ status, label }) => (
          <button
            key={status}
            onClick={() => { setActiveTab(status); setSelectedIds(new Set()) }}
            data-active={activeTab === status}
            className="kk-seg-btn"
            aria-selected={activeTab === status}
            role="tab"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {isPendingTab && records.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-fg-faint">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${records.length} records`}
          </span>
          <button
            onClick={() => confirmSelected(false)}
            disabled={confirmMutation.isPending}
            className="kk-btn-primary disabled:opacity-50"
          >
            ✓ Confirm
          </button>
          {hasDuplicates && (
            <button
              onClick={() => confirmSelected(true)}
              disabled={confirmMutation.isPending}
              className="kk-btn-ghost disabled:opacity-50"
            >
              Force confirm
            </button>
          )}
          <button
            onClick={rejectSelected}
            disabled={rejectMutation.isPending}
            className="kk-btn-danger disabled:opacity-50"
          >
            ✕ Reject
          </button>
        </div>
      )}

      {/* Records table */}
      {records.length === 0 ? (
        <div className="py-16 text-center text-fg-faint text-sm">
          No {activeTab} records.
        </div>
      ) : (
        <div className="kk-card p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/50">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
                <th className="px-3 py-2.5 w-8">
                  {isPendingTab && (
                    <input
                      type="checkbox"
                      aria-label="select all"
                      checked={selectedIds.size === records.length && records.length > 0}
                      onChange={toggleAll}
                      className="rounded accent-accent"
                    />
                  )}
                </th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
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
