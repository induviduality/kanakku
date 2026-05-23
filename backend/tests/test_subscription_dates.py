"""Unit tests for subscription_dates service (no DB)."""

from dataclasses import dataclass
from datetime import date, datetime, timezone

from app.models.subscription import BillingCycle
from app.services.subscription_dates import compute_next_billing_date, subscription_status


@dataclass
class _FakeSub:
    billing_cycle: BillingCycle
    billing_day: int
    last_billed_at: datetime | None = None


def _make_sub(
    billing_cycle: BillingCycle,
    billing_day: int,
    last_billed_at: datetime | None = None,
) -> _FakeSub:
    return _FakeSub(
        billing_cycle=billing_cycle,
        billing_day=billing_day,
        last_billed_at=last_billed_at,
    )


# ── compute_next_billing_date ──────────────────────────────────────────────────

def test_monthly_no_last_billed_before_day() -> None:
    sub = _make_sub(BillingCycle.monthly, billing_day=20)
    # as_of=May 10; billing day 20 hasn't passed yet → May 20
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 10))
    assert result == date(2026, 5, 20)


def test_monthly_no_last_billed_after_day() -> None:
    sub = _make_sub(BillingCycle.monthly, billing_day=5)
    # as_of=May 10; billing day 5 passed → June 5
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 10))
    assert result == date(2026, 6, 5)


def test_monthly_with_last_billed() -> None:
    last = datetime(2026, 4, 15, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.monthly, billing_day=15, last_billed_at=last)
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 10))
    assert result == date(2026, 5, 15)


def test_weekly_no_last_billed() -> None:
    sub = _make_sub(BillingCycle.weekly, billing_day=0)  # Monday
    # May 20 2026 is a Wednesday (weekday=2); next Monday is May 25
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 20))
    assert result == date(2026, 5, 25)


def test_weekly_same_day() -> None:
    sub = _make_sub(BillingCycle.weekly, billing_day=2)  # Wednesday
    # as_of is already Wednesday and never billed → next billing is today (Wednesday)
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 20))
    assert result == date(2026, 5, 20)


def test_weekly_with_last_billed() -> None:
    last = datetime(2026, 5, 13, tzinfo=timezone.utc)  # Wednesday
    sub = _make_sub(BillingCycle.weekly, billing_day=2, last_billed_at=last)
    result = compute_next_billing_date(sub)
    assert result == date(2026, 5, 20)


def test_daily_no_last_billed() -> None:
    sub = _make_sub(BillingCycle.daily, billing_day=1)
    # Never billed: next billing on or after today = today itself
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 10))
    assert result == date(2026, 5, 10)


def test_daily_with_last_billed() -> None:
    last = datetime(2026, 5, 9, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.daily, billing_day=1, last_billed_at=last)
    result = compute_next_billing_date(sub)
    assert result == date(2026, 5, 10)


def test_quarterly_no_last_billed() -> None:
    sub = _make_sub(BillingCycle.quarterly, billing_day=1)
    # May is in Q2 (Apr-Jun). Q2 starts April 1. billing_day=1 → April 1.
    # April 1 is before May 20, so next quarter (Q3 = July 1).
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 20))
    assert result == date(2026, 7, 1)


def test_quarterly_with_last_billed() -> None:
    last = datetime(2026, 4, 1, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.quarterly, billing_day=1, last_billed_at=last)
    result = compute_next_billing_date(sub)
    assert result == date(2026, 7, 1)


def test_yearly_no_last_billed() -> None:
    sub = _make_sub(BillingCycle.yearly, billing_day=1)  # Jan 1
    result = compute_next_billing_date(sub, as_of=date(2026, 5, 20))
    assert result == date(2027, 1, 1)


def test_yearly_with_last_billed() -> None:
    last = datetime(2026, 1, 1, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.yearly, billing_day=1, last_billed_at=last)
    result = compute_next_billing_date(sub)
    assert result == date(2027, 1, 1)


# ── subscription_status ───────────────────────────────────────────────────────

def test_status_upcoming() -> None:
    last = datetime(2026, 5, 1, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.monthly, billing_day=1, last_billed_at=last)
    # next = June 1; as_of = May 20 → upcoming
    assert subscription_status(sub, as_of=date(2026, 5, 20)) == "upcoming"


def test_status_due_soon() -> None:
    last = datetime(2026, 5, 1, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.monthly, billing_day=1, last_billed_at=last)
    # next = June 1; as_of = May 30 (2 days away) → due_soon
    assert subscription_status(sub, as_of=date(2026, 5, 30)) == "due_soon"


def test_status_overdue() -> None:
    last = datetime(2026, 4, 1, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.monthly, billing_day=1, last_billed_at=last)
    # next = May 1; as_of = May 20 → overdue
    assert subscription_status(sub, as_of=date(2026, 5, 20)) == "overdue"


def test_status_due_today() -> None:
    last = datetime(2026, 4, 20, tzinfo=timezone.utc)
    sub = _make_sub(BillingCycle.monthly, billing_day=20, last_billed_at=last)
    # next = May 20; as_of = May 20 → due_soon (0 days away)
    assert subscription_status(sub, as_of=date(2026, 5, 20)) == "due_soon"
