"""The guardrail_fallback flag must flow through /advisor/chat and the SSE
done frame so the UI can mark safe-fallback replies without string matching."""
from fastapi.testclient import TestClient

from agents.advisor import AdvisorChatResult
from api import main as api_main
from mock_open_banking.main import app as ob_app


def _client() -> TestClient:
    api_main.app.state.ob_client_factory = lambda: TestClient(ob_app)
    return TestClient(api_main.app)


def _start_journey(client: TestClient) -> str:
    response = client.post("/journey/connect", json={
        "persona_id": "sara_strong",
        "requested_amount": 50_000,
        "requested_tenor_months": 36,
        "age": 31,
    })
    assert response.status_code == 200, response.text
    return response.json()["journey_id"]


def _fake_chat(reply: str, fallback: bool):
    def fake(_profile, _matches, _max_affordable, _message):
        return AdvisorChatResult(
            reply=reply,
            usage={"provider": "test", "model": "test", "input_tokens": 1,
                   "output_tokens": 1, "cache_creation_input_tokens": 0,
                   "cache_read_input_tokens": 0, "total_tokens": 2,
                   "model_calls": 1},
            guardrail_retries=1 if fallback else 0,
            guardrail_fallback=fallback,
        )
    return fake


def test_chat_response_carries_fallback_flag(monkeypatch):
    client = _client()
    journey_id = _start_journey(client)
    monkeypatch.setattr(
        api_main.advisor, "chat_with_trace", _fake_chat("رد آمن.", True)
    )

    body = client.post(
        "/advisor/chat", json={"journey_id": journey_id, "message": "سؤال"}
    ).json()

    assert body == {"reply": "رد آمن.", "guardrail_fallback": True,
                    "guardrail_retries": 1}


def test_chat_stream_done_frame_carries_fallback_flag(monkeypatch):
    client = _client()
    journey_id = _start_journey(client)
    monkeypatch.setattr(
        api_main.advisor, "chat_with_trace", _fake_chat("إجابة عادية.", False)
    )

    raw = client.post(
        "/advisor/chat/stream", json={"journey_id": journey_id, "message": "سؤال"}
    ).text

    assert 'event: done' in raw
    assert '"guardrail_fallback": false' in raw