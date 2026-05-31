"""CLI tool to diagnose how pdfplumber sees a bank statement PDF.

Shows all tables, row counts, date row counts, and raw text per page.
Useful for debugging when the parser returns fewer records than expected.

Usage:
    uv run python scripts/diagnose_statement.py --path <pdf_path> [--password <password>]
"""

import argparse
import io
import re
import sys

DATE_PATTERN = re.compile(r"^\d{2}[/\-]\d{2}[/\-]\d{2,4}$")


def main() -> None:
    parser = argparse.ArgumentParser(description="Diagnose a bank statement PDF")
    parser.add_argument("--path", required=True, help="Path to the PDF file")
    parser.add_argument("--password", default=None, help="PDF password if protected")
    args = parser.parse_args()

    try:
        import pdfplumber
        import pikepdf
    except ImportError as e:
        print(f"ERROR: missing dependency — {e}", file=sys.stderr)
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

    with pdfplumber.open(unlocked) as doc:
        for i, page in enumerate(doc.pages):
            tables = page.extract_tables()
            print(f"\n=== PAGE {i + 1}: {len(tables)} table(s) ===")

            for j, table in enumerate(tables):
                if not table:
                    continue

                date_rows = [
                    r for r in table
                    if r and DATE_PATTERN.match(str(r[0] or "").strip())
                ]
                print(f"\n  [table {j}] {len(table)} rows total, {len(date_rows)} date rows")
                print(f"  header : {table[0]}")

                if date_rows:
                    print(f"  first  : {date_rows[0]}")
                    print(f"  last   : {date_rows[-1]}")
                else:
                    print("  (no date rows — skipped by parser)")

            if not tables:
                text = (page.extract_text() or "").strip()
                preview = text[:300].replace("\n", " ↵ ")
                print(f"  (no tables — raw text preview: {preview})")


if __name__ == "__main__":
    main()
