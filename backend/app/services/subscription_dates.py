from calendar import monthrange
from datetime import date, timedelta
from typing import TYPE_CHECKING, cast

from dateutil.relativedelta import relativedelta

from app.models.subscription import BillingCycle

if TYPE_CHECKING:
    from app.models.subscription import Subscription

_DUE_SOON_DAYS = 3


def _cycle_delta(cycle: BillingCycle) -> relativedelta:
    match cycle:
        case BillingCycle.daily:
            return relativedelta(days=1)
        case BillingCycle.weekly:
            return relativedelta(weeks=1)
        case BillingCycle.monthly:
            return relativedelta(months=1)
        case BillingCycle.quarterly:
            return relativedelta(months=3)
        case BillingCycle.yearly:
            return relativedelta(years=1)


def _first_occurrence(cycle: BillingCycle, billing_day: int, after: date) -> date:
    """Return the first billing date strictly after `after`."""
    match cycle:
        case BillingCycle.daily:
            return after + timedelta(days=1)

        case BillingCycle.weekly:
            # billing_day: 0=Monday … 6=Sunday
            days_ahead = billing_day - after.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return after + timedelta(days=days_ahead)

        case BillingCycle.monthly:
            # billing_day: 1–31 (day of month)
            d = min(billing_day, monthrange(after.year, after.month)[1])
            candidate = after.replace(day=d)
            if candidate > after:
                return candidate
            next_m = cast(date, after + relativedelta(months=1))
            d = min(billing_day, monthrange(next_m.year, next_m.month)[1])
            return next_m.replace(day=d)

        case BillingCycle.quarterly:
            # billing_day: 1–92 (day offset within quarter, 1-based)
            q = (after.month - 1) // 3
            q_start = date(after.year, q * 3 + 1, 1)
            try:
                candidate = q_start + timedelta(days=billing_day - 1)
            except (ValueError, OverflowError):
                candidate = q_start
            if candidate > after:
                return candidate
            next_q = cast(date, q_start + relativedelta(months=3))
            try:
                return next_q + timedelta(days=billing_day - 1)
            except (ValueError, OverflowError):
                return next_q

        case BillingCycle.yearly:
            # billing_day: 1–365 (day of year, 1-based)
            year = after.year
            try:
                candidate = date(year, 1, 1) + timedelta(days=billing_day - 1)
            except (ValueError, OverflowError):
                candidate = date(year, 12, 31)
            if candidate > after:
                return candidate
            try:
                return date(year + 1, 1, 1) + timedelta(days=billing_day - 1)
            except (ValueError, OverflowError):
                return date(year + 1, 12, 31)


def compute_next_billing_date(sub: "Subscription", as_of: date | None = None) -> date:
    """Return the next due date for the subscription.

    If last_billed_at is set, the next due date is one cycle after that (and may
    be in the past if the subscription is overdue — the "first unpaid cycle"
    semantic is intentional so the UI can show which specific cycle was missed).
    If never billed, returns the first occurrence on or after today derived
    from billing_day.
    """
    if sub.last_billed_at is not None:
        anchor = (
            sub.last_billed_at.date()
            if hasattr(sub.last_billed_at, "date")
            else sub.last_billed_at
        )
        return cast(date, anchor + _cycle_delta(sub.billing_cycle))

    today = as_of or date.today()
    # "first occurrence on or after today" = first occurrence strictly after yesterday
    return _first_occurrence(sub.billing_cycle, sub.billing_day, today - timedelta(days=1))


def subscription_status(sub: "Subscription", as_of: date | None = None) -> str:
    """Return 'overdue', 'due_soon', or 'upcoming'."""
    today = as_of or date.today()
    next_date = compute_next_billing_date(sub, today)
    if next_date < today:
        return "overdue"
    if next_date <= today + timedelta(days=_DUE_SOON_DAYS):
        return "due_soon"
    return "upcoming"
