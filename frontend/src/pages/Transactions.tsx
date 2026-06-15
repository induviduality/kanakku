import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import {
  useTransactions,
  useDeleteTransaction,
  usePatchTransaction,
  type Transaction,
  type TransactionFilters,
  type TransactionType,
} from '../api/transactions'
import { useListSplits, type Split } from '../api/splits'
import { useAccounts } from '../api/accounts'
import { usePayees } from '../api/payees'
import { useCategories } from '../api/categories'
import { useTags } from '../api/tags'
import { usePeriod } from '../lib/period-context'
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
}

const EMPTY_FILTERS: FiltersState = {
  type: '', account_id: '', payee_id: '', category_id: '', tag_id: '',
}


const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 30
const PAGINATION_THRESHOLD = 40

export default function Transactions() {
  const navigate = useNavigate()
  const { dashboardParams } = usePeriod()

  // URL is the source of truth for filters and pagination so state survives navigation.
  const rawSearch = useSearch({ strict: false }) as Record<string, string>
  const urlType       = (rawSearch.txn_type ?? '') as TransactionType | ''
  const urlAccountId  = rawSearch.account_id ?? ''
  const urlPayeeId    = rawSearch.payee_id ?? ''
  const urlCategoryId = rawSearch.category_id ?? ''
  const urlTagId      = rawSearch.tag_id ?? ''
  const urlPageSize   = Number(rawSearch.page_size) || DEFAULT_PAGE_SIZE
  const urlPage       = Math.max(1, Number(rawSearch.page) || 1)
  const urlCursor     = rawSearch.cursor || undefined

  // pendingFilters: what's shown in the filter form before the user clicks Apply
  const [pendingFilters, setPendingFilters] = useState<FiltersState>(() => ({
    type: urlType, account_id: urlAccountId, payee_id: urlPayeeId,
    category_id: urlCategoryId, tag_id: urlTagId,
  }))

  // In-session cursor map: page number → cursor needed to load that page.
  // Grows as the user navigates forward. Falls back to urlCursor on restore.
  const [cursorMap, setCursorMap] = useState<Map<number, string | undefined>>(() => {
    const m = new Map<number, string | undefined>()
    m.set(1, undefined)
    if (urlPage > 1 && urlCursor) m.set(urlPage, urlCursor)
    return m
  })

  // UI-only state
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [drawerTransaction, setDrawerTransaction] = useState<Transaction | null>(null)
  const [drawerSplitId, setDrawerSplitId] = useState<string | null>(null)
  const [drawerSplitTitle, setDrawerSplitTitle] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [bundleTarget, setBundleTarget] = useState<Transaction[] | null>(null)
  const [editingDescId, setEditingDescId] = useState<string | null>(null)
  const [editingDescValue, setEditingDescValue] = useState('')

  // The cursor we actually fetch with: prefer in-session map (accurate Prev),
  // fall back to URL cursor (fresh restore from a bookmarked/back-navigated URL).
  const fetchCursor = cursorMap.get(urlPage) ?? urlCursor

  // Write filter + pagination state into the URL
  function pushSearch(updates: Record<string, string | number | undefined>) {
    navigate({
      to: '/transactions',
      search: { ...rawSearch, ...updates } as Record<string, string>,
    })
  }

  // Applied filters = what's in the URL right now
  const appliedFilters = useMemo<TransactionFilters>(() => {
    const q: TransactionFilters = {}
    if (urlType)       q.type = urlType as TransactionType
    if (urlAccountId)  q.account_id = urlAccountId
    if (urlPayeeId)    q.payee_id = urlPayeeId
    if (urlCategoryId) q.category_id = urlCategoryId
    if (urlTagId)      q.tag_id = urlTagId
    return q
  }, [urlType, urlAccountId, urlPayeeId, urlCategoryId, urlTagId])

  // Merge URL filters with the global period from the navbar calendar
  const activeFilters = useMemo<TransactionFilters>(() => ({
    ...appliedFilters,
    ...(dashboardParams.start_date && { from: dashboardParams.start_date + 'T00:00:00.000Z' }),
    ...(dashboardParams.end_date && { to: dashboardParams.end_date + 'T23:59:59.999Z' }),
  }), [appliedFilters, dashboardParams])

  const { data: accounts = [] } = useAccounts()
  const { data: payees = [] } = usePayees()
  const { data: categories = [] } = useCategories()
  const { data: tags = [] } = useTags()
  const { data: splitsData } = useListSplits()
  const deleteTxn = useDeleteTransaction()
  const patchTxn = usePatchTransaction()
  const { data: txnData, isLoading } = useTransactions(activeFilters, urlPageSize, fetchCursor)

  function startEditDesc(t: Transaction, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingDescId(t.id)
    setEditingDescValue(t.description ?? '')
  }

  async function saveEditDesc(t: Transaction) {
    const trimmed = editingDescValue.trim()
    if (trimmed !== (t.description ?? '')) {
      await patchTxn.mutateAsync({ id: t.id, patch: { description: trimmed } })
    }
    setEditingDescId(null)
  }

  function cancelEditDesc() {
    setEditingDescId(null)
  }

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

  const allItems = txnData?.items ?? []
  const total = txnData?.total ?? 0
  const nextCursor = txnData?.next_cursor ?? null
  const showPagination = total > PAGINATION_THRESHOLD
  const totalPages = showPagination ? Math.ceil(total / urlPageSize) : 1

  const topRef = useRef<HTMLElement>(null)

  function goNext() {
    if (!nextCursor) return
    const newPage = urlPage + 1
    setCursorMap((prev) => new Map(prev).set(newPage, nextCursor))
    pushSearch({ page: newPage, cursor: nextCursor })
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function goPrev() {
    if (urlPage <= 1) return
    const prevPage = urlPage - 1
    // If we have the cursor in-session, use it; otherwise jump to page 1
    const hasPrevCursor = cursorMap.has(prevPage)
    const targetPage   = (prevPage > 1 && !hasPrevCursor) ? 1 : prevPage
    const targetCursor = cursorMap.get(targetPage)
    pushSearch({ page: targetPage, cursor: targetCursor })
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function applyFilters() {
    setCursorMap(new Map([[1, undefined]]))
    pushSearch({
      txn_type: pendingFilters.type || undefined,
      account_id: pendingFilters.account_id || undefined,
      payee_id: pendingFilters.payee_id || undefined,
      category_id: pendingFilters.category_id || undefined,
      tag_id: pendingFilters.tag_id || undefined,
      page: 1, cursor: undefined,
    })
    setShowFilters(false)
  }

  function clearFilters() {
    setPendingFilters(EMPTY_FILTERS)
    setCursorMap(new Map([[1, undefined]]))
    pushSearch({
      txn_type: undefined, account_id: undefined, payee_id: undefined,
      category_id: undefined, tag_id: undefined, page: 1, cursor: undefined,
    })
  }

  function changePageSize(size: number) {
    setCursorMap(new Map([[1, undefined]]))
    pushSearch({ page_size: size, page: 1, cursor: undefined })
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
      const expenseTxn = allItems.find(item => settlementSplit.expense_transaction_ids.includes(item.id))
      setDrawerSplitTitle(expenseTxn?.description ?? null)
    } else if (t.is_split) {
      setDrawerSplitTitle(t.description)
    } else {
      setDrawerSplitTitle(null)
    }
  }

  const hasActiveFilters = !!(urlType || urlAccountId || urlPayeeId || urlCategoryId || urlTagId)

  return (
    <main ref={topRef} className={`p-4 md:p-6 max-w-5xl mx-auto ${selectedIds.size > 0 ? 'pb-20' : ''}`}>
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
                value={pendingFilters.type}
                onChange={(e) => setPendingFilters((f) => ({ ...f, type: e.target.value as TransactionType | '' }))}
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
                value={pendingFilters.account_id}
                onChange={(e) => setPendingFilters((f) => ({ ...f, account_id: e.target.value }))}
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
                value={pendingFilters.payee_id}
                onChange={(e) => setPendingFilters((f) => ({ ...f, payee_id: e.target.value }))}
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
                value={pendingFilters.category_id}
                onChange={(e) => setPendingFilters((f) => ({ ...f, category_id: e.target.value }))}
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
                value={pendingFilters.tag_id}
                onChange={(e) => setPendingFilters((f) => ({ ...f, tag_id: e.target.value }))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Filter by tag"
              >
                <option value="">All tags</option>
                {tags.filter((t) => !t.deleted_at).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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

      {/* Sticky bulk action bar */}
      {selectedIds.size > 0 && (() => {
        const selectedItems = allItems.filter((t) => selectedIds.has(t.id))
        const selectedExpenses = selectedItems.filter((t) => t.type === 'expense')
        const allExpenses = selectedExpenses.length === selectedItems.length
        return (
          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center gap-3 bg-white border-t border-indigo-200 shadow-lg px-4 py-3 md:left-64">
            <span className="text-sm font-semibold text-indigo-700 shrink-0">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {allExpenses ? (
                <button
                  onClick={() => setBundleTarget(selectedExpenses)}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  aria-label="Bundle as split"
                >
                  Bundle as Split
                </button>
              ) : (
                <span className="text-xs text-gray-400 italic">
                  Select only expenses to bundle as split
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 shrink-0"
            >
              Clear
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
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        {editingDescId === t.id ? (
                          <input
                            autoFocus
                            value={editingDescValue}
                            onChange={(e) => setEditingDescValue(e.target.value)}
                            onBlur={() => saveEditDesc(t)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); saveEditDesc(t) }
                              if (e.key === 'Escape') cancelEditDesc()
                            }}
                            className="w-full rounded border border-indigo-400 px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="font-medium text-gray-900 cursor-text"
                                onDoubleClick={(e) => startEditDesc(t, e)}
                                title="Double-click to edit"
                              >
                                {t.description ?? '—'}
                              </span>
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
                            {payee && <p className="text-xs text-fg-faint">{payee.name}</p>}
                          </>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${TYPE_COLORS[t.type]}`}>
                        {formatAmount(t)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-medium ${TYPE_COLORS[t.type]}`}>
                          {t.type === 'opening_balance' ? 'Opening Balance' : t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-fg-muted">
                        {t.type === 'transfer' ? (
                          <span>
                            {acc?.name ?? '—'}
                            <span className="text-fg-faint mx-1">→</span>
                            {accounts.find(a => a.id === t.to_account_id)?.name ?? '—'}
                          </span>
                        ) : (
                          acc?.name ?? '—'
                        )}
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => navigate({ to: '/transactions/new', search: { editId: t.id } })}
                            className="p-1.5 rounded text-fg-faint hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="p-1.5 rounded text-fg-faint hover:text-negative-dim hover:bg-negative/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                          {editingDescId === t.id ? (
                            <input
                              autoFocus
                              value={editingDescValue}
                              onChange={(e) => setEditingDescValue(e.target.value)}
                              onBlur={() => saveEditDesc(t)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); saveEditDesc(t) }
                                if (e.key === 'Escape') cancelEditDesc()
                              }}
                              className="w-full rounded border border-indigo-400 px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="font-medium text-gray-900 truncate cursor-text"
                                onDoubleClick={(e) => startEditDesc(t, e)}
                                title="Double-click to edit"
                              >
                                {t.description ?? '—'}
                              </span>
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
                          )}
                          {payee && <p className="text-xs text-fg-faint">{payee.name}</p>}
                          <p className="text-xs text-fg-faint">
                            {t.type === 'transfer'
                              ? `${acc?.name ?? '—'} → ${accounts.find(a => a.id === t.to_account_id)?.name ?? '—'}`
                              : acc?.name ?? '—'
                            } · {formatDate(t.transacted_at)}
                          </p>
                        </div>
                        <p className={`font-semibold whitespace-nowrap ml-2 ${TYPE_COLORS[t.type]}`}>
                          {formatAmount(t)}
                        </p>
                      </div>
                      <div className="mt-2 flex gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => navigate({ to: '/transactions/new', search: { editId: t.id } })}
                          className="p-1.5 rounded text-fg-faint hover:text-accent hover:bg-accent/10 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="p-1.5 rounded text-fg-faint hover:text-negative-dim hover:bg-negative/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {showPagination && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm flex-wrap">
              <button
                onClick={goPrev}
                disabled={urlPage <= 1}
                className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>

              <span className="text-gray-500 px-1">
                Page {urlPage} of {totalPages}
              </span>

              <select
                value={urlPageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700 bg-white"
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>

              <button
                onClick={goNext}
                disabled={!nextCursor}
                className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
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
          expenseTransactionIds={bundleTarget.map((t) => t.id)}
          expenseAmount={bundleTarget.reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2)}
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
