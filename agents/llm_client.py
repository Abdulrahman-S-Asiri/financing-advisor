"""Thin LLM client. One place to configure provider/model.

Uses the Anthropic Messages API shape. Model and provider endpoint come from
env so switching between Anthropic and compatible providers is a config
change. Import is lazy so core/, mock OB, and the matching endpoint all run
without the anthropic package or an API key — only /advisor/chat needs it.
"""
from __future__ import annotations

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class LLMNotConfigured(RuntimeError):
    pass


def complete(system: str, user: str, max_tokens: int = 1000) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise LLMNotConfigured(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add a key "
            "to enable the advisor chat."
        )
    try:
        import anthropic  # lazy: keeps the deterministic path dependency-free
    except ImportError as exc:
        raise LLMNotConfigured("pip install anthropic") from exc

    base_url = os.environ.get("ANTHROPIC_BASE_URL", "").strip()
    client_kwargs = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = base_url

    client = anthropic.Anthropic(**client_kwargs)
    try:
        msg = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except anthropic.AuthenticationError as exc:
        raise LLMNotConfigured(
            "LLM provider rejected ANTHROPIC_API_KEY. Check that the key matches "
            "the configured provider endpoint."
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise LLMNotConfigured(
            "LLM provider is unreachable. Check ANTHROPIC_BASE_URL and network access."
        ) from exc
    except anthropic.RateLimitError as exc:
        raise LLMNotConfigured("LLM provider rate limit reached. Try again later.") from exc
    except anthropic.APIStatusError as exc:
        raise LLMNotConfigured(
            f"LLM provider returned HTTP {exc.status_code}. Check provider configuration."
        ) from exc

    return "".join(block.text for block in msg.content if block.type == "text")
