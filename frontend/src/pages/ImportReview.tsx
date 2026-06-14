import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import {
  useGetImportBatch,
  useGetImportRecords,
  usePatchRecord,
  usePatchBatch,
  useConfirmRecords,
  useRejectRecords,
  useReplaceExisting,
  type RawImportRecord,
  type RecordStatus,
} from '../api/imports'
import { useTransaction } from '../api/transactions'
import { useAccounts } from '../api/accounts'
import { useToast } from '../lib/toast'

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

function getDuplicateIds(record: RawImportRecord): string[] {
  const ids = record.parsed_json?.['_duplicate_transaction_ids']
  return Array.isArray(ids) ? ids as string[] : []
}

// ── Duplicate resolution modal ────────────────────────────────────────────────

function MatchedTransaction({ txnId }: { txnId: string }) {
  const { data: txn, isLoading } = useTransaction(txnId)
  if (isLoading) return <p className="text-xs text-fg-faint animate-pulse">Loading…</p>
  if (!txn) return <p className="text-xs text-negative-dim">Transaction not found</p>
  return (
    <div className="rounded border border-border/50 bg-surface-2 px-3 py-2 text-xs space-y-0.5">
      <p className="font-medium text-fg">{txn.description || '—'}</p>
      <p className="text-fg-muted kk-mono">
        {txn.transacted_at.slice(0, 10)} · ₹{Number(txn.amount).toLocaleString('en-IN')}
        <span className={`ml-2 ${txn.type === 'income' ? 'text-positive-dim' : 'text-negative-dim'}`}>
          {txn.type}
        </span>
      </p>
    </div>
  )
}

function DuplicateResolveModal({
  record,
  batchId,
  onClose,
}: {
  record: RawImportRecord
  batchId: string
  onClose: () => void
}) {
  const patchMutation = usePatchRecord(batchId)
  const confirmMutation = useConfirmRecords(batchId)
  const replaceMutation = useReplaceExisting(batchId)
  const duplicateIds = getDuplicateIds(record)
  const { toast } = useToast()

  function handleKeepExisting() {
    patchMutation.mutate(
      { recordId: record.id, patch: { status: 'rejected' } },
      {
        onSuccess: onClose,
        onError: () => toast('Failed to reject record. Please try again.', 'error'),
      },
    )
  }

  function handleImportSeparate() {
    confirmMutation.mutate(
      { record_ids: [record.id], force: true },
      {
        onSuccess: onClose,
        onError: () => toast('Failed to confirm transaction. Please try again.', 'error'),
      },
    )
  }

  function handleReplace() {
    replaceMutation.mutate(
      { recordId: record.id, body: { transaction_ids: duplicateIds } },
      {
        onSuccess: onClose,
        onError: () => toast('Failed to replace transaction. Please try again.', 'error'),
      },
    )
  }

  const isBusy = patchMutation.isPending || confirmMutation.isPending || replaceMutation.isPending

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg border border-border/50">
        <div className="px-5 py-4 border-b border-border/50">
          <h2 className="font-semibold text-fg text-base">Resolve duplicate</h2>
          <p className="text-xs text-fg-faint mt-0.5">
            This imported transaction may already exist in your records.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Import record */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint mb-1.5">
              Imported transaction
            </p>
            <div className="rounded border border-accent/30 bg-accent/5 px-3 py-2 text-xs space-y-0.5">
              <p className="font-medium text-fg">{parsedField(record, 'description') || '—'}</p>
              <p className="text-fg-muted kk-mono">
                {parsedField(record, 'date')} · ₹{Number(parsedField(record, 'amount')).toLocaleString('en-IN')}
                <span className={`ml-2 ${parsedField(record, 'type') === 'income' ? 'text-positive-dim' : 'text-negative-dim'}`}>
                  {parsedField(record, 'type') || 'expense'}
                </span>
              </p>
            </div>
          </div>

          {/* Matched existing transactions */}
          {duplicateIds.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint mb-1.5">
                Matching existing {duplicateIds.length === 1 ? 'transaction' : 'transactions'}
              </p>
              <div className="space-y-1.5">
                {duplicateIds.map(id => <MatchedTransaction key={id} txnId={id} />)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleKeepExisting}
              disabled={isBusy}
              className="w-full text-left rounded-lg border border-border/50 px-4 py-3 text-sm hover:bg-surface-2 transition-colors disabled:opacity-50"
            >
              <p className="font-medium text-fg">Keep existing</p>
              <p className="text-xs text-fg-faint mt-0.5">Discard the import — keep the transaction already in your records.</p>
            </button>

            <button
              onClick={handleImportSeparate}
              disabled={isBusy}
              className="w-full text-left rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm hover:bg-warning/10 transition-colors disabled:opacity-50"
            >
              <p className="font-medium text-fg">Import as separate transaction</p>
              <p className="text-xs text-warning-dim mt-0.5">
                Creates an additional transaction. This may cause account balance discrepancies.
              </p>
            </button>

            {duplicateIds.length > 0 && (
              <button
                onClick={handleReplace}
                disabled={isBusy}
                className="w-full text-left rounded-lg border border-negative/30 bg-negative/5 px-4 py-3 text-sm hover:bg-negative/10 transition-colors disabled:opacity-50"
              >
                <p className="font-medium text-fg">Replace existing</p>
                <p className="text-xs text-negative-dim mt-0.5">
                  Soft-deletes the matched {duplicateIds.length === 1 ? 'transaction' : 'transactions'} and imports this one in its place.
                </p>
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/50 flex justify-end">
          <button onClick={onClose} className="kk-btn-ghost text-sm">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Record row ────────────────────────────────────────────────────────────────

function RecordRow({
  record,
  batchId,
  selected,
  onToggle,
  onResolve,
}: {
  record: RawImportRecord
  batchId: string
  selected: boolean
  onToggle: () => void
  onResolve?: () => void
}) {
  const patchMutation = usePatchRecord(batchId)
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(parsedField(record, 'description'))
  const [amount, setAmount] = useState(parsedField(record, 'amount'))
  const [type, setType] = useState(parsedField(record, 'type') || 'expense')

  function saveEdit() {
    patchMutation.mutate(
      { recordId: record.id, patch: { parsed_json: { ...record.parsed_json, description, amount, type } } },
      {
        onSuccess: () => setEditing(false),
        onError: () => toast('Failed to save changes. Please try again.', 'error'),
      },
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
            <div className="flex gap-1.5 items-center">
              {record.status === 'duplicate' && onResolve ? (
                <button
                  onClick={onResolve}
                  className="text-xs font-medium text-warning-dim hover:underline whitespace-nowrap"
                >
                  Resolve
                </button>
              ) : (
                <button onClick={() => setEditing(true)} className="text-xs text-accent hover:underline">
                  Edit
                </button>
              )}
            </div>
          )
        )}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ImportReview() {
  const { batchId } = useParams({ strict: false }) as { batchId: string }
  const [activeTab, setActiveTab] = useState<RecordStatus>('pending')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [resolveRecord, setResolveRecord] = useState<RawImportRecord | null>(null)
  const { toast } = useToast()

  const { data: batch, isLoading: batchLoading } = useGetImportBatch(batchId)
  const { data: records = [], isLoading: recordsLoading } = useGetImportRecords(batchId, activeTab)
  const { data: accounts = [] } = useAccounts()
  const confirmMutation = useConfirmRecords(batchId)
  const rejectMutation = useRejectRecords(batchId)
  const patchBatchMutation = usePatchBatch(batchId)

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === records.length ? new Set() : new Set(records.map(r => r.id)))
  }

  function confirmSelected(force = false) {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    confirmMutation.mutate(
      { record_ids: ids, force },
      {
        onSuccess: () => setSelectedIds(new Set()),
        onError: () => toast('Failed to confirm transactions. Please try again.', 'error'),
      },
    )
  }

  function rejectSelected() {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : undefined
    rejectMutation.mutate(
      { record_ids: ids },
      { onError: () => toast('Failed to reject transactions. Please try again.', 'error') },
    )
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

        {/* Account selector */}
        <div className="mt-3 flex items-center gap-2">
          <label className="text-xs text-fg-faint shrink-0" htmlFor="batch-account">Account</label>
          <select
            id="batch-account"
            value={batch.account_id ?? ''}
            onChange={e => patchBatchMutation.mutate(
              { account_id: e.target.value || null },
              { onError: () => toast('Failed to update account. Please try again.', 'error') },
            )}
            disabled={patchBatchMutation.isPending}
            className="kk-input h-7 text-xs max-w-xs"
          >
            <option value="">— select account —</option>
            {accounts.filter(a => !a.deleted_at).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {!batch.account_id && (
          <p className="mt-2 text-xs text-warning-dim bg-warning/5 border border-warning/20 rounded-lg px-3 py-2">
            Select an account above before confirming transactions.
          </p>
        )}
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
            disabled={confirmMutation.isPending || !batch.account_id}
            title={!batch.account_id ? 'Select an account first' : undefined}
            className="kk-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Confirm
          </button>
          {hasDuplicates && (
            <button
              onClick={() => confirmSelected(true)}
              disabled={confirmMutation.isPending || !batch.account_id}
              title={!batch.account_id ? 'Select an account first' : undefined}
              className="kk-btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Force confirm all
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

      {/* Duplicate info banner */}
      {hasDuplicates && records.length > 0 && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning-dim">
          These transactions may already exist in your records. Use <strong>Resolve</strong> on each row
          to choose how to handle it, or use bulk actions above to force-confirm or reject all at once.
        </div>
      )}

      {/* Records table */}
      {recordsLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 animate-pulse bg-surface-2 rounded-lg" />
          ))}
        </div>
      ) : records.length === 0 ? (
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
                  onResolve={record.status === 'duplicate' ? () => setResolveRecord(record) : undefined}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Duplicate resolution modal */}
      {resolveRecord && (
        <DuplicateResolveModal
          record={resolveRecord}
          batchId={batchId}
          onClose={() => setResolveRecord(null)}
        />
      )}
    </div>
  )
}
