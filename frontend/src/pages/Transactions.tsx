import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
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
  account_id: string   // comma-separated
  payee_id: string     // comma-separated
  category_id: string
  tag_id: string       // comma-separated
}

const EMPTY_FILTERS: FiltersState = {
  type: '', account_id: '', payee_id: '', category_id: '', tag_id: '',
}

// ── MultiSelect ───────────────────────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const buttonLabel =
    selected.length === 0
      ? `All ${label}`
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.name ?? '1 selected')
        : `${selected.length} ${label}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded border px-2 py-1.5 text-sm text-left ${selected.length > 0 ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-700 bg-white'}`}
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[180px] bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No options</p>
          ) : (
            options.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm select-none">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  className="rounded"
                />
                {opt.name}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100]
const DEFAULT_PAGE_SIZE = 30

export default function Transactions() {
  const navigate = useNavigate()
  const { dashboardParams, rangeStart, rangeEnd } = usePeriod()

  // URL is the source of truth for filters, sort, and pagination so state survives navigation.
  const rawSearch = useSearch({ strict: false }) as Record<string, string>
  const urlType       = (rawSearch.txn_type ?? '') as TransactionType | ''
  const urlAccountId  = rawSearch.account_id ?? ''
  const urlPayeeId    = rawSearch.payee_id ?? ''
  const urlCategoryId = rawSearch.category_id ?? ''
  const urlTagId      = rawSearch.tag_id ?? ''
  const urlSortBy     = (rawSearch.sort_by ?? 'transacted_at') as 'transacted_at' | 'amount'
  const urlSortDir    = (rawSearch.sort_dir ?? 'desc') as 'asc' | 'desc'
  const urlPageSize   = Number(rawSearch.page_size) || DEFAULT_PAGE_SIZE
  const urlPage       = Math.max(1, Number(rawSearch.page) || 1)
  const urlCursor     = rawSearch.cursor || undefined

  // pendingFilters: what's shown in the filter form before the user clicks Apply
  const [pendingFilters, setPendingFilters] = useState<FiltersState>(() => ({
    type: urlType,
    account_id: urlAccountId,
    payee_id: urlPayeeId,
    category_id: urlCategoryId,
    tag_id: urlTagId,
  }))

  // In-session cursor map: page number → cursor needed to load that page.
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
  const [showFilters, setShowFilters] = useState(false)
  const [editingDescId, setEditingDescId] = useState<string | null>(null)
  const [editingDescValue, setEditingDescValue] = useState('')

  const fetchCursor = cursorMap.get(urlPage) ?? urlCursor

  function pushSearch(updates: Record<string, string | number | undefined>) {
    navigate({
      to: '/transactions',
      search: { ...rawSearch, ...updates } as Record<string, string>,
    })
  }

  const appliedFilters = useMemo<TransactionFilters>(() => {
    const q: TransactionFilters = {}
    if (urlType)       q.type = urlType as TransactionType
    if (urlAccountId)  q.account_id = urlAccountId
    if (urlPayeeId)    q.payee_id = urlPayeeId
    if (urlCategoryId) q.category_id = urlCategoryId
    if (urlTagId)      q.tag_id = urlTagId
    if (urlSortBy !== 'transacted_at') q.sort_by = urlSortBy
    if (urlSortDir !== 'desc') q.sort_dir = urlSortDir
    return q
  }, [urlType, urlAccountId, urlPayeeId, urlCategoryId, urlTagId, urlSortBy, urlSortDir])

  const activeFilters = useMemo<TransactionFilters>(() => ({
    ...appliedFilters,
    ...(dashboardParams.start_date && { from: rangeStart }),
    ...(dashboardParams.end_date && { to: rangeEnd }),
  }), [appliedFilters, dashboardParams, rangeStart, rangeEnd])

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
  const totalInflow = parseFloat(txnData?.total_inflow ?? '0')
  const totalOutflow = parseFloat(txnData?.total_outflow ?? '0')
  const openingBalance = parseFloat(txnData?.opening_balance ?? '0')
  const closingBalance = parseFloat(txnData?.closing_balance ?? '0')
  const hasDateFilter = !!(activeFilters.from || activeFilters.to)
  const nextCursor = txnData?.next_cursor ?? null
  const totalPages = Math.max(1, Math.ceil(total / urlPageSize))
  const showPagination = total > urlPageSize || urlPage > 1

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
    const hasPrevCursor = cursorMap.has(prevPage)
    const targetPage   = (prevPage > 1 && !hasPrevCursor) ? 1 : prevPage
    const targetCursor = cursorMap.get(targetPage)
    pushSearch({ page: targetPage, cursor: targetCursor })
    topRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Pending multi-select arrays (derived from pendingFilters strings)
  const pendingAccountIds = pendingFilters.account_id ? pendingFilters.account_id.split(',').filter(Boolean) : []
  const pendingPayeeIds   = pendingFilters.payee_id   ? pendingFilters.payee_id.split(',').filter(Boolean)   : []
  const pendingTagIds     = pendingFilters.tag_id     ? pendingFilters.tag_id.split(',').filter(Boolean)     : []

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

  function changeSort(by: string, dir: string) {
    setCursorMap(new Map([[1, undefined]]))
    pushSearch({ sort_by: by, sort_dir: dir, page: 1, cursor: undefined })
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

  const activeAccounts = accounts.filter((a) => !a.deleted_at)
  const activePayees   = payees.filter((p) => !p.deleted_at)
  const activeCategories = categories.filter((c) => !c.deleted_at)
  const activeTags     = tags.filter((t) => !t.deleted_at)

  return (
    <main ref={topRef} className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Sort controls */}
          <div className="flex items-center gap-1">
            <select
              value={urlSortBy}
              onChange={(e) => changeSort(e.target.value, urlSortDir)}
              className="rounded border border-gray-300 px-2 py-2 text-sm text-gray-700 bg-white"
              aria-label="Sort by"
            >
              <option value="transacted_at">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>
            <button
              onClick={() => changeSort(urlSortBy, urlSortDir === 'desc' ? 'asc' : 'desc')}
              className="rounded border border-gray-300 px-2.5 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50"
              title={urlSortDir === 'desc' ? 'Descending — click to sort ascending' : 'Ascending — click to sort descending'}
              aria-label={urlSortDir === 'desc' ? 'Sort descending' : 'Sort ascending'}
            >
              {urlSortDir === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          {showPagination && (
            <select
              value={urlPageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="rounded border border-gray-300 px-2 py-2 text-sm text-gray-700 bg-white"
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} per page</option>
              ))}
            </select>
          )}

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
              <MultiSelect
                label="accounts"
                options={activeAccounts.map((a) => ({ id: a.id, name: a.name }))}
                selected={pendingAccountIds}
                onChange={(ids) => setPendingFilters((f) => ({ ...f, account_id: ids.join(',') }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payee</label>
              <MultiSelect
                label="payees"
                options={activePayees.map((p) => ({ id: p.id, name: p.name }))}
                selected={pendingPayeeIds}
                onChange={(ids) => setPendingFilters((f) => ({ ...f, payee_id: ids.join(',') }))}
              />
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
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tag</label>
              <MultiSelect
                label="tags"
                options={activeTags.map((t) => ({ id: t.id, name: t.name }))}
                selected={pendingTagIds}
                onChange={(ids) => setPendingFilters((f) => ({ ...f, tag_id: ids.join(',') }))}
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



      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          {[0,1,2,3].map(i => <div key={i} className="h-14 animate-pulse bg-surface-2 rounded-lg" />)}
        </div>
      ) : allItems.length === 0 ? (
        <EmptyState title="No transactions yet" description="Add your first transaction to get started." />
      ) : (
        <>
          {/* Total count + inflow/outflow summary + page info */}
          <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              <span>{total.toLocaleString()} transaction{total !== 1 ? 's' : ''}</span>
              {(totalInflow > 0 || totalOutflow > 0) && (
                <>
                  <span className="text-green-600">+{totalInflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span className="text-red-600">−{totalOutflow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </>
              )}
              {hasDateFilter && (
                <>
                  <span>Opening: {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  <span>Closing: {closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </>
              )}
            </div>
            {showPagination && <span>Page {urlPage} of {totalPages}</span>}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-surface-1 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/80 border-b border-border">
                <tr>

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



      <TransactionDrawer
        transaction={drawerTransaction}
        splitId={drawerSplitId}
        splitTitle={drawerSplitTitle}
        onClose={() => { setDrawerTransaction(null); setDrawerSplitId(null); setDrawerSplitTitle(null) }}
      />
    </main>
  )
}
