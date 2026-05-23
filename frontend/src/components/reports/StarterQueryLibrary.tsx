interface StarterQueryLibraryProps {
  onSelect: (sql: string) => void
}

const STARTER_QUERIES = [
  {
    label: 'Spending by category this month',
    sql: `SELECT c.name AS category, SUM(t.amount) AS total
FROM transactions t
JOIN transaction_categories tc ON tc.transaction_id = t.id
JOIN categories c ON c.id = tc.category_id
WHERE t.user_id = :user_id
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND date_trunc('month', t.transacted_at) = date_trunc('month', now())
GROUP BY c.name
ORDER BY total DESC`,
  },
  {
    label: 'Top 10 payees this year',
    sql: `SELECT p.name AS payee, SUM(t.amount) AS total
FROM transactions t
JOIN payees p ON p.id = t.payee_id
WHERE t.user_id = :user_id
  AND t.type = 'expense'
  AND t.deleted_at IS NULL
  AND date_trunc('year', t.transacted_at) = date_trunc('year', now())
GROUP BY p.name
ORDER BY total DESC
LIMIT 10`,
  },
  {
    label: 'Pending splits totals',
    sql: `SELECT p.name AS person, SUM(ss.amount) AS owed
FROM split_shares ss
JOIN splits s ON s.id = ss.split_id
LEFT JOIN payees p ON p.id = ss.payee_id
WHERE s.user_id = :user_id
  AND s.deleted_at IS NULL
  AND ss.status = 'pending'
  AND ss.payee_id IS NOT NULL
GROUP BY p.name
ORDER BY owed DESC`,
  },
  {
    label: 'Budget vs actual (current month)',
    sql: `SELECT b.name AS budget, b.amount AS budget_amount,
       COALESCE(SUM(t.amount), 0) AS spent,
       b.amount - COALESCE(SUM(t.amount), 0) AS remaining
FROM budgets b
LEFT JOIN transaction_budgets tb ON tb.budget_id = b.id
LEFT JOIN transactions t ON t.id = tb.transaction_id
  AND t.deleted_at IS NULL
  AND date_trunc('month', t.transacted_at) = date_trunc('month', now())
WHERE b.user_id = :user_id
  AND b.deleted_at IS NULL
  AND b.is_active = true
GROUP BY b.id, b.name, b.amount`,
  },
  {
    label: 'Income vs expenses by month',
    sql: `SELECT to_char(date_trunc('month', transacted_at), 'YYYY-MM') AS month,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expenses
FROM transactions
WHERE user_id = :user_id
  AND deleted_at IS NULL
  AND type IN ('income', 'expense')
GROUP BY month
ORDER BY month DESC
LIMIT 12`,
  },
  {
    label: 'Account balance history',
    sql: `SELECT a.name AS account, a.currency,
       a.current_balance,
       a.opening_balance,
       a.current_balance - a.opening_balance AS net_change
FROM accounts a
WHERE a.user_id = :user_id
  AND a.deleted_at IS NULL
  AND a.is_active = true
ORDER BY a.current_balance DESC`,
  },
]

export default function StarterQueryLibrary({ onSelect }: StarterQueryLibraryProps) {
  return (
    <div aria-label="Starter query library">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Starter Queries
      </h3>
      <ul className="space-y-1">
        {STARTER_QUERIES.map((q) => (
          <li key={q.label}>
            <button
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 transition-colors"
              onClick={() => onSelect(q.sql)}
            >
              {q.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
