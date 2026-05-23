"""Balance verification: compare parsed totals against statement header."""

from decimal import Decimal

from app.models.import_batch import VerificationStatus
from app.parsers.base import ParsedRecord, StatementHeader


def verify_balance(
    header: StatementHeader,
    records: list[ParsedRecord],
) -> VerificationStatus:
    """Check whether parsed transaction sum matches the statement's closing balance.

    Returns:
        VERIFIED      — opening + net == closing (within ±1 currency unit rounding)
        DISCREPANCY   — balances are present but don't reconcile
        INDETERMINATE — opening or closing balance missing from header
    """
    if header.opening_balance is None or header.closing_balance is None:
        return VerificationStatus.indeterminate

    net = Decimal("0")
    for rec in records:
        if rec.type == "income":
            net += rec.amount
        else:
            net -= rec.amount

    expected_closing = header.opening_balance + net
    diff = abs(expected_closing - header.closing_balance)

    if diff <= Decimal("1.00"):
        return VerificationStatus.verified
    return VerificationStatus.discrepancy
