import { useState, useMemo, useEffect } from 'react'
import { useTransactions, type Transaction } from '../api/transactions'
import { useAccounts } from '../api/accounts'
import { usePayees } from '../api/payees'
import { TransactionRow } from './TransactionRow'

export interface TransactionPickerProps {
  type: 'income' | 'expense'
  value: string | string[]
  onChange: (value: string | string[]) => void
  multiple?: boolean
  excludeIds?: string[]
  placeholder?: string
  className?: string
}

type Tier = 'local' | 'all'

function useDateAnchor(daysBack: number): string {
  return useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - daysBack)
    return d.toISOString().split('T')[0]
  }, [daysBack])
}

export function TransactionPicker({
  type,
  value,
  onChange,
  multiple = false,
  excludeIds = [],
  placeholder = 'Search transactions…',
  className = '',
}: TransactionPickerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [tier, setTier] = useState<Tier>('local')

  // Debounce query input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Reset tier escalation when the query changes
  useEffect(() => {
    setTier('local')
  }, [debouncedQuery])

  const from3m = useDateAnchor(90)
  const from1y = useDateAnchor(365)

  const { data: accountsData } = useAccounts()
  const { data: payeesData } = usePayees()

  // Tier-1: last 3 months, loaded upfront
  const { data: tier1Data } = useTransactions({ type, from: from3m }, 200)
  const pool: Transaction[] = tier1Data?.items ?? []

  // Client-side filter on tier-1 pool
  const clientFiltered = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    return pool.filter(
      (t) =>
        !excludeIds.includes(t.id) &&
        (!q || (t.description ?? '').toLowerCase().includes(q)),
    )
  }, [pool, debouncedQuery, excludeIds])

  const noClientMatches = debouncedQuery.length >= 2 && clientFiltered.length === 0

  // Tier-2: last year, triggered automatically when client has no matches
  const { data: tier2Data, isFetching: tier2Fetching } = useTransactions(
    { type, from: from1y, q: debouncedQuery },
    100,
    undefined,
    { enabled: noClientMatches && tier === 'local' },
  )
  const tier2Items = useMemo(
    () => (tier2Data?.items ?? []).filter((t) => !excludeIds.includes(t.id)),
    [tier2Data, excludeIds],
  )

  // Tier-3: all time, triggered by user clicking "Search all transactions"
  const { data: tier3Data, isFetching: tier3Fetching } = useTransactions(
    { type, q: debouncedQuery },
    100,
    undefined,
    { enabled: tier === 'all' && debouncedQuery.length >= 2 },
  )
  const tier3Items = useMemo(
    () => (tier3Data?.items ?? []).filter((t) => !excludeIds.includes(t.id)),
    [tier3Data, excludeIds],
  )

  // Name lookup maps
  const accountMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const a of accountsData ?? []) m[a.id] = a.name
    return m
  }, [accountsData])

  const payeeMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of payeesData ?? []) m[p.id] = p.name
    return m
  }, [payeesData])

  // Decide which list to show
  const activeItems: Transaction[] =
    tier === 'all' ? tier3Items : noClientMatches ? tier2Items : clientFiltered
  const isFetching = tier2Fetching || tier3Fetching

  const showSearchAllButton =
    noClientMatches &&
    !tier2Fetching &&
    tier === 'local' &&
    tier2Data !== undefined &&
    tier2Items.length === 0

  // Status label
  let statusLabel: string | null = null
  if (!debouncedQuery) {
    statusLabel = 'Showing last 3 months'
  } else if (tier === 'all' && tier3Data) {
    statusLabel = `All-time results for '${debouncedQuery}'`
  } else if (noClientMatches && tier2Data && tier2Items.length > 0) {
    statusLabel = 'Results from the last year'
  }

  // Selection helpers
  const selectedIds = Array.isArray(value) ? value : value ? [value] : []

  function handleSelect(id: string) {
    if (multiple) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
      onChange(next)
    } else {
      onChange(id)
    }
  }

  return (
    <div className={`rounded-lg border border-border bg-surface overflow-hidden ${className}`}>
      <div className="px-2 pt-2 pb-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="kk-input text-sm w-full"
        />
      </div>

      {statusLabel && (
        <p className="px-3 py-1 text-xs text-fg-faint">{statusLabel}</p>
      )}

      {isFetching && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-fg-muted">
          <span className="w-3 h-3 border border-fg-muted border-t-transparent rounded-full animate-spin" />
          {tier === 'all' ? 'Searching all transactions…' : 'Searching last year…'}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto py-1">
        {activeItems.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={t}
            accountName={accountMap[t.account_id] ?? t.account_id.slice(0, 8)}
            toAccountName={
              t.to_account_id ? (accountMap[t.to_account_id] ?? undefined) : undefined
            }
            payeeName={t.payee_id ? (payeeMap[t.payee_id] ?? undefined) : undefined}
            isSelected={selectedIds.includes(t.id)}
            onClick={() => handleSelect(t.id)}
            showCheckbox={multiple}
          />
        ))}

        {showSearchAllButton && (
          <div className="px-3 py-3 text-center space-y-1">
            <p className="text-xs text-fg-muted">No results in the last year.</p>
            <button
              type="button"
              onClick={() => setTier('all')}
              className="text-xs text-accent hover:underline"
            >
              Search all transactions
            </button>
          </div>
        )}

        {tier === 'all' && !tier3Fetching && tier3Data && tier3Items.length === 0 && (
          <p className="px-3 py-3 text-center text-xs text-fg-muted">No results found.</p>
        )}

        {!debouncedQuery && activeItems.length === 0 && !isFetching && tier1Data && (
          <p className="px-3 py-3 text-center text-xs text-fg-muted">
            No {type} transactions in the last 3 months.
          </p>
        )}
      </div>
    </div>
  )
}
