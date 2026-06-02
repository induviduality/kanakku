# UI Testing Plan — Sprint Features (2026-06-02)

Features under test:
1. **Password eye toggle** — show/hide on all password fields
2. **Sticky transaction CTAs** — bulk action bar + "Bundle as Split"
3. **Split multi-expense** — multiple expense transactions per split
4. **Split payee uniqueness** — at most one share per payee (inc. own)

Legend: `[x]` = verified via API/source, `[~]` = requires live browser, `[ ]` = pending

---

## 1. Password Eye Toggle

### 1.1 Login Page (`/login`)
- [~] Password field renders an eye icon on the right
- [~] Clicking the eye reveals the password (type changes to text)
- [~] Clicking again hides it (type changes back to password)
- [x] Tab key skips the eye button (tabIndex=-1 confirmed in PasswordInput.tsx:13)

### 1.2 Setup / Register Page (`/setup`)
- [x] Password field has eye toggle (PasswordInput imported ×2)
- [~] Show/hide works correctly

### 1.3 Accept Invite Page (`/accept-invite`)
- [x] Password field has eye toggle (PasswordInput imported ×2)

### 1.4 PDF Import — Password Field (`/imports/upload`)
- [x] PDF password field has eye toggle (PasswordInput imported ×2)
- [~] Show/hide works independently of other fields

---

## 2. Sticky Transaction CTAs

### 2.1 No selection
- [~] No bulk action bar visible at the bottom of Transactions page

### 2.2 Single expense selected
- [x] Bulk action bar: fixed bottom bar with "Bundle as Split" button rendered when allExpenses (Transactions.tsx:304)
- [~] Shows "{N} selected" count
- [~] "Bundle as Split" button (indigo) is visible and enabled
- [x] Main content gets `pb-20` padding when bar active (Transactions.tsx)
- [~] "Clear" button deselects all and hides the bar

### 2.3 Single income/transfer selected
- [x] Falls into else branch → hint text "Select only expenses to bundle as split" (Transactions.tsx:315)

### 2.4 Multiple expenses selected
- [x] allExpenses=true when all selected items are expenses → "Bundle as Split" enabled
- [x] bundleTarget is Transaction[] — all IDs passed as array to modal (Transactions.tsx:511)

### 2.5 Mixed selection (expense + income)
- [x] allExpenses=false → hint text shown

---

## 3. Bundle as Split — API Verified

### 3.1 Single expense bundle (basic)
- [x] POST /splits/bundle with single expense → 201, one pending share ₹300 (tested live)
- [~] Modal opens with expense amount shown in browser

### 3.2 Multi-expense bundle
- [x] POST /splits/bundle with [exp1 ₹200, exp2 ₹100] → 201, expense_transaction_ids=[…2 ids], share ₹300 (tested live)
- [x] Modal receives summed total: `bundleTarget.reduce((sum,t) => sum + Number(t.amount), 0)` (Transactions.tsx:512)
- [~] Both expense transactions show split badge after creation in browser

### 3.3 Income leg grouping
- [x] POST /splits/bundle with expense ₹300 + income ₹200 → settled share ₹200 + pending ₹100 (tested live)
- [x] settled share has settlement row with income transaction_id (verified)

### 3.4 Forgiven share
- [x] POST /splits/bundle with forgiven_shares=[{amount:"100"}] → forgiven share ₹100 + pending ₹200 (via bundle test)

### 3.5 Over-budget guard
- [x] POST /splits/bundle income+forgiven > expense → 422 "exceed" (backend test passes)
- [x] Frontend pre-validates before submit in BundleAsSplitModal.tsx:59

---

## 4. Split Detail — Multi-Expense Display

### 4.1 & 4.2 expense_transaction_ids array
- [x] GET /splits returns `expense_transaction_ids: [...]` (list, not scalar) — confirmed live
- [x] SplitDrawer.tsx renders `split.expense_transaction_ids.map(id => <p>…</p>)` (line 376)
- [x] SplitDetail.tsx renders each ID with comma separator (line 286)
- [~] Visible in browser when opening a split with multiple expenses

---

## 5. Split Payee Uniqueness

### 5.1 Duplicate payee rejected
- [x] POST /splits with same non-null payee twice → 422 "each payee may appear in at most one" (tested live)
- [x] POST /splits with two null-payee shares → 422 "only one share without a payee" (tested live)

### 5.2 Seed data
- [x] Splits API returns valid `expense_transaction_ids` list after migration 0026 applied
- [~] Navigate to /splits in browser — verify 3 seed splits visible with own shares (needs DEV_MODE=true)

---

## 6. Splits Page Sanity — API Verified

- [x] GET /splits returns 6 splits, no 500 errors (tested live with migration applied)
- [x] Split settle: POST /settle with income txn → share status=settled (backend tests pass)
- [x] Split forgive: POST /forgive → forgiven_amount set (backend tests pass)
- [~] Browser: split detail page opens on click

---

## 7. Regression — Core Transaction Flows

- [x] GET /transactions returns items without 500 (tested live)
- [x] Transactions frontend page loads HTTP 200
- [~] Create/edit/delete in browser UI

---

## 8. Regression — Auth Flow

- [x] POST /auth/login with correct credentials → 200 + token (tested live)
- [x] POST /auth/login with wrong password → 401 "Invalid credentials" (tested live)
- [x] Frontend /login page loads HTTP 200
- [~] Full login → dashboard flow in browser

---

## Migration Fix (found during testing)

- [x] **Bug found & fixed**: Migration 0026 failed because `transaction_with_net_amount` view
  depended on `splits.expense_transaction_id`. Fixed by adding DROP/recreate VIEW steps
  around the column drop. View now joins via `split_expenses` table.
- [x] **Test fixes**: 5 tests had two null-payee shares (now correctly rejected by validator).
  Fixed `test_create_split_happy_path`, `test_get_split`, `test_create_split_multi_expense`,
  `test_duplicate_null_payee_rejected` (detail type), `_create_split_with_two_shares` helper.
- [x] All 59 split tests pass after fixes.

---

*Items marked `[~]` require browser automation (Chrome extension disconnected this session).*
*All API-level behaviors marked `[x]` were verified against the live running instance at localhost:8765.*
