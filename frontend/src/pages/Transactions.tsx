import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  useInfiniteTransactions,
  useDeleteTransaction,
  type Transaction,
  type TransactionFilters,
  type TransactionType,
} from '../api/transactions'
import { useListSplits, type Split } from '../api/splits'
import { useAccounts } from '../api/accounts'
import { usePayees } from '../api/payees'
import { useCategories } from '../api/categories'
import { useTags } from '../api/tags'
import ConfirmDialog from '../components/ConfirmDialog'
import BundleAsSplitModal from '../components/BundleAsSplitModal'
import { EmptyState } from '../components/EmptyState'
import { TransactionDrawer } from '../components/drawers/TransactionDrawer'

function formatAmount(t: Transaction): string {
  const sign = t.type === 'expense' ? '-' : t.type === 'transfer' ? '⇄' : '+'
  return `${sign}${t.currency} ${Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const TYPE_COLORS: Record<TransactionType, string> = {
  expense:         'text-red-600',
  income:          'text-green-600',
  transfer:        'text-blue-600',
  opening_balance: 'text-accent',
}

interface FiltersState {
  type: TransactionType | ''
  account_id: string
  payee_id: string
  category_id: string
  tag_id: string
  from: string
  to: string
}

const EMPTY_FILTERS: FiltersState = {
  type: '', account_id: '', payee_id: '', category_id: '', tag_id: '', from: '', to: '',
}

function filtersToQuery(f: FiltersState): TransactionFilters {
  const q: TransactionFilters = {}
  if (f.type) q.type = f.type as TransactionType
  if (f.account_id) q.account_id = f.account_id
  if (f.payee_id) q.payee_id = f.payee_id
  if (f.category_id) q.category_id = f.category_id
  if (f.tag_id) q.tag_id = f.tag_id
  if (f.from) q.from = new Date(f.from).toISOString()
  if (f.to) q.to = new Date(f.to).toISOString()
  return q
}

export default function Transactions() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS)
  const [activeFilters, setActiveFilters] = useState<TransactionFilters>({})
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [drawerTransaction, setDrawerTransaction] = useState<Transaction | null>(null)
  const [drawerSplitId, setDrawerSplitId] = useState<string | null>(null)
  const [drawerSplitTitle, setDrawerSplitTitle] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [bundleTarget, setBundleTarget] = useState<Transaction | null>(null)

  const { data: accounts = [] } = useAccounts()
  const { data: payees = [] } = usePayees()
  const { data: categories = [] } = useCategories()
  const { data: tags = [] } = useTags()
  const { data: splitsData } = useListSplits()
  const deleteTxn = useDeleteTransaction()

  const splitsBySettlementTxnId = useMemo(() => {
    const map = new Map<string, Split>()
    for (const s of splitsData ?? []) {
      if (s.deleted_at) continue
      for (const sh of s.shares) {
        for (const settlement of sh.settlements) {
          map.set(settlement.transaction_id, s)
        }
      }
    }
    return map
  }, [splitsData])

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteTransactions(activeFilters)

  const allItems = data?.pages.flatMap((p) => p.items) ?? []

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(onIntersect, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [onIntersect])

  function applyFilters() {
    setActiveFilters(filtersToQuery(filters))
    setShowFilters(false)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setActiveFilters({})
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openDrawer(t: Transaction) {
    setDrawerTransaction(t)
    const settlementSplit = splitsBySettlementTxnId.get(t.id)
    setDrawerSplitId(settlementSplit?.id ?? t.split_id ?? null)
    if (settlementSplit) {
      const expenseTxn = allItems.find(item => item.id === settlementSplit.expense_transaction_id)
      setDrawerSplitTitle(expenseTxn?.description ?? null)
    } else if (t.is_split) {
      setDrawerSplitTitle(t.description)
    } else {
      setDrawerSplitTitle(null)
    }
  }

  const hasActiveFilters = Object.keys(activeFilters).length > 0

  return (
    <main className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`rounded-md px-3 py-2 text-sm font-medium border ${hasActiveFilters ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            aria-label="Toggle filters"
          >
            {hasActiveFilters ? '⚙ Filters (active)' : '⚙ Filters'}
          </button>
          <button
            onClick={() => navigate({ to: '/transactions/new' })}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + New
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as TransactionType | '' }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account</label>
              <select
                value={filters.account_id}
                onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter by account"
              >
                <option value="">All accounts</option>
                {accounts.filter((a) => !a.deleted_at).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payee</label>
              <select
                value={filters.payee_id}
                onChange={(e) => setFilters((f) => ({ ...f, payee_id: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter by payee"
              >
                <option value="">All payees</option>
                {payees.filter((p) => !p.deleted_at).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={filters.category_id}
                onChange={(e) => setFilters((f) => ({ ...f, category_id: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {categories.filter((c) => !c.deleted_at).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tag</label>
              <select
                value={filters.tag_id}
                onChange={(e) => setFilters((f) => ({ ...f, tag_id: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter by tag"
              >
                <option value="">All tags</option>
                {tags.filter((t) => !t.deleted_at).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter from date"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter to date"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={applyFilters}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Apply
            </button>
            <button
              onClick={clearFilters}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (() => {
        const selectedItems = allItems.filter((t) => selectedIds.has(t.id))
        const singleExpense =
          selectedItems.length === 1 && selectedItems[0].type === 'expense'
            ? selectedItems[0]
            : null
        return (
          <div className="mb-3 flex items-center gap-3 rounded-md bg-indigo-50 border border-indigo-200 px-4 py-2">
            <span className="text-sm text-indigo-700 font-medium">{selectedIds.size} selected</span>
            {singleExpense && (
              <button
                onClick={() => setBundleTarget(singleExpense)}
                className="text-sm text-indigo-600 hover:underline font-medium"
                aria-label="Bundle as split"
              >
                Bundle as Split
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-gray-500 hover:text-gray-700"
            >
              Clear selection
            </button>
          </div>
        )
      })()}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          {[0,1,2,3].map(i => <div key={i} className="h-14 animate-pulse bg-surface-2 rounded-lg" />)}
        </div>
      ) : allItems.length === 0 ? (
        <EmptyState title="No transactions yet" description="Add your first transaction to get started." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-surface-1 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/80 border-b border-border">
                <tr>
                  <th className="w-8 px-3 py-2">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-fg-faint">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-fg-faint">Description / Payee</th>
                  <th className="px-3 py-2 text-right font-medium text-fg-faint">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-fg-faint">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-fg-faint">Account</th>
                  <th className="px-3 py-2 text-left font-medium text-fg-faint w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {allItems.map((t) => {
                  const acc = accounts.find((a) => a.id === t.account_id)
                  const payee = payees.find((p) => p.id === t.payee_id)
                  const isSplitShare = splitsBySettlementTxnId.has(t.id)
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-surface-2/50 cursor-pointer"
                      onClick={() => openDrawer(t)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          aria-label={`Select ${t.description ?? t.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(t.transacted_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900">{t.description ?? '—'}</span>
                          {t.is_split && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/15 text-accent shrink-0">
                              Split
                            </span>
                          )}
                          {isSplitShare && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-positive/10 text-positive-dim shrink-0">
                              Split Share
                            </span>
                          )}
                        </div>
                        {payee && <p className="text-xs text-gray-400">{payee.name}</p>}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${TYPE_COLORS[t.type]}`}>
                        {formatAmount(t)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${TYPE_COLORS[t.type]}`}>
                          {t.type === 'opening_balance' ? 'Opening Balance' : t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{acc?.name ?? '—'}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate({ to: '/transactions/new', search: { editId: t.id } })}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {allItems.map((t) => {
              const acc = accounts.find((a) => a.id === t.account_id)
              const payee = payees.find((p) => p.id === t.payee_id)
              const isSplitShare = splitsBySettlementTxnId.has(t.id)
              return (
                <div
                  key={`mobile-${t.id}`}
                  className="rounded-lg border border-gray-200 bg-white overflow-hidden cursor-pointer"
                  onClick={() => openDrawer(t)}
                >
                  <div className="p-3 flex gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      onClick={e => e.stopPropagation()}
                      className="mt-1 flex-shrink-0"
                      aria-label={`Select ${t.description ?? t.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-gray-900 truncate">{t.description ?? '—'}</span>
                            {t.is_split && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/15 text-accent shrink-0">
                                Split
                              </span>
                            )}
                            {isSplitShare && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-positive/10 text-positive-dim shrink-0">
                                Split Share
                              </span>
                            )}
                          </div>
                          {payee && <p className="text-xs text-gray-400">{payee.name}</p>}
                          <p className="text-xs text-gray-400">{acc?.name ?? '—'} · {formatDate(t.transacted_at)}</p>
                        </div>
                        <p className={`font-semibold whitespace-nowrap ml-2 ${TYPE_COLORS[t.type]}`}>
                          {formatAmount(t)}
                        </p>
                      </div>
                      <div className="mt-2 flex gap-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate({ to: '/transactions/new', search: { editId: t.id } })}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="py-4 text-center">
            {isFetchingNextPage && <span className="text-gray-400 text-sm">Loading more…</span>}
            {!hasNextPage && allItems.length > 0 && (
              <span className="text-gray-300 text-xs">End of results</span>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete transaction"
        description={`Delete this transaction? This can be undone within 30 days.`}
        confirmLabel="Delete"
        isDestructive
        onConfirm={async () => {
          if (deleteTarget) await deleteTxn.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {bundleTarget && (
        <BundleAsSplitModal
          expenseTransactionId={bundleTarget.id}
          expenseAmount={bundleTarget.amount}
          open={!!bundleTarget}
          onClose={() => setBundleTarget(null)}
          onSuccess={() => setSelectedIds(new Set())}
        />
      )}

      <TransactionDrawer
        transaction={drawerTransaction}
        splitId={drawerSplitId}
        splitTitle={drawerSplitTitle}
        onClose={() => { setDrawerTransaction(null); setDrawerSplitId(null); setDrawerSplitTitle(null) }}
      />
    </main>
  )
}
