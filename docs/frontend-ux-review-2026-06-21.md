# Frontend UX & UI Code Review — 2026-06-21

Scope: `frontend/src` only. Focus, in order: **user-experience problems**, then
**obvious UI errors**, then **other functional bugs**. No backend changes were
reviewed except where needed to confirm a frontend assumption.

Method: the frontend was partitioned into five areas (auth/nav, transactions &
drawers, dashboard & charts, list/form pages, reports & settings) and reviewed
in parallel. Every item in the **High** section below was re-verified by reading
the cited source directly. Line numbers reflect the working tree at commit
`9ba7b9c`.

> Note: there is **no open pull request** on this branch (`master`, clean working
> tree). This is a review of the current frontend codebase, not a diff.

---

## Summary

| Severity | Count | Theme |
|----------|-------|-------|
| High     | 8     | Broken core flows (import/export auth, capped income lists), no logout, silent mutation failures, blank-overwrite on edit, broken progress bars |
| Medium   | 14    | Missing error/empty states, validation gaps, period-filter bugs, dead components, formatting inconsistencies |
| Low      | 13    | Accessibility, key usage, label/format inconsistencies |

The single most important theme: **failures are silent across most of the app.**
There is no global mutation error handler, so a large set of create/edit/delete
actions swallow backend errors and give the user no feedback. Two flagship
features (archive import and export download) are outright non-functional because
they authenticate against a `localStorage` token that does not exist.

---

## High severity

### H1. Archive **import** always sends an empty auth token — feature is broken
`frontend/src/api/portability.ts:41`

The import request builds its header as
`Authorization: Bearer ${localStorage.getItem('access_token') ?? ''}`. But the
access token is held **in memory only** (`auth-storage.ts:2`, `_accessToken`);
the only key ever written to `localStorage` is `kanakku_refresh_token`
(`auth-storage.ts:34`). `localStorage.getItem('access_token')` is therefore
always `null`, so every import sends `Bearer ` (empty) and 401s. It also bypasses
the 401→refresh retry in `authedFetch`.
**Fix:** use `getAccessToken()` from `auth-storage`, ideally via the shared
`apiPost`/`authedFetch` path.

### H2. Archive **export** download link cannot authenticate
`frontend/src/pages/SettingsDataExport.tsx:42-49`

"Download Archive" is a plain `<a href="/api/v1/export/${jobId}/download" download>`.
Auth is Bearer-token-in-memory with no cookies, and a native anchor navigation
sends no `Authorization` header, so the download 401s.
**Fix:** fetch the file with the token and trigger a blob download, or issue a
short-lived signed URL.

### H3. No way to log out anywhere in the app
`frontend/src/components/nav/*`, `frontend/src/components/MobileNav.tsx`, `frontend/src/pages/Settings.tsx`

`clearAuth()` is only ever called automatically (`api-client.ts:35` after a failed
refresh, `main.tsx:39` on boot). There is no sign-out control in TopNav, SideNav,
the MobileNav "More" sheet, or Settings. Even a single-user finance app needs a
manual logout (shared/public machine, re-auth). Users stay logged in until the
refresh token expires.

### H4. Income/expense pick-lists silently capped at 50 rows — breaks split settlement
`SplitDrawer.tsx`, `SplitDetail.tsx`, `BundleAsSplitModal.tsx`, `CreateSplitDrawer.tsx`

These call `useTransactions({ type: 'income' })` / `{ type: 'expense' }` with no
limit, and the hook defaults to `limit = 50` (`api/transactions.ts:132`,
`buildParams` line 115). When settling a share or bundling/creating a split, only
the 50 most recent income/expense transactions are selectable. A user with more
than 50 such transactions cannot link an older payment, and settlements that
reference a txn outside the window fall back to a truncated `"Payment 1a2b3c4d…"`
label. This silently breaks the core split-settlement flow at scale.

### H5. Silent failure on create/edit/delete across most forms
`frontend/src/main.tsx:9` (root cause) + many call sites

`new QueryClient()` has no `MutationCache` `onError`. Many mutations pass only
`onSuccess` and `mutateAsync` with no try/catch and no toast, so backend errors
(duplicate name, validation, network) are swallowed — the modal just closes and
the user assumes success. Confirmed call sites include:
`Payees.tsx` (create/edit/delete), `Accounts.tsx` (account + payment-method),
`PiggyBanks.tsx`, `PiggyBankForm.tsx`, `PiggyBankDetail.tsx`, `Subscriptions.tsx`,
`SubscriptionForm.tsx`, `RecentlyDeleted.tsx`. Categories/Tags/ImportReview do this
correctly (try/catch + toast), so the pattern is inconsistent.
**Fix:** add a global `MutationCache` `onError` toast, or standardize per-mutation
error handling.

### H6. Edit forms can submit before existing data loads, overwriting with blanks
`SubscriptionForm.tsx:31-42`, `PiggyBankForm.tsx:26-35`, `BudgetForm.tsx:90-101`

On the edit route, state is populated from `existing` inside a `useEffect`, but
there is no loading guard. If the user submits before the GET resolves, the PATCH
sends empty `name`/`amount`/`account_id`, overwriting the record with blank values.
**Fix:** gate the form on `isLoading` (or disable submit until populated).

### H7. ConfirmDialog confirm button never disables — double-submit / double-delete
`frontend/src/components/ConfirmDialog.tsx:39-48`

The confirm button has no `disabled`/`isPending` support, and the dialog stays
open while `await deletePayee.mutateAsync(...)` runs (e.g. `Payees.tsx:192`,
`Categories.tsx:243`, `Tags.tsx:168`, `Accounts.tsx:392`). The user can click
Delete repeatedly, firing duplicate delete requests.
**Fix:** thread a pending flag into ConfirmDialog and disable confirm while busy.

### H8. Budget progress bar does not clamp negative percentages
`frontend/src/components/dashboard/BudgetProgressCard.tsx:11`

`const pct = Math.min(budget.percentage, 100)` clamps the top but not the bottom.
A negative `percentage` (refunds exceeding spend) produces `style={{ width: '-NN%' }}`,
which is invalid CSS and renders a broken/empty bar.
**Fix:** `Math.min(Math.max(budget.percentage, 0), 100)` and guard non-finite values.

---

## Medium severity

### M1. Splits "All" view hides everything when the period has no end date
`SplitsAll.tsx:109-114`, `Splits.tsx:118-123`

`inPeriod` does `s.created_at.slice(0,10) >= start && <= end` where `start`/`end`
default to `''`. Any comparison `d <= ''` is false, so when `dashboardParams` lacks
an `end_date` **all** splits disappear behind a misleading "No splits in this
period" empty state.

### M2. Editing a transaction's type can submit fields invalid for the new type
`forms/TransactionForm.tsx:123-140`

Switching an expense to `transfer`/`opening_balance` only *hides* the payee /
category / payment-method inputs; their state is not cleared, and `category_ids` /
`tag_ids` / `spending_classification` are spread into the payload regardless of
type. A transfer can be saved carrying a category and classification, contradicting
the domain model.

### M3. "Your share" in Bundle-as-Split contradicts the net-expense rule (FR-7.9)
`BundleAsSplitModal.tsx:35,99-103`

`userShare = expense − incomeTotal − forgivenTotal`, labelled "Your share". Per
FR-7.9 net expense is `user_own_share + forgiven_shares` — forgiven amounts should
be *included*, not subtracted. `CreateSplitDrawer.tsx:129` correctly computes
`netExpense = myShare + forgiven`, so the two split entry points disagree and the
label is misleading. (Note: `SplitDrawer`/`SplitDetail` net-expense displays were
checked and *do* follow FR-7.9 correctly.)

### M4. Inline transaction-description edit can double-save or silently lose the edit
`Transactions.tsx:556-560, 661-666`

`onBlur` and Enter both call the async `saveEditDesc` with no in-flight guard, so
Enter fires two `mutateAsync` calls (blur then keydown). There is no error handling,
and `setEditingDescId(null)` runs regardless, so a failed patch discards the typed
value with no feedback.

### M5. Settle / forgive / unsettle / unlink give no success or error feedback
`SplitDrawer.tsx:53-60,183-194`, `SplitDetail.tsx:162-173`, `AccountDrawer.tsx:50-53`

These mutations run with no `onError` and no toast; the inline form closes
unconditionally after `await`, so a backend rejection (forgive exceeds remaining,
settle conflict) leaves the user unsure whether the action took effect. Related to
H5.

### M6. Settle / forgive amounts not validated client-side; `max` not enforced
`SplitDrawer.tsx:286,309`, `SplitDetail.tsx:269,296`

The amount inputs set `max={remaining}` but `type="number" max` is not enforced on
manual entry and there is no pre-submit check. Combined with M5 (no error shown),
an over-cap amount's outcome is invisible to the user.

### M7. Two built, tested dashboard visualizations are never rendered
`Dashboard.tsx` (whole file)

`data.category_breakdown` and `data.active_subscriptions` are fetched
(`dashboard.ts:106,111`) but `CategoryBreakdownChart` and `SubscriptionStatusBadge`
are referenced only by their own tests — never mounted. The spending-by-category
chart and subscription status are invisible to the user. Likely an integration
oversight.

### M8. PiggyBank / Subscription forms allow zero or negative amounts
`PiggyBanks.tsx:102-110`, `PiggyBankForm.tsx:89-97`, `Subscriptions.tsx:83-91`, `SubscriptionForm.tsx:98-106`

`type="number"` target/amount inputs have no `min`. Budgets correctly use
`min="0.01"`; these don't, so a user can save a 0 or negative goal/amount.

### M9. Subscription "Billing day" accepts 0 and out-of-range values
`Subscriptions.tsx:129`, `SubscriptionForm.tsx:144`

`min="0"` with no `max`; billing day should be 1–31. Day 0 and arbitrarily large
numbers pass through.

### M10. PiggyBank contribution requires a hand-typed transaction UUID
`PiggyBankDetail.tsx:84-93`

The "Transaction ID" field is free text with placeholder "UUID of the transaction",
no picker and no validation; a typo silently 400s with no feedback (see H5).

### M11. Currency entered as free text; list then hardcodes ₹
`PiggyBankForm.tsx:103`, `SubscriptionForm.tsx:112`, `Accounts.tsx:310`, `Budgets.tsx:302,346`, `BudgetForm.tsx:202`

Currency is a plain text input (no select/validation), yet `Budgets.tsx:302`
renders a hardcoded ₹ regardless of stored currency, so a non-INR budget shows the
wrong symbol. Recent-transaction amounts on the dashboard similarly hardcode ₹
(`Dashboard.tsx`) while the stat cards use `Intl` currency formatting — inconsistent.

### M12. Bulk import-review actions are destructive with no confirmation
`ImportReview.tsx:418,527`

`rejectSelected` and "Force confirm all" fire immediately. "Force confirm all" can
create balance discrepancies (its own modal warns about exactly this) but the bulk
button skips any ConfirmDialog.

### M13. Period selection resets to "this month" on every reload
`frontend/src/lib/period-context.tsx:16`

The global period picker initializes from `defaultPeriod` (always current month)
and is not persisted to URL or storage. After picking e.g. "Q2 2025" and reloading
(or after the failed-refresh remount), all dashboard/report data silently snaps back
to the current month with no indication.

### M14. Schema-reference search is effectively case-sensitive
`frontend/src/components/reports/SchemaReferencePanel.tsx:45-49`

`t.name.includes(search.toLowerCase())` lowercases the query but not the table/column
name, so typed uppercase matches nothing. Lowercase both sides.

---

## Low severity

### L1. Password show/hide toggle is keyboard-inaccessible
`frontend/src/components/PasswordInput.tsx:20` — the toggle has `tabIndex={-1}`, so
keyboard-only users can never reveal the password despite the correct `aria-label`.

### L2. `MobileNav` active-tab matching over-matches
`frontend/src/components/MobileNav.tsx:70-73` — `currentPath.startsWith(to)` marks
`/transactions` active on `/transactions-foo`. SideNav (`SideNav.tsx:110-113`)
correctly uses `=== to || startsWith(to + '/')`.

### L3. Navigation label inconsistency by viewport
`MobileNav.tsx:17-18` says "Piggy Banks" / "Imports" while `SideNav.tsx:70,88` and
`breadcrumbs.ts:11` say "Savings Goals" / "Import" for the same destinations.

### L4. WeekPicker always renders 6 rows, allowing selection outside the month
`frontend/src/components/nav/PeriodPicker.tsx:64-115` — the hardcoded 6×7 grid can
show a trailing/leading week from an adjacent month with no visual cue.

### L5. Breadcrumb leaf for detail pages is the literal word "Details"
`frontend/src/lib/breadcrumbs.ts:73-77,89-95` — `/budgets/:id`, `/splits/:id`, etc.
show "Details" instead of the entity name, giving no orientation on deep pages.

### L6. Reports/widget/dashboard deletes have no confirmation or recovery hint
`Reports.tsx:119`, `ReportDashboard.tsx:194` — the ✕ deletes a dashboard (and all its
widgets) or a widget immediately with no confirm dialog.

### L7. Widget data does not refetch after a query edit
`ReportDashboard.tsx:103-112` — the load effect guards with
`if (!widgetData[widget.id])`, so editing a widget's SQL shows the stale result
until a full page reload.

### L8. WidgetEditor silently discards invalid chart-config JSON
`frontend/src/components/reports/WidgetEditor.tsx:59-63` — malformed JSON is caught
and saved as `{}`, dropping the user's config with no warning.

### L9. Report chart widgets have no empty/zero-row state
`frontend/src/components/reports/WidgetRenderer.tsx:84-145` — bar/line/pie render a
blank canvas for zero rows or a single-column result (`columns[1]` undefined) with
no "No data" message.

### L10. Dashboard / report list keys use array index
`Dashboard.tsx:265-266` (`key={i}` on pending-splits by-payee),
`WidgetRenderer.tsx:69,136`, `CategoryBreakdownChart.tsx:52-53`,
`TopNav.tsx:39` — index keys on lists that can reorder; prefer stable ids.

### L11. Raw date / amount strings rendered unformatted in places
`Subscriptions.tsx:226-227`, `PiggyBanks.tsx:228,231-234`, `PiggyBankDetail.tsx:185,188-191`,
`SubscriptionDetail.tsx:35` print raw ISO dates and unformatted amounts, unlike
`Imports.tsx`/`RecentlyDeleted.tsx`/`Budgets.tsx` which use locale formatting.

### L12. Payment-method delete copy contradicts the soft-delete rule
`Accounts.tsx:151` — says "This cannot be undone immediately." while every other
entity says "can be undone within 30 days." Confirm whether payment methods are
soft-deleted and align the copy.

### L13. Misc small guards
`Imports.tsx:58` pending count `total_parsed - confirmed - rejected` can go negative
(no `Math.max(0, …)`); `SettingsLLMActivity.tsx:123` renders `{duration_ms} ms` which
shows "null ms" for failed calls; `RecentlyDeleted.tsx:101` restore has no
pending/disabled state so it can be double-clicked.

---

## Checked and cleared (not issues)

- **Savings-rate scaling on the dashboard is correct.** Backend returns
  `savings_rate = (inflow - outflow) / inflow * 100` (a whole-number percent,
  `backend/app/routers/dashboard.py:796`). `Dashboard.tsx:183` divides by 100 to feed
  a `percent` formatter (→ correct), and the `pp` delta at line 168-171 is computed on
  the same whole-number scale (→ correct). An earlier pass flagged this as
  "double-divided ~100×"; verification shows both are consistent.
- `SplitDrawer.tsx` / `SplitDetail.tsx` net-expense displays correctly implement
  FR-7.9 (`own_share + forgiven`, pending excluded).
- `PiggyBankProgressRing` correctly clamps `[0,100]`; `CashFlowChart` handles empty
  data and keys by name.
- Login/Setup forms guard against double-submit via `disabled={mutation.isPending}`.
- `api-client.parseJsonOrUndefined` correctly handles 204/empty bodies.

---

## Recommended priority order

1. **H1, H2** — restore import/export auth (two flagship features are fully broken).
2. **H5** — add a global mutation error handler; this masks failures everywhere.
3. **H6, H7** — prevent blank-overwrite on slow edit loads and double-delete.
4. **H4** — paginate or raise the limit on income/expense pick-lists for splits.
5. **H3, H8** — add logout; clamp the budget bar.
6. Work through Medium items, starting with M1 (splits vanishing) and M7 (dead
   dashboard widgets).
