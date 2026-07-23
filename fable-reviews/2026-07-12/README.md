# Kanakku Review — 2026-07-12 (Fable)

A full-application review done from the user's seat: I walked every primary journey
(entry → import → splits → budgets → goals → reports → settings) through the frontend
source, then followed each flow into the backend to verify behavior rather than assume it.
Every finding below cites the file and line it was verified against (working tree at
commit `1f9bf34`, clean master). Nothing in this folder changes code.

## Files

| File | Contents |
|---|---|
| [01-bugs.md](01-bugs.md) | Confirmed defects, ranked. Frontend + backend, with repro logic and fix sketches |
| [02-ux-review.md](02-ux-review.md) | Journey-by-journey usability review with concrete recommendations |
| [03-architecture.md](03-architecture.md) | Architectural findings + **decisions flagged for you** (explicitly not assumed) |
| [04-nfr-performance.md](04-nfr-performance.md) | Dedicated NFR section: backend query patterns, frontend bundle/caching, PWA |
| [05-credit-cards-and-payment-methods.md](05-credit-cards-and-payment-methods.md) | Dedicated section: how to model credit cards + payment methods going forward |
| [06-production-grade.md](06-production-grade.md) | Elegance / production-readiness items (error contract, secrets, dead code, tests, CI) |
| [07-previous-review-status.md](07-previous-review-status.md) | Status audit of every item from `docs/frontend-ux-review-2026-06-21.md` |
| [08-dashboard-reports-and-savings-model.md](08-dashboard-reports-and-savings-model.md) | Dashboard widget value redesign, curated Reports direction, and the salary→invested/spare savings-rate model |
| [09-design-system.md](09-design-system.md) | **"Ink & Marigold"** — complete handoff-ready design system spec (tokens, type, hierarchy, components, migration map) replacing the current theme |

## Executive summary

The core architecture is sound and has visibly improved through the July fix sprints —
computed balances (D-002) and the timezone principle (D-003) killed two whole bug classes.
The biggest theme of this review is that **the same imperative-cache bug class D-002
eliminated for account balances is still alive in two other places** (piggy-bank
`current_amount`, import-batch counters), and that **several guards exist on one code path
but not its siblings** (opening-balance rules enforced on `POST /transactions` but not on
import confirm or account create; split invariants enforced on create but silently degraded
on edit).

The second theme: **two flagship data-portability features are still broken** (archive
import auth, export download auth) — both were High findings in the 2026-06-21 review and
were never fixed (the similar-looking PDF-upload fix went to a different file). See
[07-previous-review-status.md](07-previous-review-status.md): of the 8 High items from June,
**5 are still open**.

Third theme: navigation and feedback debt. Desktop users cannot reach Settings, Reports, or
Subscriptions at all (no link exists); mobile users cannot reach Splits or Disputes. There
is still no logout control (the backend endpoint exists, unused), no global mutation error
handler, and a mid-session auth expiry leaves the app silently broken because `AuthGuard`
is dead code that is never mounted.

## Top 10, if you fix nothing else

1. **Archive import + export download are still fully broken** (auth) — [01-bugs #1, #2]
2. **Editing a split silently wipes forgiveness and partial-payment amounts** — [01-bugs #3]
3. **Savings-goal progress drifts**: `_sync_piggy_bank` never updates `current_amount` — the exact D-002 bug class again — [01-bugs #4]
4. **Imported `opening_balance` bypasses the one-per-account + liability guards** → double-counted balances, the thing you just spent two days fixing — [01-bugs #5]
5. **Desktop nav is missing Settings/Reports/Subscriptions; mobile nav is missing Splits/Disputes** — [02-ux §1]
6. **Unsettled splits are period-scoped everywhere** — old debts silently vanish from every pending view — [01-bugs #8]
7. **`SplitsAll` still filters by `created_at`** — the 2026-06-21 `expense_date` fix missed the view-all pages — [01-bugs #7]
8. **Import confirm silently skips unparseable records** (`return None` → `continue`) — [01-bugs #6]
9. **No logout + dead `AuthGuard`** — session expiry mid-use = silently broken app — [01-bugs #29, #30]
10. **`GET /transactions` does ~6 queries per row** (N+1 ×6) — the single biggest perf lever — [04-nfr §1]

## Method note

Findings marked **Confirmed** were verified by reading both sides (caller and callee, or
frontend and backend) of the behavior. Where I could not verify without running the app or
DB, the item says **Verify** and states exactly what to check. Architectural questions where
more than one design is defensible are not asserted as bugs — they live in
[03-architecture.md](03-architecture.md) § "Flagged for your decision".
