"""Thin LLM client. One place to configure provider/model.

Uses the Anthropic Messages API shape. Anthropic and DeepSeek both work
through this client because DeepSeek exposes an Anthropic-compatible endpoint.
Imports stay lazy so core/, mock OB, and the matching endpoint all run without
an API key -- only LLM-backed advisor behavior needs it.
"""
from __future__ import annotations

import os
import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class LLMNotConfigured(RuntimeError):
    pass


class LLMToolError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderConfig:
    provider: str
    api_key: str
    model: str
    base_url: str = ""


@dataclass(frozen=True)
class LLMUsage:
    provider: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cache_creation_input_tokens": self.cache_creation_input_tokens,
            "cache_read_input_tokens": self.cache_read_input_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass(frozen=True)
class LLMCompletion:
    text: str
    usage: LLMUsage
    model_calls: int = 1
    tool_results: list["LLMToolResult"] = field(default_factory=list)


@dataclass(frozen=True)
class LLMToolResult:
    tool_use_id: str
    name: str
    input: dict[str, Any]
    result: dict[str, Any]
    round_number: int
    is_error: bool = False


ToolDefinition = Mapping[str, Any]
ToolHandler = Callable[[dict[str, Any]], dict[str, Any]]


DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic"
ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6"
DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-pro"
PROMPT_CACHE_CONTROL = {"type": "ephemeral"}


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


def _usage_from_message(provider: ProviderConfig, msg) -> LLMUsage:
    usage = getattr(msg, "usage", None)
    return LLMUsage(
        provider=provider.provider,
        model=provider.model,
        input_tokens=int(getattr(usage, "input_tokens", 0) or 0),
        output_tokens=int(getattr(usage, "output_tokens", 0) or 0),
        cache_creation_input_tokens=int(
            getattr(usage, "cache_creation_input_tokens", 0) or 0
        ),
        cache_read_input_tokens=int(
            getattr(usage, "cache_read_input_tokens", 0) or 0
        ),
    )


def _aggregate_usage(provider: ProviderConfig, usages: list[LLMUsage]) -> LLMUsage:
    return LLMUsage(
        provider=provider.provider,
        model=provider.model,
        input_tokens=sum(usage.input_tokens for usage in usages),
        output_tokens=sum(usage.output_tokens for usage in usages),
        cache_creation_input_tokens=sum(
            usage.cache_creation_input_tokens for usage in usages
        ),
        cache_read_input_tokens=sum(usage.cache_read_input_tokens for usage in usages),
    )


def _supports_prompt_cache(provider: ProviderConfig) -> bool:
    if provider.provider != "anthropic":
        return False
    compat_target = f"{provider.model} {provider.base_url}".lower()
    return "deepseek" not in compat_target


def _system_payload(provider: ProviderConfig, system: str) -> str | list[dict[str, Any]]:
    if not _supports_prompt_cache(provider):
        return system
    return [
        {
            "type": "text",
            "text": system,
            "cache_control": dict(PROMPT_CACHE_CONTROL),
        }
    ]


def _tools_payload(
    provider: ProviderConfig,
    tools: list[ToolDefinition],
) -> list[dict[str, Any]]:
    payload = [dict(tool) for tool in tools]
    if payload and _supports_prompt_cache(provider):
        payload[-1]["cache_control"] = dict(PROMPT_CACHE_CONTROL)
    return payload


def _anthropic_client(provider: ProviderConfig):
    try:
        import anthropic  # lazy: keeps the deterministic path dependency-free
    except ImportError as exc:
        raise LLMNotConfigured("pip install anthropic") from exc

    client_kwargs = {"api_key": provider.api_key}
    if provider.base_url:
        client_kwargs["base_url"] = provider.base_url
    return anthropic.Anthropic(**client_kwargs), anthropic


def _message_create(client: Any, **kwargs: Any) -> Any:
    messages = getattr(client, "messages", client)
    return messages.create(**kwargs)


def _block_value(block: Any, key: str, default: Any = None) -> Any:
    if isinstance(block, Mapping):
        return block.get(key, default)
    return getattr(block, key, default)


def _content_blocks(msg: Any) -> list[Any]:
    content = getattr(msg, "content", None)
    if content is None and isinstance(msg, Mapping):
        content = msg.get("content", [])
    return list(content or [])


def _text_from_message(msg: Any) -> str:
    return "".join(
        str(_block_value(block, "text", ""))
        for block in _content_blocks(msg)
        if _block_value(block, "type") == "text"
    )


def _assistant_content_payload(msg: Any) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    for block in _content_blocks(msg):
        block_type = _block_value(block, "type")
        if block_type == "text":
            payload.append({"type": "text", "text": _block_value(block, "text", "")})
        elif block_type == "tool_use":
            payload.append(
                {
                    "type": "tool_use",
                    "id": _block_value(block, "id"),
                    "name": _block_value(block, "name"),
                    "input": _block_value(block, "input", {}) or {},
                }
            )
    return payload


def _tool_uses_from_message(msg: Any) -> list[dict[str, Any]]:
    uses: list[dict[str, Any]] = []
    for block in _content_blocks(msg):
        if _block_value(block, "type") != "tool_use":
            continue
        tool_input = _block_value(block, "input", {}) or {}
        if not isinstance(tool_input, dict):
            raise LLMToolError("Tool input must be a JSON object.")
        uses.append(
            {
                "id": str(_block_value(block, "id", "")),
                "name": str(_block_value(block, "name", "")),
                "input": tool_input,
            }
        )
    return uses


def _tool_result_content(results: list[LLMToolResult]) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = []
    for result in results:
        item: dict[str, Any] = {
            "type": "tool_result",
            "tool_use_id": result.tool_use_id,
            "content": json.dumps(result.result, ensure_ascii=False, default=str),
        }
        if result.is_error:
            item["is_error"] = True
        content.append(item)
    return content


def _execute_tool_use(
    tool_use: dict[str, Any],
    handlers: Mapping[str, ToolHandler],
    round_number: int,
) -> LLMToolResult:
    name = tool_use["name"]
    handler = handlers.get(name)
    if handler is None:
        raise LLMToolError(f"Unknown tool requested by model: {name}")
    try:
        result = handler(tool_use["input"])
    except Exception as exc:
        return LLMToolResult(
            tool_use_id=tool_use["id"],
            name=name,
            input=tool_use["input"],
            result={"error": str(exc)},
            round_number=round_number,
            is_error=True,
        )
    if not isinstance(result, dict):
        raise LLMToolError(f"Tool handler must return a dict: {name}")
    return LLMToolResult(
        tool_use_id=tool_use["id"],
        name=name,
        input=tool_use["input"],
        result=result,
        round_number=round_number,
    )


def complete_with_usage(
    system: str,
    user: str,
    max_tokens: int = 1000,
) -> LLMCompletion:
    provider = resolve_provider()
    client, anthropic = _anthropic_client(provider)
    try:
        msg = _message_create(
            client,
            model=provider.model,
            max_tokens=max_tokens,
            system=_system_payload(provider, system),
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

    text = _text_from_message(msg)
    return LLMCompletion(text=text, usage=_usage_from_message(provider, msg))


def complete_with_tools(
    system: str,
    user: str,
    tools: list[ToolDefinition],
    handlers: Mapping[str, ToolHandler],
    *,
    max_tokens: int = 1000,
    max_tool_rounds: int = 5,
    provider: ProviderConfig | None = None,
    client: Any | None = None,
) -> LLMCompletion:
    """Run the Anthropic-style tool loop with deterministic local handlers.

    The model may request tools, but each tool result comes from code supplied
    by the caller. After the configured number of tool-use rounds, tools are
    withheld and the model is forced to answer from already-returned results.
    """
    if max_tool_rounds < 0:
        raise ValueError("max_tool_rounds must be non-negative.")

    provider = provider or resolve_provider()
    anthropic_module = None
    if client is None:
        client, anthropic_module = _anthropic_client(provider)

    messages: list[dict[str, Any]] = [{"role": "user", "content": user}]
    usages: list[LLMUsage] = []
    tool_results: list[LLMToolResult] = []
    tool_rounds = 0

    while True:
        request: dict[str, Any] = {
            "model": provider.model,
            "max_tokens": max_tokens,
            "system": _system_payload(provider, system),
            "messages": messages,
        }
        if tools:
            request["tools"] = _tools_payload(provider, tools)

        try:
            msg = _message_create(client, **request)
        except Exception as exc:
            if anthropic_module is None:
                raise
            if isinstance(exc, anthropic_module.AuthenticationError):
                raise LLMNotConfigured(
                    f"{provider.provider} rejected the configured API key. Check that the key matches "
                    "the configured provider endpoint."
                ) from exc
            if isinstance(exc, anthropic_module.APIConnectionError):
                raise LLMNotConfigured(
                    f"{provider.provider} is unreachable. Check provider base URL and network access."
                ) from exc
            if isinstance(exc, anthropic_module.RateLimitError):
                raise LLMNotConfigured(
                    f"{provider.provider} rate limit reached. Try again later."
                ) from exc
            if isinstance(exc, anthropic_module.APIStatusError):
                raise LLMNotConfigured(
                    f"{provider.provider} returned HTTP {exc.status_code}. Check provider configuration."
                ) from exc
            raise

        usages.append(_usage_from_message(provider, msg))
        tool_uses = _tool_uses_from_message(msg)
        if not tool_uses:
            return LLMCompletion(
                text=_text_from_message(msg),
                usage=_aggregate_usage(provider, usages),
                model_calls=len(usages),
                tool_results=tool_results,
            )

        messages.append({"role": "assistant", "content": _assistant_content_payload(msg)})
        round_number = tool_rounds + 1
        round_results = [
            _execute_tool_use(tool_use, handlers, round_number)
            for tool_use in tool_uses
        ]
        tool_results.extend(round_results)
        messages.append({"role": "user", "content": _tool_result_content(round_results)})
        tool_rounds += 1

        if tool_rounds >= max_tool_rounds:
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "Tool-call limit reached. Give a final answer using only "
                        "the context and tool results already returned."
                    ),
                }
            )
            final_msg = _message_create(
                client,
                model=provider.model,
                max_tokens=max_tokens,
                system=_system_payload(provider, system),
                messages=messages,
            )
            usages.append(_usage_from_message(provider, final_msg))
            return LLMCompletion(
                text=_text_from_message(final_msg),
                usage=_aggregate_usage(provider, usages),
                model_calls=len(usages),
                tool_results=tool_results,
            )


def complete(system: str, user: str, max_tokens: int = 1000) -> str:
    return complete_with_usage(system, user, max_tokens=max_tokens).text
