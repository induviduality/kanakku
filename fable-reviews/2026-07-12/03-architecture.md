# Architecture Review — 2026-07-12

What's working, what's structurally wrong, and — per your instruction — a section of
decisions I'm **flagging rather than assuming**.

## What's genuinely good (keep doing this)

- **Computed balance (D-002)** is the right call and `services/account_balance.py` is a
  model module: one responsibility, batched, documented with the *why*, boundary semantics
  (`<` vs `<=` for opening_balance) reasoned in-place.
- **The timezone principle (D-003)** is coherent and now consistently applied on the paths
  I traced (period-context → dashboard/budgets/transactions). The comments pointing at the
  decision log are exactly how a solo codebase stays maintainable.
- Cursor pagination on transactions with dual sort-key cursors is correct (tie-broken on
  id both directions).
- The split domain model (multi-expense join, per-share settlement rows, SET-semantics
  forgiveness, derived status) is well-normalized and validated on the create path.
- Soft-delete + Bin + purge worker as a system, `sqlglot` AST-level `user_id` injection in
  reports, dev-seed idempotency rules, and the docs/decision-log discipline are all above
  typical side-project grade.

---

## Structural findings

### 1. The imperative-cache pattern D-002 killed still lives in two places

D-002's insight was: *a maintained value any code path can forget to update will eventually
be forgotten*. Two remaining instances of the same shape:

| Cached value | Writers that update it | Writers that forget it |
|---|---|---|
| `PiggyBank.current_amount` | `piggy_banks.py` add/remove contribution | `transactions.py::_sync_piggy_bank` (every form-linked create/edit), soft-delete of a linked txn, amount edits (bug #4) |
| `ImportBatch.total_confirmed/_rejected` | `confirm_records`, `reject_records` | `patch_record` status changes (duplicate-resolve "Keep existing", bug #15) |

Recommendation: same medicine. `current_amount` → `SUM(contributions JOIN transactions
alive)`; batch counters → `COUNT(records BY status)` (or just return per-status counts in
the batch response). Both are tiny tables; there is no caching case at this scale — your
own D-002 rationale applies verbatim.

### 2. "Budget spent" has three implementations that disagree

- `dashboard.py::_budgets_summary` — no type filter (counts income/transfers, bug #13),
  raw amounts, dashboard-period window.
- `budgets.py::_compute_current_spent` — expense-only, raw amounts, explicit-window or
  budget-cycle window.
- `budgets.py::list_budget_transactions` — expense-only totals but *returns* all types in
  items.

One number rendered in three places should be one function. Move a single
`compute_budget_spent(budget, window)` into a service module (there's already a
`services/` layer) and call it from all three; the dashboard variant then inherits the
type filter for free.

### 3. Guards enforced on one path, skipped on siblings

A recurring shape, worth a systemic answer rather than three patches:

- opening_balance uniqueness + liability rule: enforced on `POST /transactions`; skipped by
  import confirm, `PATCH /transactions` retype, and `create_account` seeding (bugs #5, #14).
- Split invariant: validated on split create/update/bundle; silently violable by deleting
  a linked transaction (bug #17).
- `PaymentMethodCreate`'s upi validation was accidentally deleted by an unrelated commit
  and restored a day later (completed.md 2026-07-11 cont. 6) — same failure mode: rules
  living only in router code are fragile.

The project principle says "constraints enforced at both application AND database level" —
the DB half is missing for exactly these: no partial unique index for opening_balance
(one-per-account), no trigger/constraint tying split expense sums to shares (there *is* a
trigger updating on split_expenses — but transaction soft-delete bypasses it), no check
blocking opening_balance on liability accounts (needs a trigger or app-level single choke
point). Cheapest systemic fix: route every Transaction construction through one factory
(`services/transaction_service.create()`) that owns the guards — import, router, and
account-create all call it — plus the one partial unique index.

### 4. `list_transactions` response assembly is an N+1 ×6

`_to_response` issues six queries per transaction (categories, tags, budgets, piggy, pm
name, split id) — a 100-row page is ~600 sequential awaits. This is the app's hottest
endpoint (transactions list + every picker + drawers). Details and fix sketch in
[04-nfr-performance.md](04-nfr-performance.md) §1. Architecturally: response assembly
belongs in one batched builder, not per-row helpers.

### 5. Milestone 9 (LLM) is scaffolding with no consumer

`llm/` (base, ollama client, factory, logging decorator, activity log, settings page) is
complete and tested — and `suggest_category` / the factory are called by **zero** routers
or workers (grep confirms). The GPay matcher that consumed `match_gpay_to_bank` was removed.
Today the Settings → LLM Activity page can only ever show an empty list. Either wire
`suggest_category` into import review (the natural consumer, see 02-ux §3) or delete the
stack until the feature is real; shipping the config surface (`LLM_BACKEND`, Ollama env
vars, activity page) with no behavior behind it is a trap for future-you.

### 6. Settings that don't do anything

`UserSettings` carries `date_format`, `number_format`, `primary_currency`, `timezone`.
Today: `timezone` is read by exactly one code path (PDF import date localization),
`primary_currency` by account creation default; `date_format`/`number_format` by nothing —
the frontend hardcodes `en-IN` locale strings in ~20 places. Either honor them via a
central formatting util or remove them from the Settings form; a settings page that
doesn't change behavior erodes trust in the whole page.

### 7. Frontend state: URL vs context split is right, but unfinished

Transactions correctly treats the URL as source of truth for filters/sort/pagination.
The other half of load-bearing state — the global period — is ephemeral React state that
resets on reload (June M13). Persist `PeriodSelection` (localStorage is fine for a
single-user app) and the two systems become consistent.

### 8. Dead code inventory

Confirmed unreferenced (outside their own tests): `components/AuthGuard.tsx` (should be
*used*, bug #9), `api/transactions.ts::useInfiniteTransactions`,
`components/dashboard/CategoryBreakdownChart.tsx` (should be *mounted*, June M7),
`components/dashboard/SubscriptionStatusBadge.tsx`, `DashboardResponse.
pending_splits_from_others` (computed server-side every dashboard load, never rendered).
Each is either wire-in or delete; none should stay limbo.

---

## Flagged for your decision (not assumed)

These are genuine forks where I can argue both sides; the code currently sits on one side
*implicitly*, which is the worst place to be.

1. **Should budget spend use FR-7.9 net amounts?** Dashboard totals and category breakdown
   use the net-amount view (own share + forgiven); budget spend uses raw expense amounts.
   A ₹4k split dinner where your share is ₹1k currently consumes ₹4k of the "Eating out"
   budget. Consistency argues for net; "budgets track cash out the door" argues for raw.
   Pick one and document it in the decision log — right now it looks accidental.

2. **Should refunds reduce budget spend?** After fixing bug #13 (income counted as spend),
   the natural follow-up: an income transaction categorized "Groceries" — ignore it (spend
   only) or subtract it (net category flow)? Most tools subtract; your call.

3. **Split delete/restore semantics** (bug #18): keep splits out of the Bin and make
   delete hard (honest, simple), or make children soft-delete and support restore. The
   current hybrid is the only wrong option. Also: purge worker coverage for splits and
   payment_methods either way.

4. **`Account.opening_balance` column vs opening-balance transaction.** Post-D-002 there
   are still two representations: the column (display-only, set at create, editable via
   PATCH with no ledger effect — confusing) and the ledger transaction (authoritative).
   Phase 2 (dropping `current_balance`) should probably also either drop
   `opening_balance` or make it a read-model of the ledger row. Also note the ledger
   seed is stamped `now()` — see flag 5.

5. **Opening balance needs a date (and possibly a sign).** UI account creation dates the
   seed at creation time, so historical periods show ₹0 for that account; and liability
   accounts can't be seeded at all (guard), meaning an existing credit-card debt cannot be
   represented — this interacts with the credit-card design, see
   [05-credit-cards…](05-credit-cards-and-payment-methods.md) §5. Decide: opening-balance
   date input at account creation + allow negative/liability seeds?

6. **Categories: single vs multi.** Schema is many-to-many; UI enforces single-select. If
   single is the real model, a DB uniqueness (one row per transaction) would honor the
   both-levels principle; if multi is intended, the form should expose it. Current state
   half-implements both.

7. **Browser timezone vs `UserSettings.timezone`.** D-003 trusts the browser's local time
   for all UI-originated instants; `UserSettings.timezone` (IST) is used only for PDF
   imports. If you ever open Kanakku while traveling, period boundaries follow the hotel's
   timezone, not IST — and imported vs manual transactions can land in different "days".
   Options: (a) accept it (document), (b) make the frontend compute boundaries in the
   *configured* timezone. (a) is fine for a home-server app; just choose it consciously.

8. **`transaction_budgets.budget_id` FK** — the SQLAlchemy table (`models/transaction.py:68-83`)
   still has no FK with a comment saying M5's migration would add it. **Verify** the
   migration actually did; if not, budget deletion can orphan link rows silently.

9. **Refresh-token in localStorage.** Standard tradeoff: convenient, XSS-stealable. For a
   self-hosted single-user app behind Tailscale it's defensible; an httpOnly cookie flow
   would be strictly safer but complicates the PWA. Flagging, not prescribing.

10. **`/reports/query` write-safety depends on sqlglot + a read-only transaction.**
    Defense-in-depth would run it on the `app_readonly` role connection (migration 0017
    created the role; **verify** `READONLY_DATABASE_URL` is actually set in prod compose —
    `config.py:13` silently falls back to the read-write URL).
