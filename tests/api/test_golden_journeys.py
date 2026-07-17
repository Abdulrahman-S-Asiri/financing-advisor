"""Golden snapshots for the three demo journeys."""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app as api_app
from mock_open_banking.main import app as ob_app


GOLDEN_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "golden"

DEMO_REQUESTS = {
    "sara_strong": {
        "persona_id": "sara_strong",
        "requested_amount": 60_000,
        "requested_tenor_months": 36,
        "age": 31,
    },
    "ahmed_borderline": {
        "persona_id": "ahmed_borderline",
        "requested_amount": 80_000,
        "requested_tenor_months": 48,
        "age": 28,
    },
    "khalid_rejected": {
        "persona_id": "khalid_rejected",
        "requested_amount": 50_000,
        "requested_tenor_months": 36,
        "age": 35,
    },
}
RAW_TRANSACTION_FIELDS = (
    "TransactionInformation",
    "TransactionId",
    "BookingDateTime",
    "Amount",
    "CreditDebitIndicator",
)


def _client() -> TestClient:
    api_app.state.ob_client_factory = lambda: TestClient(ob_app)
    return TestClient(api_app)


def _normalize(payload: dict) -> dict:
    normalized = deepcopy(payload)
    normalized["journey_id"] = "<journey_id>"
    for event in normalized.get("events", []):
        event["journey_id"] = "<journey_id>"
        event["created_at"] = "<timestamp>"
        if event.get("payload", {}).get("journey_id"):
            event["payload"]["journey_id"] = "<journey_id>"
    return normalized


@pytest.mark.parametrize("persona_id", sorted(DEMO_REQUESTS))
def test_demo_journey_matches_golden_snapshot(persona_id):
    response = _client().post("/journey/connect", json=DEMO_REQUESTS[persona_id])
    assert response.status_code == 200, response.text

    actual = _normalize(response.json())
    actual_text = json.dumps(actual, ensure_ascii=False)
    assert not any(field in actual_text for field in RAW_TRANSACTION_FIELDS)

    expected = json.loads(
        (GOLDEN_DIR / f"{persona_id}.json").read_text(encoding="utf-8")
    )

    assert actual == expected
