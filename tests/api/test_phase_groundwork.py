from fastapi.testclient import TestClient

from api.auth import OtpAuthStore, normalize_saudi_mobile
from api.main import app as api_app
from api.open_banking import OpenBankingGateway
from mock_open_banking.main import app as ob_app


def _client() -> TestClient:
    api_app.state.ob_client_factory = lambda: TestClient(ob_app)
    return TestClient(api_app)


def test_normalizes_saudi_mobile_numbers():
    assert normalize_saudi_mobile("0501234567") == "+966501234567"
    assert normalize_saudi_mobile("+966501234567") == "+966501234567"


def test_interim_otp_store_creates_demo_session():
    store = OtpAuthStore()

    challenge = store.start("+966501234567")
    assert challenge["simulation"] is True
    assert challenge["delivery_channel"] == "demo_response"
    assert challenge["demo_otp"]

    session = store.verify(challenge["challenge_id"], challenge["demo_otp"])
    assert session["simulation"] is True
    assert session["auth_method"] == "phone_otp"
    assert session["assurance_level"] == "interim_demo"

    loaded = store.get_session(session["session_token"])
    assert loaded is not None
    assert loaded.phone_number == "+966501234567"


def test_auth_otp_api_flow():
    c = _client()

    challenge = c.post("/auth/otp/start", json={
        "phone_number": "0501234567",
    })
    assert challenge.status_code == 200, challenge.text
    challenge_body = challenge.json()

    verified = c.post("/auth/otp/verify", json={
        "challenge_id": challenge_body["challenge_id"],
        "otp": challenge_body["demo_otp"],
    })
    assert verified.status_code == 200, verified.text
    session = verified.json()
    assert session["phone_number"] == "+966501234567"

    loaded = c.get(f"/auth/session/{session['session_token']}")
    assert loaded.status_code == 200, loaded.text
    assert loaded.json()["session_token"] == session["session_token"]


def test_open_banking_gateway_fetches_mock_transactions():
    gateway = OpenBankingGateway(
        base_url="http://mock-ob",
        client_factory=lambda: TestClient(ob_app),
    )

    bank, transactions = gateway.fetch_transactions("sara_strong")

    assert bank
    assert transactions
    assert "TransactionId" in transactions[0]


def test_open_banking_status_exposes_adapter_contract():
    c = _client()
    response = c.get("/integrations/open-banking/status")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["provider"] == "mock"
    assert body["mock_mode"] is True
    assert body["adapter"] == "api.open_banking.OpenBankingGateway"


def test_analytics_overview_is_aggregate_only():
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
    }).json()
    c.post(f"/applications/{draft['application_id']}/submit")

    response = c.get("/analytics/overview")

    assert response.status_code == 200, response.text
    assert "sara_strong" not in response.text
    body = response.json()
    assert body["privacy"]["anonymized"] is True
    assert body["privacy"]["raw_persona_ids_included"] is False
    assert body["journeys"]["total"] >= 1
    assert body["applications"]["total"] >= 1
    assert "eligible" in body["matches"]["status_counts"]
    data_product_ids = {item["id"] for item in body["data_products"]}
    assert "offer_gap_insights" in data_product_ids
    assert "approval_likelihood_training_set" in data_product_ids
