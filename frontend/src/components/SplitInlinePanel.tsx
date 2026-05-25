import { type Split, type SplitShareStatus } from '../api/splits'

const BAR_COLOR: Record<SplitShareStatus | 'own', string> = {
  own:      'bg-accent',
  pending:  'bg-warning',
  settled:  'bg-positive',
  forgiven: 'bg-fg-faint',
}

const DOT_COLOR: Record<SplitShareStatus | 'own', string> = {
  own:      'bg-accent',
  pending:  'bg-warning',
  settled:  'bg-positive',
  forgiven: 'bg-fg-faint/60',
}

const BADGE_CLS: Record<SplitShareStatus, string> = {
  pending:  'bg-warning/15 text-warning-dim',
  settled:  'bg-positive/10 text-positive-dim',
  forgiven: 'bg-surface-3 text-fg-muted',
}

interface Segment {
  label: string
  amount: number
  status: SplitShareStatus | 'own'
}

interface Props {
  split: Split
  transactionAmount: number
  payeeMap: Record<string, string>
}

export function SplitInlinePanel({ split, transactionAmount, payeeMap }: Props) {
  const totalShares = split.shares.reduce((s, sh) => s + parseFloat(sh.amount), 0)
  const ownShare = Math.max(0, transactionAmount - totalShares)
  const pendingCount = split.shares.filter(s => s.status === 'pending').length
  const allForgiven = split.shares.length > 0 && split.shares.every(s => s.status === 'forgiven')

  const segments: Segment[] = [
    { label: 'You', amount: ownShare, status: 'own' },
    ...split.shares.map(sh => ({
      label: sh.payee_id ? (payeeMap[sh.payee_id] ?? 'Unknown') : 'Unknown',
      amount: parseFloat(sh.amount),
      status: sh.status,
    })),
  ]

  const overallBadge = pendingCount > 0
    ? { cls: 'bg-warning/15 text-warning-dim', text: `${pendingCount} pending` }
    : allForgiven
    ? { cls: 'bg-surface-3 text-fg-muted', text: 'forgiven' }
    : { cls: 'bg-positive/10 text-positive-dim', text: 'settled' }

  return (
    <div className="px-4 pt-2.5 pb-3 bg-surface-2/25 border-t border-border/40">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">Split</span>
        <span className="text-[10px] text-fg-faint">·</span>
        <span className="text-[10px] text-fg-faint">{segments.length} ways</span>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${overallBadge.cls}`}>
          {overallBadge.text}
        </span>
      </div>

      <div className="flex gap-5 items-start">
        {/* Left column: full expense total — desktop only */}
        <div className="hidden md:flex flex-col items-center justify-center shrink-0 border-r border-border/50 pr-5 mr-1 min-w-[88px]">
          <p className="text-[10px] uppercase tracking-wide text-fg-faint mb-0.5">full expense</p>
          <p className="text-base font-bold kk-mono text-fg">
            ₹{transactionAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Right column: share rows + bar */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLOR[seg.status]}`} />
              <span className="text-xs font-medium text-fg truncate min-w-[56px] max-w-[120px]">
                {seg.label}
              </span>
              {/* Proportional inline bar */}
              <div className="flex-1 h-1 rounded-full bg-surface-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${BAR_COLOR[seg.status]} opacity-75 transition-all`}
                  style={{ width: `${(seg.amount / transactionAmount) * 100}%` }}
                />
              </div>
              <span className="text-xs kk-mono text-fg-dim whitespace-nowrap ml-1">
                ₹{seg.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              {seg.status !== 'own' && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${BADGE_CLS[seg.status]}`}>
                  {seg.status}
                </span>
              )}
            </div>
          ))}

          {/* Stacked bar at bottom */}
          <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
            {segments.map((seg, i) => (
              <div
                key={i}
                className={`${BAR_COLOR[seg.status]} opacity-70`}
                style={{ width: `${(seg.amount / transactionAmount) * 100}%`, minWidth: seg.amount > 0 ? '2px' : '0' }}
                title={`${seg.label}: ₹${seg.amount.toLocaleString('en-IN')}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
