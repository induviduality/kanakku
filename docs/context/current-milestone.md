# Milestone 4: Splits (in progress)

## Next Task: Task 4.6 — Frontend Split UIs

### What to implement

**4.6a — SplitSharesEditor (upfront split form)**
- components/SplitSharesEditor.tsx
  - List of share rows: payee (optional, from payees), amount input
  - Shows running sum + remaining (expense amount - sum of shares so far)
  - Add/remove share row buttons
  - Validates: sum must equal total before submit
- Integrate into TransactionForm.tsx: when type=expense, show "Split this expense" toggle; when toggled shows SplitSharesEditor

**4.6b — BundleAsSplitModal (retroactive)**
- components/BundleAsSplitModal.tsx
  - Triggered from transaction list bulk action "Bundle as Split" (one expense selected)
  - Optional: select income transactions from list (already in the modal or a picker)
  - Optional: add forgiven shares
  - POST /splits/bundle on submit

**4.6c — Bulk action wiring**
- pages/Transactions.tsx: wire up "Bundle as Split" bulk action button (was placeholder in M3)
- Only active when exactly one expense is selected

**4.6d — SplitDetail page**
- pages/SplitDetail.tsx
  - Shows split info + shares table
  - Per-share actions: Settle (modal with income txn picker), Forgive (confirm), Unsettle
  - Status badges: pending (yellow), settled (green), forgiven (gray)

**4.6e — API hooks**
- frontend/src/api/splits.ts
  - useCreateSplit, useBundleSplit, useGetSplit, useSettleShare, useForgiveShare, useUnsettleShare

**Tests**: per component (SplitSharesEditor, BundleAsSplitModal, SplitDetail)

### Files to create/modify
- frontend/src/api/splits.ts
- frontend/src/components/SplitSharesEditor.tsx
- frontend/src/components/BundleAsSplitModal.tsx
- frontend/src/pages/SplitDetail.tsx
- frontend/src/pages/TransactionForm.tsx (add split toggle)
- frontend/src/pages/Transactions.tsx (wire bundle action)
- frontend/src/router.tsx (add /splits/:id route)
- frontend/src/test/handlers.ts (MSW handlers for splits)
- tests per component
