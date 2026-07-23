# Credit Cards & Payment Methods — Design Recommendation — 2026-07-12

Your ask: how to model credit cards within the existing system, keep payment methods
sensible, **no credit-limit tracking** — just expense visibility. Short answer up front:

> **The D-001 model — card = liability account, no nested payment method — is correct.
> Keep it.** What's missing isn't modeling; it's (a) closing three enforcement holes,
> (b) defining the canonical usage pattern in writing, and (c) making liability balances
> *readable* in the UI. Plus one real gap: you currently cannot seed an existing card's
> outstanding debt at all.

## 1. What exists today (verified)

- `AccountType.credit_card` — a first-class account (`models/account.py:12-17`).
- Payment methods (`debit_card`/`netbanking`/`upi`) hang off accounts; the UI hides the
  payment-methods panel for credit-card accounts (D-001, migration 0029).
- `opening_balance` is forbidden on liability accounts (`transactions.py:259-263`) —
  but only on that one path (bugs #5, #14).
- Dashboard: credit-card accounts are excluded from the cash-flow chart, included in
  `account_balances` and the "Total Balance" sum (`dashboard.py:625-634, 786`).
- With computed balances (D-002), a credit-card account's balance = −(expenses) +
  (transfers in) + (income/refunds): **a negative number whose magnitude is the amount
  owed**. This falls out of the ledger for free and is exactly right.

## 2. The canonical usage pattern (recommend documenting this in docs/decisions/log.md)

Two event types cover the entire credit-card lifecycle with **zero new schema**:

1. **Spending on the card** → `expense` transaction, `account_id = the card`.
   This is when the expense economically happens, so budgets, category breakdowns, and
   FR-7.9 net-expense all count it at swipe time — the correct semantics.
2. **Paying the bill** → `transfer` from the bank account to the card account.
   Not an expense (the expense already happened at swipe); dashboards already exclude
   transfers from spend totals, so **nothing double-counts**. The card balance moves
   toward zero; the bank balance drops. Partial payments, overpayments, multiple payments
   per cycle — all just transfers, no special cases.
3. **Refunds/cashback** → `income` on the card account (see flagged question §6.3).

I verified both flows against `compute_balances` and the dashboard aggregates: totals stay
correct, no double-count, no exclusion needed anywhere. This pattern should be written
down as the doctrine, because it's currently only implicit — and the import flow lets you
violate it (see §3).

## 3. Holes to close (these are bugs, listed in 01-bugs, summarized here)

1. **Statement imports into a card account can create `opening_balance` rows** the model
   forbids (bug #5). Once the shared guard exists (03-architecture §3), a card-statement
   import with a header balance should either be rejected or handled per §5 below.
2. **`create_account` seeds opening-balance on cards** (bug #14) — the Accounts form should
   hide the opening-balance field for `credit_card`/`loan` until §5 is decided.
3. **Bill payments imported from the *bank* statement arrive as expenses.** A card bill
   paid via netbanking shows up in the bank PDF as a debit → imported as `expense` → the
   spend is now counted twice (once at swipe on the card, once at payment from the bank).
   The import review type dropdown doesn't even offer `transfer`
   (`ImportReview.tsx:315-333`). Minimum fix: allow retyping a record to `transfer` with a
   destination account picker at review time. Better: a dedup/matching hint — an imported
   bank debit whose amount matches a recent card-account credit is probably the bill
   payment ("Link as transfer to HDFC Credit Card?"). This is the most consequential gap
   in the whole credit-card story: without it, every monthly bill inflates expenses.

## 4. Display: make liability balances readable (UX, no schema)

- Account cards/drawer: for liability accounts, render `abs(balance)` with a "due" frame —
  **"₹12,450 due"** in negative color, or "₹0 · cleared" — instead of a bare `-₹12,450`.
  A positive card balance (overpayment/refund credit) reads "₹500 credit".
- Dashboard "Total Balance … across all accounts" currently nets card debt against cash
  silently. Recommend splitting the hero into what it already almost is:
  **Cash** (sum of bank+cash accounts), **Owed** (sum of liability magnitudes), and let
  "Net worth" be the netted figure. One card, three numbers — no backend change, the
  per-account data is already in `account_balances` with `type`.
- Cash-flow chart already excludes cards (right call, D-001). Consider a small dedicated
  "Card spend this period" stat (sum of expenses where account.type=credit_card) — that's
  the "just my expenses on that front" visibility you asked for, and it's a single
  aggregate query.

## 5. The real modeling gap: seeding existing card debt

You cannot currently represent "I already owe ₹8,000 on this card when I start using
Kanakku": `opening_balance` is banned on liability accounts, amounts must be > 0, and
`compute_balances` treats opening_balance as a credit. Workarounds today are all ugly
(fake expense named "opening debt"). Two clean options — **flagging, not assuming**:

- **(a) Allow `opening_balance` on liability accounts, treated as a debit** in
  `compute_balances` (sign flips by account type). Keeps one seeding concept; slightly
  magical sign behavior.
- **(b) Keep the ban; seed via a documented convention** — an `expense` on the card dated
  before your tracking epoch, auto-created by account setup when type=credit_card and
  "current outstanding" is filled. No sign magic; slightly pollutes category reports
  (mitigable with a reserved "Opening debt" category excluded like opening_balance).

I lean (a) — it matches "opening_balance seeds an account's starting state" conceptually,
and the sign rule is one `case` expression in `compute_balances` — but it touches the
spec's "opening_balance excluded from all reports" wording, so it's your call. Whichever
you pick also resolves 03-architecture flag 5 (opening-balance date input) for cards.

## 6. Flagged decisions (don't build until you choose)

1. **Statement-cycle metadata.** You said no credit-limit tracking — agreed. But two tiny
   nullable fields on `Account` (`statement_day`, `payment_due_day`) would let the UI show
   "bill due 15th" on the card and power an "Upcoming bills" card alongside subscriptions.
   Zero tracking burden, purely display. Want it, or is the PDF-import ritual enough of a
   cycle marker? (Alternative some tools use — model the card bill as a variable-amount
   subscription — is a poor fit; don't.)
2. **UPI-on-credit (RuPay cards).** Payment methods are currently hidden for card
   accounts. If you ever route UPI through a RuPay credit card, you'd want a `upi` payment
   method attached to a credit-card account — the D-001 rationale ("the account IS the
   method") holds for swipes but not for distinguishing UPI-handle spends. If this isn't
   your situation, keep the panel hidden; if it is, the only change is removing the
   frontend hide (`Accounts.tsx:242`), the schema already allows it.
3. **Refund semantics on cards.** An `income` on the card account is counted as income in
   dashboard totals. For cashback that's arguably right; for a returned purchase it
   overstates both income and (historically) expense. Options: leave it (simple), or
   introduce a convention (refund = income linked to same category, netted in category
   view — heavier). Recommend leaving it and revisiting only if it bothers you in reports.
4. **Interest/fees** — just expenses on the card account with a "Fees & interest"
   category. No modeling needed; noting so it's a decided non-feature.

## 7. Payment methods — maintenance recommendations (bank accounts)

The payment-method model itself is fine post-D-001. Small items:

- `TransactionForm` offers deleted-filtered but **not** `is_active`-filtered methods
  (bug #34) — respect the toggle you built.
- Payment method is never auto-selected; for accounts with one active method, preselect
  it; otherwise remember last-used per account (`localStorage` is fine).
- Payment-method delete copy still says "cannot be undone immediately" (June L12) while
  the model soft-deletes; payment methods are also absent from Bin/purge — align with
  whatever you decide in 03-architecture flag 3.
- Analytics idea (cheap, later): spend by payment method per period — the FK is already on
  transactions; it's one group-by away if you ever want "how much goes via UPI".
