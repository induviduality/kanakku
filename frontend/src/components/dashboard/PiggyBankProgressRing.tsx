import type { PiggyBankSummaryItem } from '../../api/dashboard'

const RADIUS = 28
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function PiggyBankProgressRing({ piggyBank }: { piggyBank: PiggyBankSummaryItem }) {
  const clamped = Math.min(Math.max(piggyBank.progress_pct, 0), 100)
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE
  const arcColor = piggyBank.is_completed ? 'var(--kk-positive)' : 'var(--kk-accent)'

  return (
    <div className="flex items-center gap-3">
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        aria-label={`${clamped.toFixed(0)}% progress`}
        className="shrink-0"
      >
        {/* Track */}
        <circle
          cx="32" cy="32" r={RADIUS}
          fill="none"
          stroke="var(--kk-border-strong)"
          strokeWidth="6"
        />
        {/* Progress arc */}
        <circle
          cx="32" cy="32" r={RADIUS}
          fill="none"
          stroke={arcColor}
          strokeWidth="6"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        {/* Percentage label */}
        <text
          x="32" y="36"
          textAnchor="middle"
          fontSize="12"
          fill="var(--kk-fg)"
          fontWeight="600"
          fontFamily="var(--kk-font-mono)"
        >
          {clamped.toFixed(0)}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg truncate">{piggyBank.name}</p>
        <p className="text-xs text-fg-muted kk-mono">
          ₹{parseFloat(piggyBank.current_amount).toLocaleString('en-IN')} / ₹{parseFloat(piggyBank.target_amount).toLocaleString('en-IN')}
        </p>
        {piggyBank.is_completed && (
          <span className="text-xs font-medium text-positive-dim">Completed ✓</span>
        )}
      </div>
    </div>
  )
}
