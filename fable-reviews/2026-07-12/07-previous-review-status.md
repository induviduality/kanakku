# Status of the 2026-06-21 Review Items — audited 2026-07-12

Every item from `docs/frontend-ux-review-2026-06-21.md`, re-verified against the current
working tree (`1f9bf34`). "Open" means I re-read the cited code today and the defect is
still present.

**Score: High 3/8 fixed · Medium 4/14 fixed · Low 1/13 fixed.**

## High

| # | Item | Status | Evidence |
|---|---|---|---|
| H1 | Archive import empty auth token | **OPEN** | `api/portability.ts:41` unchanged — the fix in completed.md ("useUploadPdf … getAccessToken") patched `api/imports.ts` (PDF upload), not this file |
| H2 | Export download anchor can't authenticate | **OPEN** | `SettingsDataExport.tsx:42-49` unchanged |
| H3 | No logout anywhere | **OPEN** | no frontend caller of the (existing!) `POST /auth/logout`; no control in any nav or Settings |
| H4 | Income/expense pick-lists capped at 50 | **FIXED** | TransactionPicker (3-tier search) replaced the capped selects in all split flows; SplitForm/SplitDrawer resolve by-id via `useQueries` |
| H5 | Silent mutation failures app-wide | **PARTIAL** | ToastProvider now global; ImportReview/Categories/Disputes toast on error. Payees, Accounts, PiggyBanks, Subscriptions, RecentlyDeleted: still zero `onError` (grep-verified). No `MutationCache.onError` (`main.tsx:9`) |
| H6 | Edit forms can submit before data loads → blank overwrite | **OPEN** | `SubscriptionForm.tsx:32-42` (and PiggyBankForm, BudgetForm) still populate via `useEffect` with no load gate; their `isLoading` flags are mutation-pending only |
| H7 | ConfirmDialog never disables confirm | **OPEN** | `components/ConfirmDialog.tsx:39-48` unchanged — no pending prop |
| H8 | Budget bar doesn't clamp negative % | **OPEN** | `BudgetProgressCard.tsx:11` still `Math.min(pct, 100)` only |

## Medium

| # | Item | Status | Evidence |
|---|---|---|---|
| M1 | Splits vanish when period has no end date | **FIXED** | period context always resolves start+end; Splits filters via local-date conversion |
| M2 | Type switch keeps invalid fields in payload | **OPEN** | `TransactionForm.tsx:134-151` — re-confirmed, now bug #20 |
| M3 | Bundle "Your share" contradicts FR-7.9 | **FIXED (by removal)** | BundleAsSplitModal deleted; CreateSplitDrawer/SplitForm compute net = own + forgiven |
| M4 | Inline desc edit double-save / silent loss | **OPEN** | `Transactions.tsx:209-215, 527-531` — now bug #22 |
| M5 | Settle/forgive/unsettle no feedback | **PARTIAL** | SplitDrawer settle/forgive now set inline errors (`SplitDrawer.tsx:178-199`); unlink/unsettle/delete-split still silent |
| M6 | Settle/forgive amounts not validated client-side | **FIXED** | `SplitDrawer.tsx:163-171,183-192` — pre-submit checks + disabled-gating on both forms |
| M7 | CategoryBreakdownChart + SubscriptionStatusBadge never rendered | **OPEN** | grep: both referenced only by their own files/tests; `Dashboard.tsx` never imports them |
| M8 | PiggyBank/Subscription amounts allow ≤ 0 | **OPEN** | no `min` on amount inputs (grep-verified; only billing-day has `min="0"`) |
| M9 | Billing day accepts 0 / out-of-range | **OPEN** | `Subscriptions.tsx:129`, `SubscriptionForm.tsx:144` — still `min="0"`, no max |
| M10 | Piggy contribution = hand-typed UUID | **OPEN** | `PiggyBankDetail.tsx:73-93` unchanged |
| M11 | Currency free-text; hardcoded ₹ | **OPEN** | unchanged across Budgets/PiggyBanks/etc. |
| M12 | Bulk import actions destructive without confirm | **OPEN** | worse edge found: empty-selection Reject = reject all (bug #25) |
| M13 | Period resets on reload | **OPEN** | `period-context.tsx:35` — `useState(defaultPeriod)`, nothing persisted |
| M14 | Schema search case-sensitive | **OPEN** | `SchemaReferencePanel.tsx:47-48` — still lowercases only the query |

## Low

| # | Item | Status |
|---|---|---|
| L1 | Password toggle `tabIndex=-1` | **OPEN** (`PasswordInput.tsx:20`) |
| L2 | MobileNav `startsWith` over-match | **OPEN** (`MobileNav.tsx:70-73`) |
| L3 | Nav label inconsistency by viewport | **OPEN** ("Savings Goals"/"Piggy Banks", "Import"/"Imports") |
| L4 | WeekPicker 6-row grid, adjacent-month weeks | **OPEN** (`PeriodPicker.tsx:64-117`) |
| L5 | Breadcrumb leaf "Details" | **OPEN** (`breadcrumbs.ts`) |
| L6 | Report/widget delete no confirm | **OPEN** |
| L7 | Widget data stale after query edit | **OPEN** (`ReportDashboard.tsx` load-guard) |
| L8 | WidgetEditor discards invalid JSON silently | **OPEN** |
| L9 | Chart widgets no empty state | **OPEN** |
| L10 | Index keys on reorderable lists | **OPEN** (e.g. `Dashboard.tsx:281`) |
| L11 | Raw dates/amounts unformatted in places | **OPEN** |
| L12 | Payment-method delete copy vs soft-delete | **OPEN** (`Accounts.tsx:151`) |
| L13 | Misc guards (negative pending count, "null ms", restore double-click) | **FIXED for pending count being negative? No** — `Imports.tsx:58` still unguarded; others unchanged → **OPEN** |

## Takeaway

The June review's items that got fixed were the ones that intersected feature work
(TransactionPicker, split-form revamp, drawer validation). Items with no adjacent feature
— auth plumbing, form guards, dead widgets — did not move. If you want these closed,
schedule them as their own sprint (most are sub-hour fixes); they will not fall out of
feature work naturally. Suggested batching:

1. **Auth/feedback afternoon**: H1, H2, H3, H5-completion (MutationCache + ApiError), bug #9.
2. **Form-guards afternoon**: H6, H7, H8, M8, M9, M2/bug #20, bug #19.
3. **Dashboard/polish afternoon**: M7, M13, M14, L5, L12, currency util (M11).
