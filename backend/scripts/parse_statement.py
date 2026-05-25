"""CLI tool to parse a bank statement PDF and print extracted transactions.

Usage:
    uv run python scripts/parse_statement.py --path <pdf_path> [--password <password>] [--credit-card]

Examples:
    uv run python scripts/parse_statement.py --path "~/Downloads/statement.pdf" --password "INDU0208"
    uv run python scripts/parse_statement.py --path "~/Downloads/cc.pdf" --password "INDU0208" --credit-card

Transactions are printed as JSON to stdout (pipeable).
Summary (record count, balances) goes to stderr.
"""

import argparse
import io
import json
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse a bank statement PDF")
    parser.add_argument("--path", required=True, help="Path to the PDF file")
    parser.add_argument("--password", default=None, help="PDF password if protected")
    parser.add_argument(
        "--credit-card",
        action="store_true",
        help="Skip opening/closing balance extraction (credit card statements)",
    )
    args = parser.parse_args()

    try:
        import pikepdf
    except ImportError:
        print("ERROR: pikepdf not installed", file=sys.stderr)
        sys.exit(1)

    try:
        from app.parsers.registry import detect_parser
    except ImportError:
        print("ERROR: run this from the backend/ directory", file=sys.stderr)
        sys.exit(1)

    with open(args.path, "rb") as f:
        raw = io.BytesIO(f.read())

    try:
        pdf = pikepdf.open(raw, password=args.password or "")
    except pikepdf.PasswordError:
        print("ERROR: wrong password", file=sys.stderr)
        sys.exit(1)

    unlocked = io.BytesIO()
    pdf.save(unlocked)
    unlocked.seek(0)

    statement_parser = detect_parser(unlocked)
    if statement_parser is None:
        print("ERROR: no parser could handle this PDF", file=sys.stderr)
        sys.exit(1)

    unlocked.seek(0)
    records = statement_parser.parse(unlocked)

    for r in records:
        print(json.dumps(r.to_dict(), indent=2))

    print(f"\n--- {len(records)} records ---", file=sys.stderr)

    if not args.credit_card:
        unlocked.seek(0)
        header = statement_parser.extract_statement_header(unlocked)
        opening = str(header.opening_balance) if header.opening_balance is not None else "not found"
        closing = str(header.closing_balance) if header.closing_balance is not None else "not found"
        print(f"    opening balance : {opening}", file=sys.stderr)
        print(f"    closing balance : {closing}", file=sys.stderr)


if __name__ == "__main__":
    main()
