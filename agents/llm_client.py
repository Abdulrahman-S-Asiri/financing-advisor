"""Thin LLM client. One place to configure provider/model.

Uses the Anthropic Messages API shape. Anthropic and DeepSeek both work
through this client because DeepSeek exposes an Anthropic-compatible endpoint.
Imports stay lazy so core/, mock OB, and the matching endpoint all run without
an API key -- only LLM-backed advisor behavior needs it.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class LLMNotConfigured(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderConfig:
    provider: str
    api_key: str
    model: str
    base_url: str = ""


DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic"
ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6"
DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-pro"


def _clean_env(name: str) -> str:
    return os.environ.get(name, "").strip()


def _looks_like_deepseek_compat() -> bool:
    base_url = _clean_env("ANTHROPIC_BASE_URL").lower()
    model = _clean_env("ANTHROPIC_MODEL").lower()
    return "deepseek" in base_url or model.startswith("deepseek")


def _anthropic_config() -> ProviderConfig | None:
    api_key = _clean_env("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    return ProviderConfig(
        provider="anthropic",
        api_key=api_key,
        model=_clean_env("ANTHROPIC_MODEL") or ANTHROPIC_DEFAULT_MODEL,
        base_url=_clean_env("ANTHROPIC_BASE_URL"),
    )


def _deepseek_config() -> ProviderConfig | None:
    api_key = _clean_env("DEEPSEEK_API_KEY")
    if api_key:
        return ProviderConfig(
            provider="deepseek",
            api_key=api_key,
            model=_clean_env("DEEPSEEK_MODEL") or DEEPSEEK_DEFAULT_MODEL,
            base_url=_clean_env("DEEPSEEK_BASE_URL") or DEEPSEEK_DEFAULT_BASE_URL,
        )

    # Backward compatibility with the existing .env style:
    # ANTHROPIC_API_KEY + ANTHROPIC_MODEL=deepseek-* + ANTHROPIC_BASE_URL=DeepSeek.
    if _clean_env("ANTHROPIC_API_KEY") and _looks_like_deepseek_compat():
        return ProviderConfig(
            provider="deepseek",
            api_key=_clean_env("ANTHROPIC_API_KEY"),
            model=_clean_env("ANTHROPIC_MODEL") or DEEPSEEK_DEFAULT_MODEL,
            base_url=_clean_env("ANTHROPIC_BASE_URL") or DEEPSEEK_DEFAULT_BASE_URL,
        )
    return None


def resolve_provider() -> ProviderConfig:
    """Resolve provider from env without importing the SDK.

    LLM_PROVIDER supports:
      auto      : Anthropic first, then DeepSeek
      anthropic : require Anthropic env
      deepseek  : require DeepSeek env, with compatibility fallback above
    """
    requested = (_clean_env("LLM_PROVIDER") or "auto").lower()
    if requested not in {"auto", "anthropic", "deepseek"}:
        raise LLMNotConfigured(
            "LLM_PROVIDER must be one of: auto, anthropic, deepseek."
        )

    anthropic_cfg = _anthropic_config()
    deepseek_cfg = _deepseek_config()

    if requested == "anthropic":
        if anthropic_cfg is None:
            raise LLMNotConfigured("ANTHROPIC_API_KEY is not set.")
        return anthropic_cfg

    if requested == "deepseek":
        if deepseek_cfg is None:
            raise LLMNotConfigured(
                "DEEPSEEK_API_KEY is not set. You may also use the compatibility "
                "form ANTHROPIC_API_KEY with ANTHROPIC_BASE_URL set to DeepSeek."
            )
        return deepseek_cfg

    # Auto mode: prefer a real Anthropic config. If ANTHROPIC_* points at
    # DeepSeek, treat it as the backward-compatible DeepSeek configuration.
    if anthropic_cfg is not None and not _looks_like_deepseek_compat():
        return anthropic_cfg
    if deepseek_cfg is not None:
        return deepseek_cfg
    raise LLMNotConfigured(
        "No LLM API key configured. Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY "
        "to enable the advisor chat."
    )


def complete(system: str, user: str, max_tokens: int = 1000) -> str:
    provider = resolve_provider()
    try:
        import anthropic  # lazy: keeps the deterministic path dependency-free
    except ImportError as exc:
        raise LLMNotConfigured("pip install anthropic") from exc

    client_kwargs = {"api_key": provider.api_key}
    if provider.base_url:
        client_kwargs["base_url"] = provider.base_url

    client = anthropic.Anthropic(**client_kwargs)
    try:
        msg = client.messages.create(
            model=provider.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
    except anthropic.AuthenticationError as exc:
        raise LLMNotConfigured(
            f"{provider.provider} rejected the configured API key. Check that the key matches "
            "the configured provider endpoint."
        ) from exc
    except anthropic.APIConnectionError as exc:
        raise LLMNotConfigured(
            f"{provider.provider} is unreachable. Check provider base URL and network access."
        ) from exc
    except anthropic.RateLimitError as exc:
        raise LLMNotConfigured(
            f"{provider.provider} rate limit reached. Try again later."
        ) from exc
    except anthropic.APIStatusError as exc:
        raise LLMNotConfigured(
            f"{provider.provider} returned HTTP {exc.status_code}. Check provider configuration."
        ) from exc

    return "".join(block.text for block in msg.content if block.type == "text")
