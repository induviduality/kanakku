# Backend — MEDIUM Severity Bugs

---

## MED-1: `forgive_share` overwrites instead of accumulating

**File:** `backend/app/routers/splits.py`

**Issue:**
`share.forgiven_amount = body.amount` replaces the forgiven amount outright. Calling `forgive(50)` then `forgive(100)` ends at 100, not 150. There is no increment-only API alternative.

**Resolution:** 🚫 Intentional — the endpoint is explicitly documented as set-semantics in both the schema docstring and `splits.ts`. No code change made.

**Status:** 🚫 Intentional

---

## MED-2: GPay match window construction is confusing

**File:** `backend/app/services/gpay_matcher.py`

**Issue:**
`window_end = midnight(rec.date) + _DATE_WINDOW + timedelta(days=1)` is difficult to read. Functionally correct but fragile.

**Resolution:** 🚫 Skipped — GPay scope excluded from this review cycle.

**Status:** 🚫 Skipped (GPay scope)

---

## MED-3: `_apply_balance_delta` treats `opening_balance` transactions as cumulative

**File:** `backend/app/routers/transactions.py`

**Issue:**
Two `opening_balance` transactions of ₹1000 each give `current_balance = opening_balance_field + 2000`. The `opening_balance` transaction type should ideally be unique per account (not additive).

**Resolution:** 🚫 Intentional spec drift — `opening_balance` as a `TransactionType` is an accepted evolution from the original TDD.

**Status:** 🚫 Intentional

---

## MED-4: `balance_verifier.verify_balance` treats transfers as expenses

**File:** `backend/app/services/balance_verifier.py`

**Issue (reported):**
`if rec.type == "income": net += amount else: net -= amount` — if `"transfer"` ever leaks through, it's counted as outflow.

**Resolution:** ✅ Confirmed safe — `ParsedRecord.type` is only ever `"income"` or `"expense"` (parsers normalize). Not a real bug.

**Status:** ✅ Confirmed safe (no change)

---

## MED-5: Logout does not verify session ownership

**File:** `backend/app/routers/auth.py`

**Issue:**
`logout` deleted any `SessionModel` matching the supplied `token_hash` without checking `user_id`. A user who somehow obtained another user's refresh token could revoke that session.

**Fix:**
Added `SessionModel.user_id == current_user.id` to the WHERE clause:
```python
result = await session.execute(
    select(SessionModel).where(
        SessionModel.token_hash == token_hash,
        SessionModel.user_id == current_user.id,   # ← added
    )
)
```

**Status:** ✅ Fixed

---

## MED-6: `DEV_MODE` auth bypass dangerous in shared deployments

**File:** `backend/app/dependencies.py`

**Issue:**
When `settings.dev_mode` is true and no `Authorization` header is present, every request authenticates as the seed user. If `DEV_MODE` leaks into a hosted environment, the instance becomes effectively unauthenticated.

**Resolution:** 🚫 Deferred — deployment concern, not a code bug. Suggest adding a startup warning or assertion when `DEV_MODE=true` and `DATABASE_URL` points to a non-local host.

**Status:** 🚫 Deferred
