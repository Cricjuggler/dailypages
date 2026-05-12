"""Anthropic Claude wrapper.

Centralizes config, prompt-cache markers, and JSON parsing so agents stay focused
on their prompts instead of plumbing.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from anthropic import Anthropic
from anthropic.types import MessageParam, TextBlockParam

from app.config import get_settings

log = logging.getLogger(__name__)

# Anthropic prompt-caching marker — applied to system prompts that don't change
# per-call (book context, style profile). Enables 10x cheaper repeated calls
# during a multi-chapter rewrite.
_CACHE_CONTROL: dict[str, Any] = {"type": "ephemeral"}


def _client() -> Anthropic:
    settings = get_settings()
    if not settings.claude_configured:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set — Phase 5 endpoints require Claude credentials."
        )
    return Anthropic(api_key=settings.anthropic_api_key)


def _system_blocks(*parts: tuple[str, bool]) -> list[TextBlockParam]:
    """Build a system prompt as cache-marked blocks.

    Each part is (text, cacheable). Cacheable parts are marked ephemeral so
    Anthropic caches them across calls in the same 5-minute window.
    """
    blocks: list[TextBlockParam] = []
    for text, cacheable in parts:
        block: dict[str, Any] = {"type": "text", "text": text}
        if cacheable:
            block["cache_control"] = _CACHE_CONTROL
        blocks.append(block)  # type: ignore[arg-type]
    return blocks


def call_claude(
    *,
    system: list[TextBlockParam] | str,
    user: str,
    fast: bool = False,
    max_tokens: int = 4000,
    temperature: float | None = None,
) -> str:
    """Synchronous Claude call returning the assistant's text body.

    `temperature` is None by default — Claude Opus 4.7 dropped the parameter
    and rejects requests that include it. Older models still accept it; pass
    explicitly when targeting one.
    """
    settings = get_settings()
    model = settings.anthropic_fast_model if fast else settings.anthropic_model
    messages: list[MessageParam] = [{"role": "user", "content": user}]
    kwargs: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": messages,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    response = _client().messages.create(**kwargs)
    text_parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
    return "\n".join(text_parts).strip()


def call_claude_json(
    *,
    system: list[TextBlockParam] | str,
    user: str,
    fast: bool = False,
    max_tokens: int = 4000,
    temperature: float | None = None,
) -> Any:
    """Like call_claude, but extracts the first JSON object/array from the response."""
    raw = call_claude(
        system=system, user=user, fast=fast, max_tokens=max_tokens, temperature=temperature
    )
    return _extract_json(raw)


def _extract_json(text: str) -> Any:
    text = text.strip()
    # Common: fenced ```json ... ```
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    # Try the whole thing first — most well-formed responses parse directly.
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Otherwise, find the FIRST top-level JSON value in the text. Detect array
    # vs object by which opener appears earliest, so an array starting with `[`
    # isn't mis-parsed as just its first inner `{`.
    obj_start = text.find("{")
    arr_start = text.find("[")
    candidates: list[tuple[int, str, str]] = []
    if obj_start != -1:
        candidates.append((obj_start, "{", "}"))
    if arr_start != -1:
        candidates.append((arr_start, "[", "]"))
    candidates.sort(key=lambda c: c[0])

    for start, opener, closer in candidates:
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
                continue
            if ch == opener:
                depth += 1
            elif ch == closer:
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError as e:
                        log.warning(
                            "JSON parse failed at offset %d: %s — head: %s",
                            start, e, candidate[:200]
                        )
                        break
    # Last-ditch — let the original error surface.
    return json.loads(text)


# Re-export so agents can build cache-marked system blocks without importing the
# Anthropic types directly.
build_system = _system_blocks
