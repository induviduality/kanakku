"""Factory function that returns the appropriate LLMClient based on config."""

from app.config import Settings
from app.llm.base import LLMClient


def make_llm_client(settings: Settings) -> LLMClient:
    """Return OllamaClient or NullClient based on LLM_BACKEND env var."""
    backend = settings.llm_backend.lower()
    if backend == "ollama":
        from app.llm.ollama_client import OllamaClient
        return OllamaClient(
            host=settings.ollama_host,
            model=settings.llm_model,
        )
    # "none" or any unrecognised value → safe no-op
    from app.llm.null_client import NullClient
    return NullClient()
