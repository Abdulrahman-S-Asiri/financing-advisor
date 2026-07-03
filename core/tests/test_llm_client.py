import pytest

from agents import llm_client


LLM_ENV = (
    "LLM_PROVIDER",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_BASE_URL",
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_MODEL",
    "DEEPSEEK_BASE_URL",
)


def _clear_llm_env(monkeypatch):
    for name in LLM_ENV:
        monkeypatch.delenv(name, raising=False)


def test_resolve_provider_anthropic_only(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("ANTHROPIC_MODEL", "claude-test")

    provider = llm_client.resolve_provider()

    assert provider.provider == "anthropic"
    assert provider.api_key == "anthropic-key"
    assert provider.model == "claude-test"


def test_resolve_provider_deepseek_only(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-test")

    provider = llm_client.resolve_provider()

    assert provider.provider == "deepseek"
    assert provider.api_key == "deepseek-key"
    assert provider.model == "deepseek-test"
    assert provider.base_url == llm_client.DEEPSEEK_DEFAULT_BASE_URL


def test_resolve_provider_prefers_anthropic_when_both_keys_present(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-key")

    provider = llm_client.resolve_provider()

    assert provider.provider == "anthropic"
    assert provider.api_key == "anthropic-key"


def test_resolve_provider_supports_existing_deepseek_compat_env(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "deepseek-key")
    monkeypatch.setenv("ANTHROPIC_MODEL", "deepseek-v4-pro")
    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://api.deepseek.com/anthropic")

    provider = llm_client.resolve_provider()

    assert provider.provider == "deepseek"
    assert provider.api_key == "deepseek-key"
    assert provider.model == "deepseek-v4-pro"
    assert provider.base_url == "https://api.deepseek.com/anthropic"


def test_resolve_provider_fails_without_key(monkeypatch):
    _clear_llm_env(monkeypatch)

    with pytest.raises(llm_client.LLMNotConfigured):
        llm_client.resolve_provider()


def test_resolve_provider_rejects_unknown_provider(monkeypatch):
    _clear_llm_env(monkeypatch)
    monkeypatch.setenv("LLM_PROVIDER", "other")

    with pytest.raises(llm_client.LLMNotConfigured):
        llm_client.resolve_provider()
