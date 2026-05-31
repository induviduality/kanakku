"""Ollama LLM client implementation using the ollama Python package."""

import re

from ollama import AsyncClient

from app.llm.base import BankCandidate, GPayRecord, LLMClient, Match

_FENCE_RE = re.compile(r"```[a-z]*\n?(.*?)```", re.DOTALL)


def _strip_fences(text: str) -> str:
    m = _FENCE_RE.search(text)
    return m.group(1).strip() if m else text.strip()


class OllamaClient(LLMClient):
    """Calls a local Ollama server."""

    def __init__(self, host: str, model: str) -> None:
        self._host = host
        self._model = model

    def _client(self) -> AsyncClient:
        return AsyncClient(host=self._host)

    # ── suggest_category ──────────────────────────────────────────────────────

    async def suggest_category(
        self,
        payee_name: str,
        description: str,
        available_categories: list[str],
    ) -> str | None:
        if not available_categories:
            return None

        category_list = "\n".join(f"- {c}" for c in available_categories)
        prompt = (
            f"You are a personal finance assistant.\n"
            f"Payee: {payee_name}\n"
            f"Description: {description}\n\n"
            f"Pick exactly ONE category from this list that best fits the transaction:\n"
            f"{category_list}\n\n"
            f"Reply with ONLY the category name, nothing else."
        )
        result = await self._ask(prompt)
        candidate = _strip_fences(result)
        if candidate in available_categories:
            return candidate

        # Retry with stricter prompt on first failure
        strict_prompt = (
            f"Reply with ONLY one of these exact strings (no punctuation, no explanation):\n"
            f"{category_list}\n\n"
            f"Transaction: payee={payee_name}, description={description}"
        )
        result = await self._ask(strict_prompt)
        candidate = _strip_fences(result)
        return candidate if candidate in available_categories else None

    # ── match_gpay_to_bank ────────────────────────────────────────────────────

    async def match_gpay_to_bank(
        self,
        gpay_records: list[GPayRecord],
        bank_candidates: list[list[BankCandidate]],
    ) -> list[Match]:
        matches: list[Match] = []
        for i, (gpay, candidates) in enumerate(zip(gpay_records, bank_candidates)):
            if not candidates:
                matches.append(Match(gpay_index=i, bank_index=-1))
                continue

            cand_list = "\n".join(
                f"{j}: date={c.date} amount={c.amount} desc={c.description}"
                for j, c in enumerate(candidates)
            )
            prompt = (
                f"GPay record: date={gpay.date} amount={gpay.amount} merchant={gpay.merchant}\n"
                f"Bank candidates (numbered from 0):\n{cand_list}\n\n"
                f"Reply with ONLY the index number (0-based) of the best matching bank candidate, "
                f"or -1 if none match. No explanation."
            )
            raw = await self._ask(prompt)
            idx = self._parse_int(raw, default=-1, lo=-1, hi=len(candidates) - 1)
            matches.append(Match(gpay_index=i, bank_index=idx))
        return matches

    # ── helpers ───────────────────────────────────────────────────────────────

    async def _ask(self, prompt: str) -> str:
        client = self._client()
        resp = await client.generate(model=self._model, prompt=prompt)
        return resp.response.strip()  # type: ignore[union-attr]

    @staticmethod
    def _parse_int(text: str, *, default: int, lo: int, hi: int) -> int:
        stripped = _strip_fences(text)
        try:
            val = int(stripped)
            if lo <= val <= hi:
                return val
        except (ValueError, TypeError):
            pass
        # Try extracting first integer from text
        m = re.search(r"-?\d+", stripped)
        if m:
            try:
                val = int(m.group())
                if lo <= val <= hi:
                    return val
            except ValueError:
                pass
        return default
