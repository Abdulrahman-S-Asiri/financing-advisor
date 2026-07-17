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


def test_llm_usage_payload_includes_total_tokens():
    usage = llm_client.LLMUsage(
        provider="deepseek",
        model="deepseek-test",
        input_tokens=12,
        output_tokens=8,
        cache_creation_input_tokens=3,
        cache_read_input_tokens=4,
    )

    assert usage.to_dict() == {
        "provider": "deepseek",
        "model": "deepseek-test",
        "input_tokens": 12,
        "output_tokens": 8,
        "cache_creation_input_tokens": 3,
        "cache_read_input_tokens": 4,
        "total_tokens": 20,
    }


class _FakeUsage:
    def __init__(
        self,
        input_tokens=0,
        output_tokens=0,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
    ):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cache_creation_input_tokens = cache_creation_input_tokens
        self.cache_read_input_tokens = cache_read_input_tokens


class _FakeBlock:
    def __init__(self, block_type, **kwargs):
        self.type = block_type
        for key, value in kwargs.items():
            setattr(self, key, value)


class _FakeMessage:
    def __init__(
        self,
        content,
        input_tokens=0,
        output_tokens=0,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
    ):
        self.content = content
        self.usage = _FakeUsage(
            input_tokens,
            output_tokens,
            cache_creation_input_tokens,
            cache_read_input_tokens,
        )


class _FakeMessages:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if not self.responses:
            raise AssertionError("No fake LLM responses left.")
        return self.responses.pop(0)


class _FakeClient:
    def __init__(self, responses):
        self.messages = _FakeMessages(responses)


def _provider():
    return llm_client.ProviderConfig(
        provider="anthropic",
        api_key="test-key",
        model="test-model",
    )


def _deepseek_provider():
    return llm_client.ProviderConfig(
        provider="deepseek",
        api_key="test-key",
        model="deepseek-test",
        base_url=llm_client.DEEPSEEK_DEFAULT_BASE_URL,
    )


def _anthropic_deepseek_compat_provider():
    return llm_client.ProviderConfig(
        provider="anthropic",
        api_key="test-key",
        model="deepseek-v4-pro",
        base_url=llm_client.DEEPSEEK_DEFAULT_BASE_URL,
    )


def test_complete_with_usage_marks_anthropic_system_cache(monkeypatch):
    client = _FakeClient(
        [_FakeMessage([_FakeBlock("text", text="ok")], input_tokens=1, output_tokens=2)]
    )
    monkeypatch.setattr(llm_client, "resolve_provider", _provider)
    monkeypatch.setattr(llm_client, "_anthropic_client", lambda _provider: (client, object()))

    result = llm_client.complete_with_usage("system", "user")

    assert result.text == "ok"
    assert result.usage.input_tokens == 1
    assert client.messages.calls[0]["system"] == [
        {
            "type": "text",
            "text": "system",
            "cache_control": {"type": "ephemeral"},
        }
    ]


def test_complete_with_usage_keeps_deepseek_system_plain(monkeypatch):
    client = _FakeClient([_FakeMessage([_FakeBlock("text", text="ok")])])
    monkeypatch.setattr(llm_client, "resolve_provider", _deepseek_provider)
    monkeypatch.setattr(llm_client, "_anthropic_client", lambda _provider: (client, object()))

    llm_client.complete_with_usage("system", "user")

    assert client.messages.calls[0]["system"] == "system"


def test_complete_with_tools_executes_tool_and_returns_final_text():
    client = _FakeClient(
        [
            _FakeMessage(
                [
                    _FakeBlock(
                        "tool_use",
                        id="toolu_1",
                        name="simulate_scenario",
                        input={"requested_amount": 50_000},
                    )
                ],
                input_tokens=10,
                output_tokens=2,
                cache_creation_input_tokens=3,
            ),
            _FakeMessage(
                [_FakeBlock("text", text="القسط من نتيجة الأداة هو 1,234.56.")],
                input_tokens=20,
                output_tokens=5,
                cache_read_input_tokens=11,
            ),
        ]
    )
    handled_inputs = []

    result = llm_client.complete_with_tools(
        "system",
        "user",
        tools=[
            {
                "name": "simulate_scenario",
                "description": "Run deterministic scenario simulation.",
                "input_schema": {
                    "type": "object",
                    "properties": {"requested_amount": {"type": "number"}},
                },
            }
        ],
        handlers={
            "simulate_scenario": lambda data: handled_inputs.append(data)
            or {"monthly_installment": 1_234.56}
        },
        provider=_provider(),
        client=client,
    )

    assert handled_inputs == [{"requested_amount": 50_000}]
    assert result.text == "القسط من نتيجة الأداة هو 1,234.56."
    assert result.usage.input_tokens == 30
    assert result.usage.output_tokens == 7
    assert result.usage.cache_creation_input_tokens == 3
    assert result.usage.cache_read_input_tokens == 11
    assert result.model_calls == 2
    assert result.tool_results[0].name == "simulate_scenario"
    assert result.tool_results[0].result == {"monthly_installment": 1_234.56}
    assert client.messages.calls[0]["tools"][0]["name"] == "simulate_scenario"
    tool_result_message = client.messages.calls[1]["messages"][-1]
    assert tool_result_message["role"] == "user"
    assert tool_result_message["content"][0]["type"] == "tool_result"
    assert tool_result_message["content"][0]["tool_use_id"] == "toolu_1"
    assert '"monthly_installment": 1234.56' in tool_result_message["content"][0]["content"]


def test_complete_with_tools_marks_anthropic_prompt_cache_breakpoints():
    client = _FakeClient([_FakeMessage([_FakeBlock("text", text="done")])])

    llm_client.complete_with_tools(
        "system",
        "user",
        tools=[
            {
                "name": "simulate_scenario",
                "description": "Run deterministic scenario simulation.",
                "input_schema": {"type": "object", "properties": {}},
            },
            {
                "name": "get_offer_detail",
                "description": "Return deterministic offer detail.",
                "input_schema": {"type": "object", "properties": {}},
            },
        ],
        handlers={},
        provider=_provider(),
        client=client,
    )

    call = client.messages.calls[0]
    assert call["system"] == [
        {
            "type": "text",
            "text": "system",
            "cache_control": {"type": "ephemeral"},
        }
    ]
    assert "cache_control" not in call["tools"][0]
    assert call["tools"][1]["cache_control"] == {"type": "ephemeral"}


def test_complete_with_tools_does_not_send_cache_control_to_deepseek():
    client = _FakeClient([_FakeMessage([_FakeBlock("text", text="done")])])

    llm_client.complete_with_tools(
        "system",
        "user",
        tools=[
            {
                "name": "simulate_scenario",
                "description": "Run deterministic scenario simulation.",
                "input_schema": {"type": "object", "properties": {}},
            }
        ],
        handlers={},
        provider=_deepseek_provider(),
        client=client,
    )

    call = client.messages.calls[0]
    assert call["system"] == "system"
    assert all("cache_control" not in tool for tool in call["tools"])


def test_complete_with_tools_keeps_deepseek_compat_config_plain():
    client = _FakeClient([_FakeMessage([_FakeBlock("text", text="done")])])

    llm_client.complete_with_tools(
        "system",
        "user",
        tools=[
            {
                "name": "simulate_scenario",
                "description": "Run deterministic scenario simulation.",
                "input_schema": {"type": "object", "properties": {}},
            }
        ],
        handlers={},
        provider=_anthropic_deepseek_compat_provider(),
        client=client,
    )

    call = client.messages.calls[0]
    assert call["system"] == "system"
    assert all("cache_control" not in tool for tool in call["tools"])


def test_complete_with_tools_forces_final_answer_after_round_cap():
    client = _FakeClient(
        [
            _FakeMessage(
                [
                    _FakeBlock(
                        "tool_use",
                        id="toolu_1",
                        name="simulate_scenario",
                        input={},
                    )
                ],
                input_tokens=8,
                output_tokens=1,
            ),
            _FakeMessage(
                [_FakeBlock("text", text="Final answer from returned tool result.")],
                input_tokens=13,
                output_tokens=4,
            ),
        ]
    )

    result = llm_client.complete_with_tools(
        "system",
        "user",
        tools=[
            {
                "name": "simulate_scenario",
                "description": "Run deterministic scenario simulation.",
                "input_schema": {"type": "object", "properties": {}},
            }
        ],
        handlers={"simulate_scenario": lambda _data: {"ok": True}},
        provider=_provider(),
        client=client,
        max_tool_rounds=1,
    )

    assert result.text == "Final answer from returned tool result."
    assert result.model_calls == 2
    assert "tools" in client.messages.calls[0]
    assert "tools" not in client.messages.calls[1]
    assert "Tool-call limit reached" in client.messages.calls[1]["messages"][-1]["content"]


def test_complete_with_tools_marks_handler_errors_as_tool_results():
    client = _FakeClient(
        [
            _FakeMessage(
                [
                    _FakeBlock(
                        "tool_use",
                        id="toolu_1",
                        name="simulate_scenario",
                        input={},
                    )
                ]
            ),
            _FakeMessage([_FakeBlock("text", text="The tool returned an error.")]),
        ]
    )

    result = llm_client.complete_with_tools(
        "system",
        "user",
        tools=[
            {
                "name": "simulate_scenario",
                "description": "Run deterministic scenario simulation.",
                "input_schema": {"type": "object", "properties": {}},
            }
        ],
        handlers={
            "simulate_scenario": lambda _data: (_ for _ in ()).throw(
                ValueError("invalid scenario")
            )
        },
        provider=_provider(),
        client=client,
    )

    assert result.tool_results[0].is_error is True
    assert result.tool_results[0].result == {"error": "invalid scenario"}
    tool_result = client.messages.calls[1]["messages"][-1]["content"][0]
    assert tool_result["is_error"] is True
