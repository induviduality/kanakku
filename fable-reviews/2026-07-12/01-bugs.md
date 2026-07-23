# Confirmed Bugs — 2026-07-12

Severity: **Critical** (feature outright broken / financial data corrupted) · **High**
(wrong data or blocked core flow) · **Medium** (wrong under realistic conditions) ·
**Low** (edge case / polish). Line numbers are from the working tree at `1f9bf34`.

---

## Critical

### 1. Archive import always sends an empty bearer token — feature broken
`frontend/src/api/portability.ts:41`

`Authorization: Bearer ${localStorage.getItem('access_token') ?? ''}` — the access token
lives in memory only (`lib/auth-storage.ts:2`); nothing is ever stored under that
localStorage key. Every archive import request 401s. This was **H1 in the 2026-06-21
review**; the fix that landed (`api/imports.ts` `useUploadPdf`, noted in completed.md)
patched the *PDF upload*, not this file. Fix: use `getAccessToken()`, or better, route the
FormData request through a shared authed-fetch helper so the 401→refresh retry applies.

### 2. Export "Download Archive" link cannot authenticate — feature broken
`frontend/src/pages/SettingsDataExport.tsx:42-49`

Plain `<a href="/api/v1/export/{id}/download" download>` — a native anchor navigation sends
no `Authorization` header and there are no auth cookies, so the download 401s after the
export succeeds. (H2 from June, unfixed.) Fix: fetch the blob with the token and trigger a
client-side download, or issue a short-lived signed URL from the backend.

---

## High

### 3. ✅ FIXED (2026-07-23) — Editing a split silently destroys forgiveness and partial-payment amounts
Frontend: `frontend/src/components/SplitForm.tsx:235-266` — Backend: `backend/app/routers/splits.py:457,485-493`

`PUT /splits/{id}` is delete-and-recreate. Two data-loss paths, both confirmed:

- **Forgiveness wiped**: `SplitShareCreate` supports `forgiven_amount`, but `SplitForm`'s
  `handleSubmit` never includes it (and the edit form doesn't even display forgiveness).
  Backend then does `forgiven = s.forgiven_amount or 0` → every previously-forgiven amount
  resets to zero. A share that was "settled" via partial-pay + forgive flips back to
  pending, and FR-7.9 net-expense figures change retroactively.
- **Partial settlements inflated to full**: on recreate, settlements are inserted with
  `amount=t.amount` (the income transaction's full amount, `splits.py:491`), discarding the
  partial `amount` the user chose in the settle flow. `paid_amount` silently grows.

Fix: SplitForm must carry `forgiven_amount` per share and show it in edit mode; the backend
should accept per-settlement amounts on PUT (or diff instead of recreate).

### 4. ✅ FIXED (2026-07-23) — Savings-goal progress never moves when linked from the transaction form — D-002 bug class, second instance
`backend/app/routers/transactions.py:182-206` vs `backend/app/routers/piggy_banks.py:202,228`

`PiggyBank.current_amount` is an imperatively-maintained cache. The piggy-bank router's own
add/remove-contribution endpoints update it — but `_sync_piggy_bank` (used by **every
transaction create/edit** with a `piggy_bank_id`, i.e. the path the TransactionForm's
"Savings Goal" selector uses) deletes and inserts `PiggyBankContribution` rows **without
touching `current_amount`**. Additional drift paths:

- Soft-deleting a transaction leaves its contribution counted forever.
- Editing a transaction's amount leaves the contribution at the old amount
  (`_sync_piggy_bank` only runs when `piggy_bank_id` itself is in the patch).

This is exactly the class of bug you eliminated for account balances on 2026-07-11
(decisions.md D-002: import path bypassed `apply_balance`). Same fix applies and there is
in-repo precedent: compute `current_amount` as `SUM(contributions JOIN transactions WHERE
deleted_at IS NULL)` on read, drop the column later. `is_completed` should derive from the
same computation.

### 5. Imported `opening_balance` records bypass every opening-balance guard
`backend/app/routers/imports.py:365-412` (`_record_to_transaction`)

`POST /transactions` enforces (a) only one active `opening_balance` per account
(`transactions.py:265-277`) and (b) no `opening_balance` on liability accounts
(`transactions.py:259-263`). The import-confirm path enforces **neither** — it constructs
the `Transaction` directly. Confirming two statements for the same account, each carrying a
synthetic opening-balance record (which the PDF parser emits per statement header), creates
two `opening_balance` rows → `compute_balances` double-counts the seed → the exact
balance-drift symptom you spent 2026-07-11 eradicating. Also note:

- `PATCH /transactions/{id}` can retype any transaction to `opening_balance` with no
  uniqueness check either (`transactions.py:666-672` checks liability only).
- There is **no DB-level constraint** backing the one-per-account rule (checked migration
  `0020_opening_balance_type.py` — no partial unique index), which violates the project's
  own "constraints enforced at both application AND database level" principle. A partial
  unique index `(account_id) WHERE type='opening_balance' AND deleted_at IS NULL` closes
  every path at once.

### 6. ✅ FIXED (2026-07-23) — Import confirm silently skips records it can't parse
`backend/app/routers/imports.py:227-234, 411-412`

`_record_to_transaction` wraps everything in `try/except: return None`, and `confirm_records`
does `if txn is None: continue`. A record with a malformed date or amount (quite possible
after inline editing — the edit UI writes free text into `parsed_json`) is silently left
pending: no error, no toast, no count anywhere. The user selects 40 rows, clicks Confirm,
sees "confirmed" — and 3 rows quietly didn't import. Fix: collect skipped record ids and
return them in the response; surface them in ImportReview.

### 7. ✅ FIXED (2026-07-23) — Split view-all pages still filter by `created_at` — the June fix missed them
`frontend/src/pages/SplitsAll.tsx:113-119,53`

`Splits.tsx` was fixed on 2026-06-21 to period-filter by `split.expense_date`; the
"View all" pages (`/splits/pending`, `/splits/history`) still filter by — and display —
`split.created_at`. A split created in July for June expenses appears in the June main page
but the July view-all page. The comment above the code even describes the local-date
conversion fix while filtering the wrong field.

### 8. ✅ FIXED (2026-07-23) — Unsettled splits are period-scoped in every view — old debts disappear
`frontend/src/pages/Splits.tsx:130-133`, `frontend/src/pages/SplitsAll.tsx:121-124`

The "Unsettled" section *and* the dedicated `/splits/pending` page both filter to the
globally-selected period first. A friend's unpaid share from three months ago is invisible
in every pending view unless you manually navigate the period picker back to the month the
expense happened. For a debt-tracking feature this is the wrong axis: pending is pending
regardless of when the expense occurred. The dashboard "Pending Splits" panel is all-time
(`dashboard.py:426-461`) — so the dashboard says ₹4,000 owed while the Splits page says
"No unsettled splits". Recommendation: make pending views all-time (or "period + older,
grouped"), keep the period filter for the history view only.

### 9. ✅ FIXED (2026-07-23) — Mid-session auth expiry leaves the app silently broken — `AuthGuard` is dead code
`frontend/src/components/AuthGuard.tsx` (never imported), `frontend/src/router.tsx:47-54`, `frontend/src/lib/api-client.ts:35`

Route protection runs only in `beforeLoad` (navigation time). When the refresh token
expires mid-session, `api-client` calls `clearAuth()` — but nothing listens: `AuthGuard`,
which was built precisely to subscribe and bounce to `/login`, is only referenced by its
own test. Combined with #12 below (no global mutation error handler), every subsequent
action fails silently; the user sees frozen data and dead buttons until they happen to
navigate. Fix: mount the guard (or an equivalent subscription) in `AppLayout`.

### 10. ✅ FIXED (2026-07-23) — No logout anywhere — while the backend endpoint sits unused
Backend: `backend/app/routers/auth.py:135` (`POST /auth/logout` exists). Frontend: no caller.

H3 from June, unchanged: no sign-out control in TopNav, SideNav, MobileNav's More sheet, or
Settings. This is now purely a frontend afternoon-task: call the endpoint, `clearAuth()`,
navigate to `/login`.

### 11. Desktop nav has no path to Settings, Reports, or Subscriptions; mobile has none to Splits or Disputes
`frontend/src/components/nav/SideNav.tsx:3-113`, `frontend/src/components/MobileNav.tsx:5-22`

SideNav (the only desktop nav) lists 12 items — Settings, Reports, and Subscriptions are
not among them, and TopNav has no menu. A desktop user literally cannot reach `/settings`,
`/reports`, or `/subscriptions` without typing the URL. Inversely, MobileNav + its More
sheet omit Splits and Disputes entirely. Feature discoverability aside, this makes three
built milestones (Reports M11, Subscriptions M6, LLM-activity/data-portability settings
pages) unreachable in the primary desktop UI.

### 12. Silent failure on create/edit/delete across most list pages — June's H5, still open
`frontend/src/main.tsx:9` (root cause), confirmed zero `onError`/toast usage in
`Payees.tsx`, `Accounts.tsx`, `PiggyBanks.tsx`, `Subscriptions.tsx`, `RecentlyDeleted.tsx`

`new QueryClient()` still has no `MutationCache` `onError`. ImportReview, Categories, and
Disputes now toast correctly — the rest of the app swallows backend errors; modals close
and the user assumes success. One global `MutationCache({ onError: toast })` fixes the
whole class; page-level handlers can then specialize.

---

## Medium

### 13. Dashboard budget summary counts income and transfers as budget spend
`backend/app/routers/dashboard.py:239-272` (`_budgets_summary`)

Neither the explicit-links sum nor the category-match sum filters
`Transaction.type == expense` (compare `budgets.py:193-201`, which does). A refund recorded
as income and categorized "Groceries" **increases** the Groceries budget's spent figure. It
is also the third divergent implementation of "budget spent" (dashboard vs `budgets.py`
list vs `budget drawer`) — see [03-architecture.md](03-architecture.md) §2 for the
consolidation recommendation, and §Flagged for the net-amount question.

### 14. `create_account` seeds opening-balance transactions on credit cards / loans
`backend/app/routers/accounts.py:89-97`, UI: `frontend/src/pages/Accounts.tsx:296-325`

`POST /transactions` forbids `opening_balance` on liability accounts; `create_account`
happily inserts one when a credit-card account is created with a nonzero opening balance —
and the Accounts form shows the opening-balance field for every account type. Same rule,
enforced on one path, skipped on the other. (`PATCH /accounts/{id}` can also flip a `bank`
account holding an opening-balance transaction to `credit_card`, silently violating the
invariant — `accounts.py:132-145` has no type-change validation.)

### 15. Batch counters drift: "Keep existing" never counts as rejected
`frontend/src/pages/ImportReview.tsx:77-85` → `backend/app/routers/imports.py:132-150`

The duplicate-resolve modal's "Keep existing" patches the record's status to `rejected` via
`PATCH /records/{id}` — which does not touch `batch.total_rejected` (only
`POST /reject` does). The batch header's `pending = parsed − confirmed − rejected`
arithmetic (`ImportReview.tsx:438`, `Imports.tsx:58`) then over-reports pending forever,
and the list page's progress bar under-reports completion. Root cause is the imperative
counter pattern (third instance of the D-002 class — see 03-architecture §1); computing
counts from `raw_import_records` by status removes the drift permanently.

### 16. Upload enqueues the parse job before the batch row is committed
`backend/app/routers/imports.py:69-83`

`session.flush()` (not commit) → `enqueue_job(...)` → `session.commit()`. The ARQ worker
can pick the job up before the batch row is visible and fail its batch lookup. It usually
wins the race today because worker polling adds latency, but it's a real ordering bug —
enqueue after commit (and mark the batch `failed` if enqueueing itself fails). Also note the
Redis-down fallback runs the whole PDF parse synchronously inside the request handler.

### 17. Deleting a transaction that belongs to a split has no guard
`backend/app/routers/transactions.py:703-711`

Soft-deleting an expense linked via `split_expenses` (or an income linked as a settlement)
succeeds silently. The split then references a deleted transaction: its total no longer
matches its shares (the invariant is only validated on split mutations), `paid_amount`
counts money whose transaction is gone, and `_load_expense_ids_and_date` happily returns
deleted expenses. Either block with 409 + "unlink from split first" (matching the account
deletion pattern at `accounts.py:148-179`), or cascade-unlink with a warning in the UI.

### 18. Restoring a deleted split is corrupt by construction — and splits aren't purgeable
`backend/app/routers/splits.py:735-772`, `backend/app/routers/recently_deleted.py:69-76`, `backend/app/workers/purge_worker.py:13-20`

`DELETE /splits/{id}` hard-deletes the `SplitExpense` and settlement rows, then soft-deletes
the split. Consequences: (a) any future restore produces a split with shares but zero
expenses — invariant-violating garbage; (b) splits are absent from both the Recently
Deleted UI and the purge worker, so soft-deleted split+share rows accumulate forever. Pick
one: real soft-delete of children + Bin support, or honest hard delete. (Flagged as a
decision in 03-architecture.)

### 19. Transaction form: clearing the date makes submit silently do nothing
`frontend/src/components/forms/TransactionForm.tsx:126-158,166`

The form is `noValidate`, and `new Date(transactedAt).toISOString()` runs while *building
the payload*, **outside** the `try` — an empty/invalid date throws a RangeError that
nothing catches; no error message, no console-visible UI change. Validate the date with the
other checks at the top of `handleSubmit`.

### 20. Switching transaction type keeps stale hidden fields in the payload (June M2)
`frontend/src/components/forms/TransactionForm.tsx:134-151`

Change an expense (with payee, category, classification, savings goal) to `transfer`: the
inputs hide, but `payee_id`, `category_ids`, `spending_classification`, `piggy_bank_id`
still spread into the payload, and the backend accepts them (`transactions.py` validates
only the transfer/to_account pairing). A transfer with a payee and a category contradicts
the domain model and pollutes category reports. Clear type-inapplicable state on type
switch (or strip at payload build), and consider backend validation to match.

### 21. Transactions-page "Opening/Closing" misses opening-balance rows dated inside the window
`backend/app/routers/transactions.py:556-560`

`closing_balance = opening_balance(as-of from) + inflow − outflow`, but `total_inflow` only
sums `income` (+transfer legs when account-filtered). An `opening_balance` transaction dated
*inside* the window — the normal case for an account created mid-month via the UI, since
`create_account` stamps `now()` — is in neither term. Closing balance under-reports by the
seed amount for that month.

### 22. Inline description edit: double-fire, no error handling (June M4)
`frontend/src/pages/Transactions.tsx:209-215,527-531`

Enter triggers `saveEditDesc`, then the input unmounts → blur fires `saveEditDesc` again
(second PATCH); a failed patch still exits edit mode and discards the typed value with no
feedback. Guard with an in-flight flag; keep edit mode open on error.

### 23. Imports hardcode currency "INR"
`backend/app/routers/imports.py:406`

`_record_to_transaction` sets `currency="INR"` regardless of the destination account's
currency. Everywhere else currency defaults from the account (`transactions.py:252-257`).
Use `batch.account`'s currency.

### 24. Cross-currency transfers cannot be entered, but the schema pretends they can
`frontend/src/components/forms/TransactionForm.tsx` (no `to_amount` input anywhere),
`backend/app/services/account_balance.py:137`

The model supports `to_amount`/`to_currency`; the form never sends them, so
`COALESCE(to_amount, amount)` credits the destination with the *source* amount — wrong for
any INR→foreign transfer. Either add a "received amount" field shown when the two accounts'
currencies differ, or explicitly reject cross-currency transfers at create until supported.

### 25. Bulk "Reject" with nothing selected rejects the entire pending tab
`frontend/src/pages/ImportReview.tsx:419-425`, `backend/app/routers/imports.py:252-257`

`record_ids: undefined` means "all pending" on the backend. The UI sends exactly that when
the selection is empty — one stray click on ✕ Reject nukes every pending record, with no
confirm dialog (June M12 was about force-confirm; this is the sharper edge of the same
knife). Require a selection, or confirm with the count ("Reject all 143 records?").

---

## Low

### 26. Payee inline-create type is inconsistent
`TransactionForm.tsx:303` and `SplitDrawer.tsx:491` create `type: 'merchant'`;
`SplitForm.tsx:231` creates `type: 'person'`. Creating a friend from the split drawer's
share editor mislabels them as a merchant.

### 27. Transactions type filter omits `opening_balance`
`frontend/src/pages/Transactions.tsx:393-397` — the type dropdown lists three of the four
types; opening-balance rows can't be isolated.

### 28. Splits empty-state copy is outdated
`Splits.tsx:179`, `SplitsAll.tsx:93`: "Splits are created from the transaction detail
page." They're created from the button directly above (and TransactionForm's split UI was
removed in review-fix M6).

### 29. Disputes "Keep both (not a duplicate)" is not persisted
`frontend/src/pages/Disputes.tsx:66-73` — it just closes the modal; the same pair returns
on every visit. Needs a dismissed-pairs store (backend column or table).

### 30. Split card shows "forgiven" for a split with no payee shares
`Splits.tsx:33-34`: `pending>0 ? pending : settled>0 ? settled : 'forgiven'` — a
self-only split falls through to a "forgiven" badge.

### 31. `datetime-local` round-trip truncates seconds
`TransactionForm.tsx:30-33` — editing any transaction re-saves `transacted_at` with
seconds zeroed, which can reorder same-minute rows sorted by timestamp.

### 32. Budget progress bar still doesn't clamp negatives (June H8)
`frontend/src/components/dashboard/BudgetProgressCard.tsx:11` — `Math.min(pct, 100)` only.
(Less reachable now, but one `style={{width:'-12%'}}` away.)

### 33. `TransactionFormPage` relies on `history.back()` unconditionally
`frontend/src/pages/TransactionForm.tsx:12-39` — the comment claims the page is "only ever
entered from the Transactions list", but the mobile FAB links to it from any page, and a
direct deep-link (fresh PWA launch) has no history to go back to; Save then leaves the user
stranded on a blank `null` render (`if (done) return null`).

### 34. Payment-method dropdown offers inactive methods
`TransactionForm.tsx:161-163` filters `deleted_at` but not `is_active` — a deactivated
UPI handle stays selectable.

Also still open from June (verified, unchanged): M8 (no `min` on piggy/subscription
amounts), M9 (billing day accepts 0/out-of-range), M10 (piggy contribution requires
hand-typed transaction UUID), M11 (currency free-text + hardcoded ₹ in list pages), M13
(period resets on reload), M14 (schema search effectively case-sensitive), L1 (password
toggle `tabIndex=-1`), L2 (MobileNav `startsWith` over-match), L5 ("Details" breadcrumb
leaf), L7 (widget data stale after SQL edit), L13 (misc guards). Full table in
[07-previous-review-status.md](07-previous-review-status.md).
