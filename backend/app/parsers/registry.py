"""Parser registry: detect which bank parser can handle a given PDF."""

import io

from app.parsers.banks.hdfc import HDFCParser
from app.parsers.base import BaseParser

_PARSERS: list[type[BaseParser]] = [
    HDFCParser,
]


def detect_parser(pdf: io.BytesIO) -> BaseParser | None:
    """Return the first parser that claims it can handle this PDF, or None."""
    for parser_cls in _PARSERS:
        pdf.seek(0)
        if parser_cls.can_parse(pdf):
            pdf.seek(0)
            return parser_cls()
    return None
