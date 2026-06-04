# Pre-existing Test Failures

These failures were present on the unmodified `master` branch (verified via `git stash` baseline). They were not introduced by the bug-fix work.

---

## TEST-1: `test_expense_calculator.py` — stale `settled_at` / `forgiven_at` kwargs

**File:** `backend/tests/test_expense_calculator.py`

**Scope:** 5 out of 7 tests failing

**Issue:**
The test helper `_make_split_with_shares` passed `settled_at=` and `forgiven_at=` to the `SplitShare(...)` constructor:
```python
share = SplitShare(
    …
    settled_at=now if status == SplitShareStatus.settled else None,
    forgiven_at=now if status == SplitShareStatus.forgiven else None,
)
```
These columns were removed from the `SplitShare` model in the split-settlement refactor (settlement timestamps now live in the `SplitShareSettlement` join table). SQLAlchemy raises `TypeError: 'settled_at' is an invalid keyword argument for SplitShare`.

**Fix:**
1. Removed the two stale kwargs and the now-unused `now = datetime.now(UTC)` line from the helper.
2. Added `_make_payee()` helper and replaced `friend_id = uuid.uuid4()` with real `Payee` rows in all five affected tests (the FK constraint `SplitShare.payee_id → payees.id` requires a real row; using a random UUID was masked before because the `TypeError` fired first).

**Status:** ✅ Fixed

---

## TEST-2: `test_accounts.py::test_create_account_basic` — Decimal `"0"` vs `"0.00"`

**File:** `backend/tests/test_accounts.py`

**Issue:**
```python
assert data["opening_balance"] == "0"   # ← fails
assert data["current_balance"] == "0"   # ← fails
```
The test was written when the Decimal default may have serialized differently. The DB stores `NUMERIC(15,2)` with a default of `0`; when read back, SQLAlchemy returns `Decimal('0.00')`. Pydantic v2 serializes `Decimal('0.00')` as the string `"0.00"`, not `"0"`.

**Fix:**
Updated assertions to match actual API output:
```python
assert data["opening_balance"] == "0.00"
assert data["current_balance"] == "0.00"
```

**Status:** ✅ Fixed

---

## TEST-3: `test_splits.py::test_create_split_happy_path` — `paid_amount` serializes as `"0"` not `"0.00"`

**File:** `backend/app/routers/splits.py` + `backend/tests/test_splits.py`

**Issue:**
The test asserts `share["paid_amount"] == "0.00"` for a freshly-created share with no settlements. `paid_amount` is computed in `_share_response` as:
```python
paid = sum((s.amount for s in settlements), Decimal("0"))
```
When `settlements` is empty, `Decimal("0")` serializes as `"0"` — missing the two decimal places.

**Fix:**
Changed the initial value in the `sum()` call to `Decimal("0.00")`:
```python
paid = sum((s.amount for s in settlements), Decimal("0.00"))
```
This ensures the zero case serializes consistently as `"0.00"` (matching all other Decimal currency fields in the API).

**Status:** ✅ Fixed

---

## TEST-4: `test_splits.py::test_get_split_cross_user_404` — AttributeError in baseline

**File:** `backend/tests/test_splits.py`

**Issue:**
`AttributeError` raised during test setup — exact root cause traced to greenlet/asyncio engine reuse when tests run in batch (the `MissingGreenlet` pre-existing issue). The test passes in isolation.

**Resolution:** 🔄 Known pre-existing issue — not fixed here. The test suite has a greenlet/asyncio engine-reuse problem that causes `MissingGreenlet` cascades when multiple test files share an engine fixture. This is a test infrastructure issue, not a product bug.

**Status:** 🔄 Known issue (not fixed in this cycle)

---

## TEST-5: Several `test_export.py` failures

**File:** `backend/tests/test_export.py`

**Issue:**
Multiple test failures in the export suite when run as part of a batch. When run in isolation, individual tests pass. Root cause is the same greenlet/asyncio engine-reuse problem (TEST-4).

**Resolution:** 🔄 Known pre-existing issue.

**Status:** 🔄 Known issue (not fixed in this cycle)
