# Create Split Drawer — Full Spec

## Context

Splits are currently only created via the "Bundle as Split" modal triggered from a
transaction's detail view, or from the Transactions list. There is no standalone entry
point on the Splits page itself.

This spec describes a **Create Split** drawer accessible directly from the Splits page
that lets the user compose a split from scratch: pick expense transactions, define
payee shares, link settlement income transactions, and set forgiveness amounts — all in
one flow before submitting.

> **Requires a backend change.** To guarantee atomicity (requirement below), the
> `POST /splits` endpoint must be extended to accept per-share settlements and
> forgiveness inline, so the whole split is created in a **single DB transaction**.
> See [Backend Changes Required](#backend-changes-required). The current 3-call
> client sequence (create → settle → forgive) is explicitly rejected because it can
> leave a half-built split if any call after the first fails.

---

## Entry Point

A **"+ Create Split"** button is added to the top-right of the Splits page header,
next to any existing controls. Clicking it opens the Create Split drawer (right-slide,
same pattern as all other drawers in the app).

---

## Drawer Layout Overview

The drawer is a **multi-step form** presented as a single scrollable panel (not a
wizard with separate pages). Sections are visually separated with `DrawerSection`
headers. On narrow viewports the drawer is full-width.

```
┌─────────────────────────────────────────┐
│  ← Create Split                         │  (drawer title)
├─────────────────────────────────────────┤
│  SECTION 1 — Expense Transactions       │
│  [search box]                           │
│  ┌──────────────────────────────────┐   │
│  │ ✓ Dinner at Spice Garden  ₹2400  │   │
│  │   28 May · HDFC Savings          │   │
│  │ ✓ Drinks at Bar           ₹600   │   │
│  │   28 May · HDFC Savings          │   │
│  └──────────────────────────────────┘   │
│  Total selected: ₹3,000                 │
├─────────────────────────────────────────┤
│  SECTION 2 — My Share                   │
│  Amount  [__________]  [Use remainder]  │
│  Forgiven amounts on payees reduce      │
│  your net expense (FR-7.9)              │
├─────────────────────────────────────────┤
│  SECTION 3 — Payee Shares               │
│  ┌──────────────────────────────────┐   │
│  │ Payee [Priya ▾]  Amount [______] │   │
│  │ ┌──────────────────────────────┐ │   │
│  │ │ Forgive  [______] [All]      │ │   │
│  │ └──────────────────────────────┘ │   │
│  │ Linked transactions:             │   │
│  │  · UPI from Priya  ₹1000  [×]   │   │
│  │  [+ Link transaction]            │   │
│  │                          [× Remove payee] │
│  └──────────────────────────────────┘   │
│  [+ Add payee]                          │
├─────────────────────────────────────────┤
│  SECTION 4 — Balance check              │
│  Shares total  ₹3,000 / ₹3,000  ✓      │
│  Your net expense (FR-7.9):  ₹1,100    │
├─────────────────────────────────────────┤
│  SECTION 5 — Notes                      │
│  [__________________________________]   │
├─────────────────────────────────────────┤
│  [Cancel]              [Create Split →] │
└─────────────────────────────────────────┘
```

---

## Section-by-Section Specification

### Section 1 — Expense Transactions

**Purpose:** Select one or more expense transactions to attach to this split.

**UI elements:**
- A search input at the top of the section.
- Below the search input, a scrollable list (max ~200 px visible, overflow-y auto)
  showing matching expense transactions. Default view shows the 20 most recent expense
  transactions (sorted `transacted_at DESC`).
- Each row shows: checkbox · transaction description (or payee name if no description)
  · amount (right-aligned, red) · date + account name (secondary line).
- Transactions that are already linked to another split are greyed-out and have a
  "In another split" badge; they cannot be selected.
- Only `type = expense` transactions are shown. Transfers, income, and
  `opening_balance` transactions are excluded.

**Interactions:**
- Typing in the search input filters the list by description or payee name
  (client-side if the list is small, otherwise debounced API call).
- Clicking a row toggles its checkbox.
- A "Total selected: ₹X" pill appears below the list once at least one transaction
  is selected, summing `amount` across all selected rows.

**Constraints:**
- At least 1 transaction must be selected before the form can be submitted.
- If 0 are selected, the Submit button is disabled and a helper text says
  "Select at least one expense transaction."

---

### Section 2 — My Share

**Purpose:** Define how much of the total expense is the user's own responsibility.

**UI elements:**
- A numeric input labelled "My share amount".
- A "Use remainder" button that sets the field to
  `total_selected - sum(all_payee_share_amounts)`.
- A read-only info row: "Your net expense = My share + forgiven amounts" (FR-7.9 hint).

**Business rules:**
- `my_share_amount` maps to a `SplitShareCreate` with `payee_id = null`.
- `my_share_amount` may be **zero**. When it is zero, the My Share row contributes
  **no share at all** — the null-payee share is **omitted from the request entirely**
  (the backend rejects a share with `amount <= 0`, so a zero row must not be sent).
  Zero is valid when the user paid entirely on behalf of others and is owed it all back.
- The My Share row **never has settlement linking** ("Link transaction" is not shown for
  it), and when `my_share_amount = 0` it shows only the amount input — no other controls.
  Others pay the user back; the user does not settle their own share.
- There is exactly one "My share" row — the user cannot add a second one.
- Forgiveness does NOT apply to the user's own share (`payee_id = null`). Forgiveness
  is only set on individual payee shares and reduces what those payees owe.
  Per FR-7.9, net expense = `my_share_amount + Σ forgiven_amount(payee shares)`.

---

### Section 3 — Payee Shares

**Purpose:** Define how much each other person owes, optionally pre-link their
settlement income transactions, and optionally forgive part of their share.

**Top-level UI:**
- A "+ Add payee" button appends a new payee row.
- Each payee row is a card (`kk-panel`) containing the sub-elements below.
- A "× Remove payee" icon button in the top-right of the card removes the row.

**Per-payee card contents:**

#### 3a — Payee selector
- A searchable combobox/autocomplete listing existing payees (same data as used in
  TransactionForm's payee picker). The user can type to filter.
- Selecting a payee fills in the name; the underlying value is `payee_id: UUID`.
- **Inline payee creation:** if the typed text matches no existing payee, the dropdown
  shows a `+ Create payee "<text>"` option. Selecting it calls `POST /payees` with just
  `{ name: <text> }`, and the returned payee is immediately selected in the card.
  (The payee picker in TransactionForm already follows this pattern — reuse it.)
- The same payee cannot appear in two cards. If the user picks a payee already chosen
  on another card, show an inline error: "This payee already has a share." (This is a
  blocking error — see [Submit Gating](#submit-gating).)

#### 3b — Share amount
- A numeric input labelled "Amount owed". Required if the payee card exists.
- A "Use remainder" button: sets to
  `total_selected - my_share_amount - sum(other_payee_share_amounts)`.

#### 3c — Forgive (optional, collapsible)
- A "Forgive part of this share" toggle link (collapsed by default).
- When expanded: a numeric input for the forgiven amount + an "All" button.
- This is sent inline as `forgiven_amount` on the share (single atomic create — see
  [Submit Flow](#submit-flow)).
- Inline read-only preview: "Payee effectively owes ₹X after forgiveness."
- **Validation rule:** `linked_settlements_total + forgiven_amount ≤ share_amount`.
  In words: what the payee has already paid (sum of the full amounts of the
  transactions linked in 3d) plus what is forgiven must not exceed their total share.
  - The "All" button fills the field with the **remaining after payments**:
    `share_amount − linked_settlements_total` (not the full share amount).
  - If the rule is violated, show an inline error directly under the input:
    "Paid + forgiven (₹X) cannot exceed this payee's share (₹Y)." This is a blocking
    error — see [Submit Gating](#submit-gating).
- **Effect on net expense (FR-7.9):** every rupee forgiven here increases the user's
  net expense on the balance summary. This is surfaced in Section 4.

#### 3d — Linked Transactions (optional)
- A sub-section labelled "Settlement transactions" showing income transactions the
  payee has sent to settle their share.
- Each linked transaction row shows: description · **full amount** · date · a "×"
  unlink button (removing it is local state only — nothing is committed until submit).
- A **"+ Link transaction"** button at the bottom of the sub-section. Clicking it
  opens a **Link Transaction Panel** (see below).

> **No manual settlement amounts.** A share is settled **solely** by linking whole
> income transactions and/or by forgiveness. Linking a transaction always credits its
> **full amount** — there is no per-link "amount to credit" field. If the user needs a
> different split of money, they adjust the share amount or which transactions are
> linked. (The only way to change a settled amount is to change the whole share.)

**Link Transaction Panel** (inline expansion within the payee card):
- A search input filtered to `type = income` transactions only.
- Each result row: description · amount · date · account.
- **Excluded from results** (not selectable):
  1. Income transactions already linked to **any** existing split (the backend rejects
     these globally with 409).
  2. Income transactions already linked to **any payee card in this form**.
- Selecting a transaction immediately adds it (at its full amount) to the
  "Settlement transactions" list above and closes the panel. The user can open the
  panel again to link another transaction.
- There is no amount input and no Confirm step — selection is the commit (to local
  state).

**Linked transaction data** is staged in component state and submitted inline as part
of the single atomic `POST /splits` call (see [Submit Flow](#submit-flow)).

---

### Section 4 — Balance Check (live, read-only)

**Purpose:** Show the user whether their configured shares add up to the total, and
what their actual net expense will be.

| Row | Value |
|-----|-------|
| Total expense | Sum of selected transaction amounts |
| My share | Value from Section 2 |
| Payee shares | Sum of all payee share amounts |
| **Shares total** | My share + Payee shares |
| **Balance** | Shares total − Total expense (shown in green if 0, red if non-zero) |
| Forgiven (total) | Sum of all forgiven amounts across payees |
| **Your net expense** | My share + Forgiven total (FR-7.9) |

The balance row is the key validity indicator. If non-zero, the Submit button is
disabled and a message reads "Shares must add up to ₹X (total expense)."

---

### Section 5 — Notes

An optional single-line text input mapped to `SplitCreate.notes`. Placeholder:
"e.g. Goa trip dinner, May 28."

---

## Validation Rules (pre-submit)

| Rule | Error message |
|------|---------------|
| No expense transactions selected | "Select at least one expense transaction." |
| Shares total ≠ total expense | "Shares must add up to ₹X." |
| A payee card has no payee selected | "Choose a payee for each share row." |
| A payee card has no amount set or amount ≤ 0 | "Enter a valid amount for each payee." |
| My share amount < 0 | "Your share cannot be negative." |
| Same payee in two cards | "This payee already has a share." |
| For any payee: linked total + forgiven > share amount | "Paid + forgiven (₹X) cannot exceed this payee's share (₹Y)." |
| A linked transaction is already used in another payee card | "This transaction is already linked to another payee." |

Note: "My share amount = 0" is **valid** (the row is simply omitted from the request).
There is no manual credit-amount field, so its validation row is gone — linked
transactions always credit their full amount and are covered by the "linked total +
forgiven ≤ share" rule above.

### Submit Gating

**Any** active error in the drawer — a row in the table above, an inline payee-duplicate
error, or an inline forgive-overflow error — **disables the "Create Split" button**.
The button is only enabled when the entire form is valid. Each error is also shown
inline next to the offending control, not only as a summary.

---

## Submit Flow

**Single atomic call — all or nothing.** The drawer submits exactly **one** request.
Settlements and forgiveness are embedded per-share so the backend creates the split,
its shares, its settlements, and its forgiveness inside **one DB transaction**. If any
part fails validation, the whole transaction is rolled back and **nothing** is
persisted — there is no partial split and no "transition" state to recover from.

This requires the backend change described in
[Backend Changes Required](#backend-changes-required).

```
POST /splits
Body: {
  expense_transaction_ids: [...],
  notes: "...",
  shares: [
    // My share — included ONLY when my_share_amount > 0
    { payee_id: null, amount: <my_share> },

    // Payee shares
    {
      payee_id: "<uuid>",
      amount: <share>,
      settlement_transaction_ids: ["<uuid>", "<uuid>"],  // each credited at full amount
      forgiven_amount: <amount>,                          // 0 if not forgiving
      notes?: "..."
    },
    ...
  ]
}
→ 201 with the full SplitResponse, OR 4xx with nothing committed.
```

On success:
- Close the drawer.
- Invalidate `['splits']` and `['transactions']` query keys.
- Show a success toast: "Split created."
- Open the SplitDrawer for the newly created split so the user sees the result.

On failure (any 4xx/5xx):
- The drawer stays open with all input intact.
- Show the server error in an inline alert at the bottom of the drawer.
- Because the call is atomic, **a plain resubmit is always safe** — no duplicate split
  is created, and the expense transactions are never left linked to a failed attempt.

---

## Mapping to API Contracts

| UI concept | API field |
|------------|-----------|
| Selected expense transactions | `SplitCreate.expense_transaction_ids` |
| My share (omitted when 0) | `SplitShareCreate { payee_id: null, amount }` |
| Payee share | `SplitShareCreate { payee_id: UUID, amount }` |
| Linked transactions (payee) | `SplitShareCreate.settlement_transaction_ids: [UUID]` (each full amount) |
| Forgiven amount (payee) | `SplitShareCreate.forgiven_amount` |
| Inline new payee | `POST /payees { name }` (before submit; returns `payee_id`) |
| Notes | `SplitCreate.notes` |

The `BundleCreate` / `POST /splits/bundle` endpoint is **not used** by this flow.
That endpoint remains available via the existing "Bundle as Split" CTA on the
Transactions page.

---

## Backend Changes Required

The existing `POST /splits` only accepts bare shares (`payee_id`, `amount`, `notes`)
and creates everything pending; settlement and forgiveness are separate follow-up
endpoints. To make this drawer atomic, extend the create path:

1. **`SplitShareCreate` schema** — add two optional fields:
   - `settlement_transaction_ids: list[UUID] = []`
   - `forgiven_amount: Decimal = 0`
   (`SettleRequest` / `ForgiveRequest` and their standalone endpoints stay unchanged for
   the SplitDrawer's post-hoc editing.)

2. **`create_split` handler** — within the same transaction that already creates the
   split + shares + `SplitExpense` rows, for each share also:
   - Validate every `settlement_transaction_id`: exists, belongs to the user, not
     deleted, `type = income`, and **not already linked to any settlement** (the same
     409 check `settle_share` does at [splits.py:487-497](backend/app/routers/splits.py#L487-L497)).
   - Insert a `SplitShareSettlement` row per linked transaction crediting its **full
     amount** (mirror the bundle path).
   - Enforce `Σ(settlement amounts) + forgiven_amount ≤ share.amount`
     (this is the server-side twin of the inline forgive-overflow rule). Reject the
     whole request with 422 if violated.
   - Set `forgiven_amount` and derive status with the existing `_derive_status` helper.
   - Reject `settlement_transaction_ids` / `forgiven_amount > 0` on the **null-payee
     (own) share** — the user does not settle their own share.
   - Run the existing `validate_invariant` before commit.
   Any failure raises `HTTPException` before `session.commit()`, so SQLAlchemy's
   transaction rolls the entire thing back — no partial split.

3. **No new migration** — `settlements` and `forgiven_amount` already exist on the
   `split_shares` / `split_share_settlements` tables; this only changes the request
   schema and the create handler.

4. **Tests** — add cases to `test_splits.py`: create-with-settlements, create-with-
   forgiveness, the `paid + forgiven > share` rejection, the already-linked-income 409,
   and rejection of settlements on the own share. Verify rollback (no `Split` row
   persists) on each failure path.

---

## Component Architecture (suggested)

```
CreateSplitDrawer.tsx           ← top-level drawer, owns all form state
  ExpenseTransactionPicker.tsx  ← Section 1 (search + multi-select)
  MyShareSection.tsx            ← Section 2 (amount + "use remainder")
  PayeeShareList.tsx            ← Section 3 (array of cards)
    PayeeShareCard.tsx          ← one payee card
      LinkTransactionPanel.tsx  ← inline settlement picker per payee
  BalanceSummary.tsx            ← Section 4 (read-only totals)
```

Form state lives in `CreateSplitDrawer` and is passed down as props. Settlements and
forgiveness are kept in the per-share form state and serialized into the single
`POST /splits` body on submit — there are no follow-up `settle`/`forgive` calls.

---

## UI/UX Notes

- Follow existing design tokens: `kk-card`, `kk-panel`, `kk-input`, `kk-btn-ghost`,
  `kk-chip`, colour semantics (`text-positive-dim`, `text-negative-dim`,
  `text-warning-dim`, `text-fg-muted`).
- The drawer uses the shared `<Drawer>` component (right-slide, backdrop, close × button).
- On mobile the "Link Transaction Panel" expands inline (not a nested drawer) to avoid
  z-index / scroll conflicts.
- "Use remainder" buttons are secondary ghost-style, positioned to the right of their
  associated amount input.
- Forgive toggle starts collapsed to reduce initial visual noise.
- Transactions already belonging to another split are grayed out in the picker with
  a tooltip "Already in a split".

---

## Out of Scope (not in this spec)

- Editing an existing split (covered by SplitDrawer).
- Linking a settlement from the user's own share perspective (the user is the one
  who paid the original expense; others pay the user back).
- Splitting across different currencies.
- Auto-suggesting payees or amounts based on past splits.

---

## Implementation Tasks

Per the project's one-task-per-commit rule, this ships as **two sequential tasks**
(backend first — the frontend depends on the extended contract):

### Task A — Backend: atomic `POST /splits` with inline settlements + forgiveness
- Extend `SplitShareCreate` with `settlement_transaction_ids` and `forgiven_amount`.
- Extend the `create_split` handler with the validation + insertion logic in
  [Backend Changes Required](#backend-changes-required), all inside the existing
  single transaction.
- Add the `test_splits.py` cases listed there (including rollback assertions).
- No migration.
- **Validate:** `py_compile` + `pytest tests/test_splits.py -x -q`. Commit.

### Task B — Frontend: Create Split drawer
- "+ Create Split" button on the Splits page header.
- `CreateSplitDrawer` + child components per
  [Component Architecture](#component-architecture-suggested).
- Inline payee creation, settlement linking, forgiveness, live balance check, and
  submit gating.
- Update `frontend/src/api/splits.ts` (`SplitShareCreate` type + a `useCreateSplit`
  mutation) and the MSW handler in `handlers.ts`.
- Component tests for the drawer (mirroring `BundleAsSplitModal.test.tsx`).
- **Validate:** `bun run build` (zero new TS errors in touched files) + the new tests.
  Commit.
