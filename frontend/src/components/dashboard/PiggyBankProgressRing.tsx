import type { PiggyBankSummaryItem } from '../../api/dashboard'

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function PiggyBankProgressRing({ piggyBank }: { piggyBank: PiggyBankSummaryItem }) {
  const clamped = Math.min(Math.max(piggyBank.progress_pct, 0), 100)
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE

  return (
    <div className="flex items-center gap-3">
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        aria-label={`${clamped.toFixed(0)}% progress`}
        className="shrink-0"
      >
        <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          stroke={piggyBank.is_completed ? '#22c55e' : '#6366f1'}
          strokeWidth="6"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="36" textAnchor="middle" fontSize="12" fill="#374151" fontWeight="600">
          {clamped.toFixed(0)}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{piggyBank.name}</p>
        <p className="text-xs text-gray-500">
          ₹{parseFloat(piggyBank.current_amount).toLocaleString('en-IN')} / ₹{parseFloat(piggyBank.target_amount).toLocaleString('en-IN')}
        </p>
        {piggyBank.is_completed && (
          <span className="text-xs font-medium text-green-700">Completed ✓</span>
        )}
      </div>
    </div>
  )
}
