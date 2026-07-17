"""/healthz contract: booleans and counts only, never secret values."""
import json

from fastapi.testclient import TestClient

from api.main import app as api_app

EXPECTED_KEYS = {
    "status",
    "version",
    "offers_loaded",
    "catalog_valid",
    "postgres_enabled",
    "llm_configured",
    "open_banking_provider",
}


def test_healthz_shape_and_types():
    response = TestClient(api_app).get("/healthz")
    assert response.status_code == 200
    body = response.json()

    assert set(body) == EXPECTED_KEYS
    assert body["status"] == "ok"
    assert body["catalog_valid"] is True
    assert isinstance(body["offers_loaded"], int) and body["offers_loaded"] >= 1
    assert isinstance(body["postgres_enabled"], bool)
    assert isinstance(body["llm_configured"], bool)
    # Values are scalar summaries only — no nested config payloads.
    assert all(isinstance(v, (str, bool, int)) for v in body.values())


def test_healthz_never_leaks_configured_secrets(monkeypatch):
    planted = "sk-healthz-canary-9f2"
    monkeypatch.setenv("ANTHROPIC_API_KEY", planted)

    response = TestClient(api_app).get("/healthz")

    assert planted not in json.dumps(response.json())
    assert response.json()["llm_configured"] is True  # reported as boolean only
