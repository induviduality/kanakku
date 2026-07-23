# Dashboard Value, Reports Direction, and the Savings-Rate Model — 2026-07-12

Three connected asks: (A) what the dashboard should actually show, (B) what the Reports
section should become, (C) how to model *your* definition of savings rate — salary →
investments vs spare cash — which today's `(income − expense) / income` does not measure.

---

## A. Dashboard — from "status display" to "answers"

### Why it feels low-value today

The current dashboard (TDD FR-14.1 implemented faithfully) is a **status display**: ten
widgets that each restate a table. None of them answer a question you'd act on. Concretely:

- Inflow/Outflow/Savings-Rate tiles are period totals with no reference point — ₹42,000
  spent means nothing without "vs your usual" or "vs where you should be mid-month".
- The per-account running-balance chart (`cashflow_by_account`) is the most expensive
  widget on the page and answers a question you never ask daily ("what was each account's
  balance trajectory?"). Its sibling `cashflow_buckets` is computed server-side on every
  load and **never rendered at all** — as are `category_breakdown`,
  `active_subscriptions`, and `pending_splits_from_others` (bugs #12/June M7). Half the
  dashboard's cost produces nothing.
- Everything is period-scoped except Pending Splits, with no visual signal of which is which.

The test each widget must pass: **what decision or action does this change today?**

### Keep / fix / kill / add

| Widget | Verdict | Why |
|---|---|---|
| Total Balance tile | **Split** into Cash / Owed / Net worth (05-credit-cards §4) | "Balance across all accounts" silently nets card debt; three numbers are three answers |
| Inflow / Outflow tiles | **Fix**: add comparison | Show Δ vs previous period and vs 3-month median — the number alone is noise |
| Savings Rate tile | **Replace** with the §C model (Invested / Spare) | Current metric measures "didn't spend", not saving |
| Budgets summary | **Fix** | Use each budget's own cycle window (`_current_period_window`), not the dashboard period — "This year" view currently shows a monthly budget 8× over (02-ux §5); and fix the income-counted-as-spend bug (#13) |
| Recent transactions | **Keep**, make rows clickable (drawer) | It's the daily sanity check |
| Savings-goal rings | **Keep** (after piggy-drift bug #4 fix) | Fine as-is |
| Pending splits by payee | **Keep**, label "all time", add per-payee link | Right data, unlabeled scope |
| Per-account running-balance chart | **Kill** (or demote to Reports) | High cost, low daily value, historically confusing |
| `cashflow_buckets` (computed, unrendered) | **Use it**: simple income-vs-expense bars per week/month | The at-a-glance trend the running-balance chart failed to be |
| Category breakdown (built, unmounted) | **Mount** top-5 with Δ vs last period | The single most-expected finance visual |
| Active subscriptions (built, unmounted) | **Mount** as "Upcoming bills — next 14 days" | `next_billing_date` + status are already computed server-side |

### Add — the two widgets that earn the page

**1. Needs Attention (the actionable inbox).** Kanakku is a maintenance app — imports to
review, rows to categorize, splits to settle. Nothing surfaces that work today; you have
to remember to go look. One card, each line a count + deep link, hidden when zero:

- *N import records pending review* → `/imports/{batch}`
- *N uncategorized transactions this period* → `/transactions?category_id=none` (needs a
  small "uncategorized" filter — worth adding for this alone)
- *N unsettled split shares older than 30 days* → `/splits/pending`
- *N budgets over 100 %* → `/budgets`
- *N bills due in 7 days* → `/subscriptions`

This is the widget that makes opening the dashboard *do* something. All five counts are
cheap single queries.

**2. Salary allocation bar** — see §C; it is the visual embodiment of the savings model.

### Proposed layout (top = highest daily value)

```
┌───────────────────────────────────────────────────────────────┐
│ HERO: Spent this period ₹42,300   pace: ▲8% vs usual by day 12│
│ Cash ₹1,84,000 · Owed to you ₹6,500 · Net worth ₹9,12,400     │
├──────────────────────────┬────────────────────────────────────┤
│ Needs attention (5)      │ Budgets (cycle-scoped)             │
├──────────────────────────┼────────────────────────────────────┤
│ Salary allocation        │ Top categories + Δ vs last period  │
│ [spent|invested|spare]   │                                    │
├──────────────────────────┼────────────────────────────────────┤
│ Recent transactions      │ Upcoming bills · Goals rings       │
├──────────────────────────┴────────────────────────────────────┤
│ Income vs expense trend (12 buckets, from cashflow_buckets)   │
└───────────────────────────────────────────────────────────────┘
```

"Pace" = spent-so-far ÷ (median spend of last 3 same-periods × fraction-of-period-elapsed).
One extra aggregate query; it converts the Outflow tile from trivia into an early warning.

---

## B. Reports — curate the 90 %, keep SQL for the 10 %

The TDD deliberately made Reports a SQL surface ("query your data however you want, not be
limited by canned reports" — tdd.md §1). That's the right *escape hatch* and the wrong
*front door*: the two things you say you anticipate — category-wise tracking and budget
fulfillment — shouldn't require writing SQL every month. Both already exist as starter
queries, which is the tell: **a starter query used every period is a missing built-in
report.**

Recommend a `Reports` landing page with five curated, parameterized reports (period picker
applies), and "Custom dashboards (SQL)" as the last tab — unchanged, for everything else:

1. **Categories over time** — stacked monthly bars + a MoM table (category, this month,
   last month, Δ, 6-month sparkline), click-through to the filtered transactions list.
   Uses the FR-7.9 net view — consistent with the dashboard.
2. **Budget fulfillment** — per budget, the last 6 cycles as paired budget-vs-actual bars
   with fulfillment % and a hit-rate ("stayed under 4 of last 6"). Backend: `expand_budget`
   already enumerates cycle windows; this is one loop over it with the (single,
   consolidated — 03-architecture §2) spent function.
3. **Salary & savings** — the §C model over time: invested-rate trend, spare-cash trend,
   salary vs total outflow. This is the report version of the allocation bar.
4. **Spending classification quadrant** — planned/unplanned × essential/discretionary.
   You capture `spending_classification` on every expense **and nothing ever reads it**
   (grep-verified: form-only). A 2×2 with % of spend per quadrant + trend of the
   "unplanned discretionary" cell is the most personal, most behavior-changing report this
   app could have, and it's unique to Kanakku — Splitwise/YNAB have nothing like it.
   Include an "unclassified" bucket so it also nudges data hygiene.
5. **Payees** — top payees by net spend, with per-payee trend and last-transaction date.

Implementation shape: these are plain endpoints + chart pages (no widget grid, no SQL
round-trip), so they stay fast and get the same period-context wiring as the dashboard.
The existing SQL widget system remains untouched underneath. (Nav discoverability
prerequisite: bug #11 — Reports currently isn't reachable on desktop at all.)

---

## C. Modeling *your* savings rate: salary → invested vs spare

### The gap, stated precisely

You defined savings as: **out of my salary, how much did I deliberately move into
investments, and how much spare cash was left over.** The current metric
`(inflow − outflow) / inflow` measures neither — it's a "didn't-spend rate" that (a)
treats all income as salary, (b) can't see investments at all (there is no way to record
one: an investment isn't an expense, and transfers require a destination *account*), and
(c) conflates "invested deliberately" with "left lying in savings".

### The model (three definitions, one new enum value)

**1. `AccountType.investment`** — a new asset account type ("Zerodha", "PPF", "NPS",
"Mutual funds"). Money you still own, held elsewhere. This is the only schema change
(additive enum migration — safe, unlike 0029's removal).

**2. Salary** — income transactions carrying the salary marker. Two workable markers,
pick one (flagged, not assumed):
   - *Category "Salary"* + a `UserSettings.salary_category_id` pointer — zero schema
     beyond the settings column, works with import-review categorization; or
   - *`Payee.is_employer` flag* — crisper semantics, one more migration.
   I lean category: you already categorize at review time, and it keeps "what counts as
   salary" visible and editable in normal UI.

**3. The period math** (all existing machinery — FR-7.9 net expense, transfer legs):

```
salary(P)       = Σ income in P where category = Salary
other_income(P) = Σ income in P (non-settlement, per FR-7.10) − salary(P)
invested(P)     = Σ transfers → investment accounts
                − Σ transfers ← investment accounts   (redemptions net out)
spent(P)        = net expense per FR-7.9 (already computed)
spare(P)        = salary(P) − spent(P) − invested(P)

invested_rate   = invested / salary      ← your "savings rate"
spend_rate      = spent / salary
spare_rate      = spare / salary         (the three sum to 100% of salary)
```

`spare` is "salary that stayed in the bank" — your buffer growth. It can be negative
(spent more than salary → dipped into buffer), which is exactly the signal you want, so
don't clamp it; render it as "− ₹X from buffer".

**The widget**: one 100 %-stacked horizontal bar of this period's salary —
`[ Spent ██████ | Invested ████ | Spare ██ ]` — with the three ₹ figures and rates
beneath, and other_income shown as a separate one-liner ("+ ₹2,100 other income") so the
denominator stays honestly salary-only. This replaces the Savings Rate tile; the trend
version lives in Report 3.

### Interactions with existing concepts (checked against the codebase)

- **Piggy banks are the *purpose* layer; investment accounts are the *location* layer.**
  A transfer into an investment account can also be a piggy-bank contribution — no
  double-count, because `invested()` derives from account type, piggy progress from
  contribution rows. They compose.
- **SIPs**: model as a subscription whose linked transaction is the monthly transfer —
  subscriptions only track billing metadata, so nothing conflicts, and Upcoming Bills will
  then remind you of SIP dates.
- **Dashboard aggregates**: investment accounts should join credit cards in the
  cash-flow-chart exclusion (a brokerage balance isn't liquid cash flow) but stay in net
  worth and account balances — same pattern as D-001's dashboard change.
- **Cost basis only.** The investment account's balance is what you transferred in, not
  market value. That's aligned with the TDD's scope fences (no FX, no external data) and
  worth stating in the decision log so future-you doesn't mistake it for a bug. If market
  value ever matters, a manual "revalue" adjustment transaction is the escape hatch — do
  not build it now.

### Flagged decisions (per your no-assumptions rule)

1. **Salary marker**: category-pointer vs payee flag (above — I lean category).
2. **Loan principal**: an EMI's principal component also increases net worth — does it
   count in `invested_rate`? Recommend **no** for v1 (keep "invested" = deliberate
   transfers to investment accounts; EMIs are already visible as expenses/transfers), but
   it's a philosophy call.
3. **Non-salary months** (bonus month, no-salary month): the rates divide by zero or
   spike. Recommend the widget falls back to "no salary recorded this period" and the
   yearly report uses aggregate salary — but you may prefer a rolling-3-month denominator.
4. **Does `spare` accumulate anywhere?** As defined it's per-period. A running "buffer"
   line (cumulative spare) is one query away if you want it — decide after living with
   the per-period number.

### Implementation sketch (small)

1. Migration `00xx`: add `investment` to the `accounttype` enum; add
   `salary_category_id UUID NULL` to `user_settings` (if the category route is chosen).
2. `Accounts` UI: new type option + icon; exclude from cash-flow chart (one condition
   next to the credit-card exclusion, `dashboard.py:631`).
3. `dashboard.py`: one new helper returning `{salary, other_income, invested, spent,
   spare}` for the period — three aggregate queries, batched per 04-nfr rules.
4. Frontend: allocation-bar component in the stat row; wire Report 3 later.
5. Seed data: one investment account + two SIP transfers + a Salary category, per the
   dev-seed rules in CLAUDE.md.
