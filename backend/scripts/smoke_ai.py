"""Smoke test — one Voyage embedding + one Claude (Haiku) call.

Confirms both AI providers are reachable and the keys are valid. Self-contained:
reads backend/.env directly and uses only the official SDKs, so it works without
running `pip install -e .` first (provided `pip install anthropic voyageai` is done).

Cost: well under $0.01.

Run from backend/:
    python scripts/smoke_ai.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def load_env(path: Path) -> None:
    """Tiny .env loader — only handles KEY=VALUE lines, no quoting/escaping.

    Overrides any pre-existing empty values in the environment (a common
    Windows/PowerShell snag where a profile or earlier session leaves keys
    set to empty strings). Non-empty pre-existing values are preserved so
    the user can still override .env from the shell when intentional.
    """
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        key, val = k.strip(), v.strip()
        existing = os.environ.get(key)
        if existing is None or existing == "":
            os.environ[key] = val


def main() -> int:
    load_env(Path(__file__).resolve().parent.parent / ".env")

    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    voyage_key = os.environ.get("VOYAGE_API_KEY", "")
    claude_model = os.environ.get("ANTHROPIC_FAST_MODEL", "claude-haiku-4-5-20251001")
    voyage_model = os.environ.get("VOYAGE_EMBED_MODEL", "voyage-3-large")
    voyage_dim = int(os.environ.get("VOYAGE_EMBED_DIM", "1536"))

    print(
        f"keys:   claude={'set' if anthropic_key else 'MISSING'}, "
        f"voyage={'set' if voyage_key else 'MISSING'}"
    )
    print(f"models: {claude_model} / {voyage_model} ({voyage_dim}-dim)")
    print()

    if not (anthropic_key and voyage_key):
        print("ERROR: set ANTHROPIC_API_KEY and VOYAGE_API_KEY in backend/.env")
        return 1

    # ---------- Voyage ----------
    print("[1/2] Voyage embed…")
    try:
        import voyageai

        client = voyageai.Client(api_key=voyage_key)
        result = client.embed(
            texts=["the present moment is the only ground we live on"],
            model=voyage_model,
            input_type="query",
            output_dimension=voyage_dim,
        )
        vec = result.embeddings[0]
        norm = sum(v * v for v in vec) ** 0.5
        print(f"      ok — dim={len(vec)}, |v|={norm:.3f}")
        if hasattr(result, "total_tokens"):
            print(f"      tokens: {result.total_tokens}")
    except ModuleNotFoundError as e:
        print(f"      FAIL: missing dep — {e}. Run: pip install voyageai")
        return 2
    except Exception as e:
        print(f"      FAIL: {type(e).__name__}: {e}")
        return 2

    # ---------- Claude ----------
    print("[2/2] Claude (Haiku)…")
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=anthropic_key)
        msg = client.messages.create(
            model=claude_model,
            max_tokens=30,
            temperature=0.3,
            system="Answer in exactly five words.",
            messages=[{"role": "user", "content": "What is reading slowly for?"}],
        )
        text = "".join(
            b.text for b in msg.content if getattr(b, "type", None) == "text"
        ).strip()
        print(f"      ok — reply: {text!r}")
        if hasattr(msg, "usage") and msg.usage is not None:
            print(
                f"      usage: input={msg.usage.input_tokens} "
                f"output={msg.usage.output_tokens}"
            )
    except ModuleNotFoundError as e:
        print(f"      FAIL: missing dep — {e}. Run: pip install anthropic")
        return 3
    except Exception as e:
        print(f"      FAIL: {type(e).__name__}: {e}")
        return 3

    print()
    print("Both providers verified. Total cost: well under $0.01.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
