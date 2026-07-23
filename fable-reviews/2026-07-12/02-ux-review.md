# UX Review — Journey by Journey — 2026-07-12

Frame: Kanakku's stated purpose is (1) seamless transaction import/entry, (2) splitting
with friends, (3) budgets and goals. I walked each journey as the user. Functional bugs
found along the way live in [01-bugs.md](01-bugs.md); this file is about friction even when
everything "works". Ordered by how often the journey happens: daily → monthly → occasional.

---

## 1. Getting around (every session)

**Desktop cannot reach Settings, Reports, Subscriptions; mobile cannot reach Splits or
Disputes** (bug #11) — this is the single worst UX issue in the app because it makes whole
milestones invisible. Beyond the fix, two structural suggestions:

- SideNav has 12 flat items and is about to have 15. Group it: *Money* (Dashboard,
  Transactions, Accounts, Splits), *Planning* (Budgets, Goals, Subscriptions, Reports),
  *Data* (Import, Disputes, Bin), *Settings* pinned at the bottom with a user/logout row.
  A bottom-anchored Settings + logout row is the conventional place users look first.
- Naming is inconsistent per viewport: "Savings Goals" (SideNav) vs "Piggy Banks"
  (MobileNav More) vs "Import" vs "Imports". Pick one vocabulary; users build a mental
  map from these words.

**Period picker** (`components/nav/PeriodPicker.tsx`):
- No **"All time"** mode. Every list in the app is period-filtered through this control, so
  there is literally no way to see all transactions, all splits, or year-over-year data in
  one view. Add All-time and a couple of quick presets (This month / Last month / Last 90
  days) above the mode dropdown — most sessions need exactly those three.
- Selection resets to "this month" on every reload (June M13, still open). Persist to
  localStorage or the URL; the period is the most load-bearing state in the app.
- After changing the mode dropdown to "Custom range" the popover stays open until both
  dates are picked — good — but there's no way to see the currently-applied *full* range
  label anywhere except the tiny trigger; consider echoing `label` inside the popover.

**Session trust**: no logout (bug #10), no redirect on mid-session expiry (bug #9), and
silent mutation failures (bug #12) compound into "the app sometimes just stops working".
For a finance app, feedback-on-failure is a trust feature, not polish.

---

## 2. Entering a transaction (daily)

The form itself (`components/forms/TransactionForm.tsx`) is complete and pleasantly
compact, with inline-create for payee/category/tags. The friction is around it:

- **No quick-add loop.** Entering 5 receipts = 5× (navigate → fill → save → auto-back →
  navigate again). Add "Save & add another" that keeps date/account and clears the rest.
  This is the cheapest big win for the entry journey.
- **No memory of context.** Account, currency, and classification start blank every time.
  Default account = last used (or a `UserSettings.default_account_id`); currency already
  defaults from the account server-side — hide the free-text currency field unless the
  user opts into multi-currency (it's a data-quality hazard, June M11).
- **No transaction search.** The backend supports `q` (description ILIKE) — added for the
  TransactionPicker — but the Transactions page never exposes it. A search box next to
  Filters is nearly free and transforms the page.
- **No bulk operations.** The old selection bar went away with BundleAsSplitModal. After a
  PDF import lands 100 uncategorized rows, categorizing them one-by-one via the edit page
  is the app's biggest chore. Bring back row selection with: bulk categorize, bulk tag,
  bulk delete. (See §3 — categorize-at-import would reduce the need, but bulk-edit is
  still the escape hatch.)
- **Edit URL is `/transactions/new?editId=…`** — works, but "new" in the URL for an edit is
  confusing in history/bookmarks, and `history.back()` assumptions break deep links
  (bug #33). A `/transactions/$id/edit` route matches the rest of the app's conventions.
- Amount field: no autofocus; on mobile the first tap should land in Amount with the
  numeric keyboard up.
- The **savings-goal selector currently doesn't do anything visible** (bug #4 — progress
  never moves), which quietly teaches users the feature is decorative.
- MultiSelect in Filters (`Transactions.tsx:53-117`) has no search input; with 40 payees
  it's a scroll wall. The Autocomplete component already exists — reuse it.

---

## 3. Importing a statement (monthly ritual)

Upload → poll → review is a good pipeline shape, and the duplicate-resolution modal is
genuinely well designed (clear imported-vs-existing panels, explicit consequences per
action). The review table is where the ritual drags:

- **You can't fix a parsed date.** Inline edit covers description/amount/type only
  (`ImportReview.tsx:229-237`). Date is the field PDF parsers get wrong most; today the
  only remedy is reject + manual re-entry. Add date to the row editor.
- **You can't assign payee or category at review time**, so every import lands as
  uncategorized rows with raw bank descriptions ("UPI-SWIGGY8763399-…"), pushing all
  categorization into the weakest part of the app (per-row edit). The highest-leverage
  import feature you could build: a payee/category column in review with per-row
  autocomplete + "apply to all matching descriptions". This is also where the dormant LLM
  client belongs (see 03-architecture §5): `suggest_category` per record with a one-click
  accept. That was the original M9 promise.
- **A failed batch shows no reason.** `ImportBatch` has no error field; the UI shows a red
  "failed" chip and nothing else. Persist the parse exception message and show it —
  "password incorrect" vs "no tables found" changes what the user does next.
- Tab counts: the Pending/Confirmed/Rejected/Duplicate tabs don't show counts, so you
  click each to know whether you're done. The batch header has the numbers; put them on
  the tabs.
- "Force confirm all" force-confirms *the selection* when one exists — label lies
  (`ImportReview.tsx:527-536`). And empty-selection Reject nukes everything (bug #25).
- Account selection: `ImportUpload` marks account optional, then review nags you to pick
  one. Since ~100% of statements belong to one account, make it required at upload (or
  remember the last account per filename pattern — "HDFC-*.pdf → HDFC Savings").
- Upload auth uses the raw access token with no refresh-retry (`api/imports.ts:114-121`):
  leave the tab open overnight, upload, get a generic "Upload failed". Route through the
  authed client or retry-on-401.

---

## 4. Splits with friends (the differentiating feature)

The split data model (multi-expense, per-share settlements, partial forgiveness) is more
capable than Splitwise's; the UX undersells it:

- **Pending splits vanish by period** (bug #8) — the core ledger question "who owes me
  money right now?" has no reliable answer screen. Fix first.
- **No per-friend view.** The dashboard's by-payee totals are the seed of the right idea;
  there's no page where I click "Rahul" and see every split he's in, net position, and
  settle-up actions. `PayeeDrawer` is the natural host (add a "Splits" section).
- **Settling requires the income transaction to already exist.** The settle flow links an
  *existing* income transaction; when a friend GPays you ₹500, the natural gesture is
  "record repayment" in the split itself — creating the income transaction (right account,
  payee, description prefilled) and linking it in one step. Today it's two apps' worth of
  navigation.
- **Forgiveness is invisible in the edit form** (and gets wiped — bug #3). Even after the
  data-loss fix, show a read-only "forgiven ₹X" per share in edit mode so the state is
  legible.
- Split cards title from `notes ?? 'Split expense'` — with notes unset, every card reads
  "Split expense". Fall back to the first expense's description (SplitForm already has
  `txnLabel` for exactly this).
- The drawer's share rows are good (expand → settle/forgive/edit inline). One trap: the
  header Edit pencil swaps the whole drawer into the recreate-form (with bug #3's data
  loss); once fixed, consider renaming the per-share "Edit" vs header "Edit split" so the
  destructive scope is clear.

---

## 5. Budgets & goals (weekly glance)

- **Budget "spent" means three different things** depending on where you look (dashboard
  summary vs list vs drawer — bug #13 / architecture §2). The user experiences this as
  "the numbers don't match", which is fatal for a budgeting feature. One implementation,
  one number.
- The dashboard budget card measures spend over the *dashboard's* selected period, not the
  budget's own cycle. Selecting "This year" makes a monthly ₹10k budget show 8× over
  budget. Budget progress should always be against the budget's current cycle window
  (`_current_period_window` exists and does this correctly — use it in the dashboard
  summary too).
- Piggy-bank contribution from the goal page requires pasting a transaction UUID (June
  M10) — the TransactionPicker component exists now; drop it in.
- Goal progress drift (bug #4) plus no contribution history on the drawer for
  form-linked contributions makes goals feel unreliable.
- Budgets page create modal vs `/budgets/new` page vs `/budgets/$id/edit` page: three
  different editors with slightly different fields. Consolidate on one.

---

## 6. Dashboard (first screen, sets expectations)

- **Spending by category is fetched but never shown** (June M7, still open) — the single
  most-expected personal-finance visual. `CategoryBreakdownChart` is built and tested;
  mount it (Row 2 or 3).
- `active_subscriptions` and `pending_splits_from_others` are also fetched-and-dropped.
  Either render (an "Upcoming bills" card is genuinely useful — next billing dates are
  already computed server-side) or stop paying for them in the dashboard query.
- "Total Balance … across all accounts" nets credit-card debt against bank balances
  without saying so — that's net worth, not balance. See
  [05-credit-cards…](05-credit-cards-and-payment-methods.md) §4 for the recommended
  split into Cash / Owed / Net worth.
- Pending Splits panel is all-time while every neighboring card is period-scoped —
  correct behavior (debts are timeless), but label it ("Pending Splits — all time") so it
  doesn't read as a bug next to a period-scoped page.
- Recent Transactions rows aren't clickable (no drawer, no link to the transaction). Every
  other list in the app opens a drawer on click; this one should too.

---

## 7. Small consistency debt (rolled up)

- Currency display: dashboard stat cards use `Intl` INR formatting; most list pages
  hardcode `₹`; Budgets shows ₹ regardless of the budget's stored currency (June M11).
  One `formatMoney(amount, currency)` util, used everywhere, ends this class.
- Confirm dialogs: `ConfirmDialog` still has no pending state (June H7) — double-click
  fires double DELETE; and Reports/widget deletion has no confirm at all (June L6).
- Breadcrumb leaf on detail pages is the literal word "Details" (June L5).
- Empty states are good and consistent (`EmptyState`) — extend the pattern to report
  widgets (June L9).
- Keyboard: password reveal unreachable (June L1); drawers trap focus correctly via Radix;
  the Splits card row is keyboard-activatable (good) but the Transactions table rows are
  not (`<tr onClick>` with no key handler or tabIndex).
