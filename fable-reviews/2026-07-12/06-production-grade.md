# Production-Grade & Elegance — 2026-07-12

Items that don't change what the app does, but change whether you can trust and maintain
it. Ordered by risk, then by cleanup value.

## Hardening

### 1. Refuse to boot with the default JWT secret
`backend/app/config.py:8` — `jwt_secret: str = "change-me-in-production"`. Nothing stops a
prod deployment from silently running with it. Add a startup check in `main.py`'s
lifespan: if `not settings.dev_mode and settings.jwt_secret == "change-me-in-production"`,
raise. Two lines; kills the most classic self-hosted foot-gun.

### 2. One error contract on the frontend
Every API helper does `if (!res.ok) throw res` — a raw `Response` — so no caller can show
the backend's `detail` without ad-hoc parsing, and none do: every error message in the app
is a hardcoded generic ("Failed to create split. Please check the details…") while the
backend produces precise ones ("Income transaction … is already linked to a split",
"Paid (X) + forgiven (Y) exceeds share amount (Z)"). Introduce `class ApiError extends
Error { status; detail }` in `api-client.ts`, throw that, and let the global
`MutationCache.onError` (bug #12's fix) default to `err.detail ?? generic`. One change,
every error in the app becomes actionable.

### 3. Auth/session lifecycle completion
Wire the existing `POST /auth/logout` (bug #10), mount the auth subscription (bug #9), and
consider a visible "session expired, please log in again" toast on forced logout so the
redirect isn't mysterious.

### 4. Observability
No request logging, no timing, no error tracking anywhere in `main.py`. For a Pi
deployment you don't need Sentry — but one middleware logging method/path/status/duration
(and uncaught-exception stack traces) turns "the cash flow chart looks wrong" debugging
sessions from psql archaeology into log reading. Pair with the GZip middleware
(04-nfr §7) in the same PR.

## Consistency / code health

### 5. Finish the design-system migration
140 occurrences of legacy `gray-*/indigo-*/red-600` classes across 31 files are kept
working by the palette-remap block in `index.css:91-190` and the global `.bg-white`
override in `base.css`. It works, but it means two vocabularies for one theme, and the
`.bg-white` override is a trap (any future genuinely-white surface silently renders dark).
Mechanical migration, file at a time, then delete the remap block — that deletion is the
point, it re-enables Tailwind's real palette as an error signal.

### 6. Delete or wire the dead code
From 03-architecture §8: `AuthGuard` (wire), `CategoryBreakdownChart` (mount),
`SubscriptionStatusBadge` (mount or delete), `useInfiniteTransactions` (delete),
`pending_splits_from_others` (render or stop computing). Also the `llm/` stack decision
(03-architecture §5).

### 7. Un-smuggle duplicate metadata out of `parsed_json`
`_duplicate_transaction_ids` lives inside the record's `parsed_json` blob
(`ImportReview.tsx:36-39`, written by the import worker). It's system metadata riding in a
user-editable field — an inline edit that rewrites `parsed_json` (`RecordRow.saveEdit`
spreads it, but any future writer might not) can destroy dedup provenance. Move it to a
real column (`duplicate_transaction_ids UUID[]`) on `raw_import_records`.

### 8. Naming/labeling consistency sweep
"Savings Goals" vs "Piggy Banks" vs piggy-bank URLs; "Import" vs "Imports" vs "Bulk
Import"; breadcrumb "Details" leaves. One pass, one vocabulary. (Users notice; reviewers
notice; future-you greps by these names.)

## Test & CI hygiene

### 9. Fix the 64-failure frontend baseline
Known cause (completed.md 2026-07-11 cont. 2): commit `734cb94` added Toast/Period context
usage without updating the shared test render helper. Every future frontend change is
verified against a red baseline, which is how real regressions hide (it already cost you a
git-stash bisection once). Update the render helper to wrap `ToastProvider` +
`PeriodProvider`; likely a one-file fix that flips ~64 tests green.

### 10. Re-enable CI
Both workflows are `workflow_dispatch`-only (disabled 2026-06-03). With the backend suite
now green (494/494 as of 2026-07-11) and the frontend baseline fixed per §9, turn
on-push CI back on — the whole point of the July stabilization work was to make this
possible.

### 11. Tests to add for this review's fixes
Highest-value regression tests, matching bugs found: split PUT preserves
`forgiven_amount` + partial settlement amounts (bug #3); `_sync_piggy_bank` updates/derives
`current_amount` (bug #4); import-confirm rejects a second `opening_balance` per account
(bug #5); import-confirm response reports skipped records (bug #6); batch counter
consistency after duplicate-resolve (bug #15).

## Docs

### 12. Document the credit-card usage pattern
Whatever you decide from [05-credit-cards…](05-credit-cards-and-payment-methods.md), the
swipe=expense / bill=transfer convention belongs in `docs/decisions/log.md` and the README
— it's the kind of invariant that silently erodes if it only lives in your head.

### 13. `docs/context/completed.md` is becoming an unbounded scroll
977 lines and growing per-task. Consider yearly archives (`completed-2026H1.md`) with the
live file keeping the last ~2 months — it's read at the start of every agent session
(per CLAUDE.md), so its size is a real context cost.
