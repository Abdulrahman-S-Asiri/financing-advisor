"""Backend<->frontend payload contract.

The frontend schemas in frontend/src/lib/schemas.ts mirror these payloads.
This test pins the contract: every key the frontend
requires must be present, and the backend may not grow keys silently (new keys
go into the fixture's 'optional' list deliberately, with a matching frontend
decision). Failures print the exact missing/unexpected key names.
"""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app as api_app
from mock_open_banking.main import app as ob_app

FIXTURE = json.loads(
    (Path(__file__).parents[1] / "fixtures" / "frontend_contract_keys.json")
    .read_text(encoding="utf-8")
)


def _client() -> TestClient:
    api_app.state.ob_client_factory = lambda: TestClient(ob_app)
    return TestClient(api_app)


def _assert_contract(payload: dict, type_name: str) -> None:
    spec = FIXTURE[type_name]
    actual = set(payload)
    required = set(spec["required"])
    allowed = required | set(spec["optional"])

    missing = sorted(required - actual)
    unexpected = sorted(actual - allowed)
    assert not missing, f"{type_name}: frontend-required keys missing: {missing}"
    assert not unexpected, (
        f"{type_name}: backend grew keys the contract does not know: {unexpected} "
        f"— add them to the fixture and frontend types.ts together."
    )


@pytest.fixture(scope="module")
def journey() -> dict:
    response = _client().post("/journey/connect", json={
        "persona_id": "ahmed_borderline",
        "requested_amount": 80_000,
        "requested_tenor_months": 48,
        "age": 28,
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_journey_response_contract(journey):
    _assert_contract(journey, "JourneyResponse")
    _assert_contract(journey["profile"], "FinancialProfile")
    _assert_contract(journey["financial_health"], "FinancialHealth")

    assert journey["matches"], "seeded journey must produce matches"
    for match in journey["matches"]:
        _assert_contract(match, "OfferMatch")
        for suggestion in match["near_miss_suggestions"]:
            _assert_contract(suggestion, "NearMissSuggestion")

    assert journey["events"], "journey must stream agent events"
    for event in journey["events"]:
        _assert_contract(event, "AgentEvent")


def test_simulation_response_contract(journey):
    response = _client().post("/advisor/tools/simulate", json={
        "journey_id": journey["journey_id"],
        "requested_amount": 60_000,
        "requested_tenor_months": 36,
        "salary_transfer": True,
    })
    assert response.status_code == 200, response.text
    body = response.json()

    _assert_contract(body, "SimulationResponse")
    for match in body["matches"]:
        _assert_contract(match, "OfferMatch")


def test_application_record_contract(journey):
    eligible = next(
        m for m in journey["matches"]
        if m["status"] in ("eligible", "conditional", "policy_review")
    )
    client = _client()
    response = client.post("/applications/draft", json={
        "journey_id": journey["journey_id"],
        "offer_id": eligible["offer_id"],
    })
    assert response.status_code == 200, response.text
    record = response.json()

    _assert_contract(record, "ApplicationRecord")
    _assert_contract(record["summary"], "ApplicationSummary")
    for item in record["history"]:
        _assert_contract(item, "ApplicationHistoryItem")

    submitted = client.post(f"/applications/{record['application_id']}/submit")
    assert submitted.status_code == 200
    _assert_contract(submitted.json(), "ApplicationRecord")
