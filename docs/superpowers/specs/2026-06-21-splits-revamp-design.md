# Splits Revamp — Design Spec
Date: 2026-06-21

## Goal
Consolidate the only path to create or edit a split into the Splits page drawer. Remove the
"Bundle as Split" flow from the Transactions page. Restructure both drawers so the UI is
clean, readable, and has a clear visual hierarchy.

---

## Scope

### Removed
- `BundleAsSplitModal` component and its test file — deleted entirely
- `useBundleSplit` import and usage in `Transactions.tsx`
- "Bundle as Split" sticky CTA from `Transactions.tsx`
- The `forgiveOpen` / `forgiven` sub-panel from each payee card in `CreateSplitDrawer`
  (forgiveness is a post-creation operation; set it in SplitDrawer after the split exists)
- The 5-row "Balance check" `DrawerSection` replaced by a compact inline indicator

### Unchanged
- Backend `/splits/bundle` endpoint — left in place (harmless, no frontend consumer)
- Two-drawer model: `CreateSplitDrawer` for creation, `SplitDrawer` for view/edit
- All API hooks: `useCreateSplit`, `useSettleShare`, `useForgiveShare`, `usePatchShare`,
  `useUnsettleShare`, `useUnlinkSettlement`, `useDeleteSplit`
- Settlement linking at creation time — kept per payee card (user often records a payment
  immediately after adding a payee)
- Inline payee creation via Autocomplete `onInlineCreate` — kept in both drawers

---

## CreateSplitDrawer — New Structure

Single scrollable form, five logical blocks in this order:

### 1. Notes
- `<input type="text">` at the top, placeholder `"e.g. Goa trip dinner"`
- Optional; becomes the split's display title

### 2. Expenses
- `TransactionPicker` (expense type, multi-select)
- Excludes IDs already used in existing splits
- Shows `Total: ₹X` in small text below when ≥1 selected

### 3. Shares
One unified section containing all shares.

**"Your share" card** — always first, not removable:
- Label: `Your share`
- Amount input + `Use remainder` text button
- No payee picker

**Payee cards** (one per added person):
- `Autocomplete` (payee picker with inline create, `type: 'person'`)
- Amount input + `Use remainder` text button
- `+ Link payments` collapsed affordance below the amount:
  - Clicking opens `TransactionPicker` (income type, multi-select)
  - Excludes IDs already staged in other payee cards and used in existing splits
  - Once transactions are selected, renders them as compact rows:
    `<description>  ₹<amount>  ×`
  - × unlinks that transaction
  - TransactionPicker stays open until user clicks away or a "Done" affordance
- `×` button (top-right of card) to remove the payee card entirely

`+ Add payee` button beneath all cards.

### 4. Balance indicator
Replaces the old five-row `DrawerSection`. Two lines only:

```
Allocated   ₹800 / ₹1,200   ████████░░░░  (progress bar)
Your net expense   ₹600
```

- Progress bar fill: green when allocated === total, red when over or under
- `Allocated` amount text: green when exact, `text-negative-dim` when mismatched
- `Your net expense` = your share amount (forgiveness not tracked at creation)

### 5. Create Split button
- Full-width primary button, disabled until: ≥1 expense selected, all shares valid, balance exact

---

## SplitDrawer — New Structure

### Header
- Drawer title: split notes or `"Split expense"` fallback
- Trash icon button in header (top-right) → ConfirmDialog to delete split

### Summary panel
Two rows inside a `kk-panel`:
- `Total expense   ₹X`
- `Your net expense   ₹Y` (red, semibold)

### Shares section
Each share renders as a **collapsible row**. Only one share may be expanded at a time —
expanding a new share collapses the previously open one.

**Collapsed row:**
```
[Payee name / "Your share"]   ₹500   [status chip]   [›]
```
- Clicking anywhere on the row toggles expansion
- Chevron rotates 90° when expanded

**Expanded area** (rendered below the header row, inside the same card):

1. **Activity summary** (only if paid > 0 or forgiven > 0):
   `Paid ₹200 · Forgiven ₹50 · Remaining ₹250` — small muted text

2. **Settlement list** (only if settlements exist):
   Each settlement as a compact row:
   `<description>  ₹<amount>  ·  <date>   ×`
   `×` calls `useUnlinkSettlement`

3. **Action row** (text links, separated by `·`):
   - For payee shares: `Record payment · Forgive · Edit · Reset`
   - For "Your share" (null payee): `Edit` only
   - Only one action form is visible at a time; activating a new action closes the current one
   - Reset: rendered in `text-negative-dim`, clicking opens `ConfirmDialog` (not inline form)

4. **Active action form** (appears below the action row):

   **Record payment:**
   - `TransactionPicker` (income type, single-select)
   - Amount input pre-filled with `min(txn.amount, remaining)`, capped at remaining
   - `Cancel` · `Confirm` buttons

   **Forgive:**
   - Amount input, pre-filled with remaining
   - `All remaining` shortcut link
   - `Cancel` · `Set` buttons

   **Edit:**
   - `Autocomplete` for payee (with inline create)
   - Amount input
   - `Cancel` · `Save` buttons

### Metadata accordion
Collapsed by default. Label: `Details`. At the very bottom of the drawer, below all shares.

Contents when expanded:
- One row per linked expense transaction ID (truncated to 16 chars + `…`)
- Split ID (truncated)
- Created date (localised)

---

## Label / Copy Changes

| Old | New |
|-----|-----|
| `Blank Payee` (null payee fallback) | `Your share` |
| `Link income transaction` (settle form heading) | `Link settlement` |
| `Set forgiven` (forgive confirm button) | `Set` |
| `Reset share` (confirm dialog title) | `Reset share` (unchanged) |

---

## Files Affected

| File | Change |
|------|--------|
| `frontend/src/components/BundleAsSplitModal.tsx` | Delete |
| `frontend/src/components/BundleAsSplitModal.test.tsx` | Delete |
| `frontend/src/pages/Transactions.tsx` | Remove BundleAsSplitModal import, state, and CTA |
| `frontend/src/components/drawers/CreateSplitDrawer.tsx` | Full restructure per spec |
| `frontend/src/components/drawers/SplitDrawer.tsx` | Full restructure per spec |

Tests for both drawers will be updated to match the new structure.

---

## Out of Scope
- Editing which expense transactions are linked to an existing split (post-creation, metadata only)
- Adding or removing shares after a split is created
- Backend changes (no new endpoints, no schema changes)
- Merging CreateSplitDrawer and SplitDrawer into a single component
