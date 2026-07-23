// Shared display logic for account balances.
//
// With computed balances (see backend app/services/account_balance.py), a
// liability account (credit_card / loan) carries a *negative* balance whose
// magnitude is the amount owed. A bare "-₹12,450" reads badly for a card, so
// liability balances get a "due / cleared / credit" framing instead:
//   owe        (balance < 0)  → "₹12,450 due"      (negative tone)
//   cleared    (balance == 0) → "₹0 · cleared"     (neutral tone)
//   overpaid   (balance > 0)  → "₹500 credit"      (positive tone)
// Asset accounts (bank / cash) keep the plain signed figure, red when negative.

export const LIABILITY_TYPES = ['credit_card', 'loan'] as const

export function isLiability(type: string): boolean {
  return (LIABILITY_TYPES as readonly string[]).includes(type)
}

export type BalanceTone = 'positive' | 'negative' | 'neutral'

export interface BalanceDisplay {
  /** Formatted amount without currency, e.g. "12,450" or "12,450.50". */
  amount: string
  /** Full label including any suffix, e.g. "12,450 due" / "0 · cleared" / "500 credit". */
  label: string
  tone: BalanceTone
}

const INR = (n: number) =>
  Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/**
 * Format an account balance for display. `type` decides whether the
 * liability "due/cleared/credit" framing applies.
 */
export function formatAccountBalance(balance: number, type: string): BalanceDisplay {
  const amount = INR(balance)

  if (isLiability(type)) {
    if (balance < 0) return { amount, label: `${amount} due`, tone: 'negative' }
    if (balance > 0) return { amount, label: `${amount} credit`, tone: 'positive' }
    return { amount, label: `${amount} · cleared`, tone: 'neutral' }
  }

  // Asset account: plain signed figure, negative in red.
  return { amount, label: amount, tone: balance < 0 ? 'negative' : 'neutral' }
}

export const TONE_CLASS: Record<BalanceTone, string> = {
  positive: 'text-positive-dim',
  negative: 'text-negative-dim',
  neutral: 'text-fg',
}
