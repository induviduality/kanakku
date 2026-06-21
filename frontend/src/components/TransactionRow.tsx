import type { Transaction } from '../api/transactions'

export interface TransactionRowProps {
  transaction: Transaction
  accountName: string
  toAccountName?: string
  payeeName?: string
  isSelected: boolean
  onClick: () => void
  showCheckbox: boolean
}

export function TransactionRow({
  transaction,
  accountName,
  toAccountName,
  payeeName,
  isSelected,
  onClick,
  showCheckbox,
}: TransactionRowProps) {
  const date = new Date(transaction.transacted_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })
  const amount = parseFloat(transaction.amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
  })

  let sourceDest: string
  if (transaction.type === 'transfer' && toAccountName) {
    sourceDest = `${accountName} → ${toAccountName}`
  } else if (transaction.type === 'income') {
    sourceDest = payeeName ? `${payeeName} → ${accountName}` : accountName
  } else {
    // expense and opening_balance
    sourceDest = payeeName ? `${accountName} → ${payeeName}` : accountName
  }

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={onClick}
      className={`flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-surface-2 transition-colors ${
        isSelected ? 'bg-accent/10 border-l-2 border-accent' : ''
      }`}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 shrink-0 accent-accent"
          tabIndex={-1}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-fg-muted shrink-0 tabular-nums">{date}</span>
          <span className="text-sm text-fg truncate flex-1 ml-2">
            {transaction.description ?? '—'}
          </span>
          <span className="text-sm font-medium text-fg shrink-0 kk-mono">₹{amount}</span>
        </div>
        <p className="text-xs text-fg-muted truncate mt-0.5">{sourceDest}</p>
      </div>
    </div>
  )
}
