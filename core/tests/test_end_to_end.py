"""End-to-end pipeline test: consent -> transactions -> profile -> matches.

The API's httpx client is pointed at the mock OB FastAPI app in-process via
ASGITransport — no ports, no network, runs in CI and on any laptop. This is
the test that says "Day 1 is already done" the moment you clone the repo.
"""
from fastapi.testclient import TestClient

from api.main import app as api_app
from mock_open_banking.main import app as ob_app


def _client() -> TestClient:
    # TestClient is an httpx.Client subclass, so it slots straight into the
    # API's client factory: the API "calls" the mock OB service in-process.
    api_app.state.ob_client_factory = lambda: TestClient(ob_app)
    return TestClient(api_app)


def test_journey_borderline_persona_has_mixed_outcomes():
    c = _client()
    r = c.post("/journey/connect", json={
        "persona_id": "ahmed_borderline",
        "requested_amount": 80_000,
        "requested_tenor_months": 48,
        "age": 28,
    })
    assert r.status_code == 200, r.text
    body = r.json()

    # Profile extraction found the seeded facts
    assert abs(body["profile"]["gross_salary"] - 9_500) < 1
    assert body["profile"]["salary_linked_obligations"] > 0
    assert body["profile"]["salary_stability_score"] >= 0.8
    assert body["profile"]["obligation_trend"] == "stable"
    assert body["profile"]["confidence_level"] == "high"
    assert body["max_affordable_new_installment"] > 0
    assert body["suggested_questions"]

    statuses = {m["status"] for m in body["matches"]}
    # Borderline persona: at least one path forward and at least one blocked
    assert statuses & {"eligible", "conditional"}
    assert "ineligible" in statuses

    # Every ineligible match explains itself
    for m in body["matches"]:
        if m["status"] == "ineligible":
            assert m["reasons"], f"{m['offer_id']} rejected without reasons"

    # Unverified placeholder rates are flagged all the way to the response
    assert all("rate_verified" in m for m in body["matches"])
    assert all("near_miss_suggestions" in m for m in body["matches"])
    priced = [m for m in body["matches"] if m["monthly_installment"] is not None]
    assert priced and all(m["payment_schedule"] for m in priced)

    # Phase 1 agent foundation: the legacy response is still present, with
    # ordered events added for the UI timeline.
    assert body["journey_id"]
    assert body["events"]
    assert [event["sequence"] for event in body["events"]] == list(
        range(1, len(body["events"]) + 1)
    )
    assert body["events"][0]["type"] == "agent_started"
    assert body["events"][-1]["type"] == "journey_completed"
    assert body["events"][-1]["payload"]["journey_id"] == body["journey_id"]


def test_journey_stream_emits_sse_events():
    c = _client()
    r = c.post("/journey/connect/stream", json={
        "persona_id": "sara_strong",
        "requested_amount": 60_000,
        "requested_tenor_months": 36,
        "age": 31,
    })
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/event-stream")
    assert "event: agent_started" in r.text
    assert "event: tool_called" in r.text
    assert "event: journey_completed" in r.text
    assert '"journey_id"' in r.text


def test_journey_rejected_persona_explains_why():
    c = _client()
    r = c.post("/journey/connect", json={
        "persona_id": "khalid_rejected",
        "requested_amount": 50_000,
        "requested_tenor_months": 36,
        "age": 35,
    })
    body = r.json()
    eligible = [m for m in body["matches"] if m["status"] in ("eligible", "conditional")]
    assert not eligible  # obligations already breach the 33.33% salary-linked cap
    assert any("33.33%" in reason or "gross" in reason.lower()
               for m in body["matches"] for reason in m["reasons"])


def test_unknown_persona_404():
    c = _client()
    r = c.post("/journey/connect", json={
        "persona_id": "nobody",
        "requested_amount": 10_000,
        "requested_tenor_months": 12,
    })
    assert r.status_code == 404


def test_application_simulation_lifecycle():
    c = _client()
    journey = c.post("/journey/connect", json={
        "persona_id": "sara_strong",
        "requested_amount": 60_000,
        "requested_tenor_months": 36,
        "age": 31,
    }).json()
    offer = next(
        match for match in journey["matches"]
        if match["status"] in ("eligible", "conditional", "policy_review")
    )

    draft = c.post("/applications/draft", json={
        "journey_id": journey["journey_id"],
        "offer_id": offer["offer_id"],
    })
    assert draft.status_code == 200, draft.text
    body = draft.json()
    assert body["simulation"] is True
    assert body["status"] == "draft"

    submitted = c.post(f"/applications/{body['application_id']}/submit").json()
    assert submitted["status"] == "submitted"

    reviewing = c.post(f"/applications/{body['application_id']}/advance").json()
    assert reviewing["status"] == "under_review"

    final = c.post(f"/applications/{body['application_id']}/advance").json()
    assert final["status"] in ("approved", "declined")
    assert len(final["history"]) == 4


def test_advisor_chat_fails_loud_without_key(monkeypatch):
    for name in (
        "LLM_PROVIDER",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_MODEL",
        "ANTHROPIC_BASE_URL",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_MODEL",
        "DEEPSEEK_BASE_URL",
    ):
        monkeypatch.delenv(name, raising=False)
    c = _client()
    c.post("/journey/connect", json={
        "persona_id": "sara_strong",
        "requested_amount": 60_000,
        "requested_tenor_months": 36,
    })
    r = c.post("/advisor/chat", json={"persona_id": "sara_strong", "message": "hi"})
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["detail"]
