"""Voyage AI embedding wrapper.

Voyage is Anthropic's recommended embedding partner. We use voyage-3-large
with output_dimension=1536 by default (configurable via env).
"""
from __future__ import annotations

import logging

import voyageai

from app.config import get_settings

log = logging.getLogger(__name__)


def _client() -> voyageai.Client:
    settings = get_settings()
    if not settings.embeddings_configured:
        raise RuntimeError(
            "VOYAGE_API_KEY not set — semantic analysis requires an embedding provider."
        )
    return voyageai.Client(api_key=settings.voyage_api_key)


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed a batch of documents (chapter bodies, etc.)."""
    if not texts:
        return []
    settings = get_settings()
    client = _client()
    out: list[list[float]] = []
    # Voyage caps batch size — be defensive on payloads from very long books.
    BATCH = 32
    for i in range(0, len(texts), BATCH):
        chunk = texts[i : i + BATCH]
        result = client.embed(
            texts=chunk,
            model=settings.voyage_embed_model,
            input_type="document",
            output_dimension=settings.voyage_embed_dim,
        )
        out.extend(result.embeddings)
    return out


def embed_query(text: str) -> list[float]:
    """Embed a single search query (uses input_type='query' for asymmetric retrieval)."""
    settings = get_settings()
    result = _client().embed(
        texts=[text],
        model=settings.voyage_embed_model,
        input_type="query",
        output_dimension=settings.voyage_embed_dim,
    )
    return result.embeddings[0]
