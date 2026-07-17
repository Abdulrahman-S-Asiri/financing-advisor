import json

from agents import categorizer, orchestrator
from core.models import Category, Offer, Structure
from core.profile import Txn


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


def _txn(
    month: str,
    amount: float,
    credit: bool,
    description: str,
    *,
    bank: str = "Bank A",
) -> Txn:
    return Txn(
        booking_month=month,
        amount=amount,
        credit=credit,
        description=description.upper(),
        bank=bank,
    )


def _txns() -> list[Txn]:
    txns: list[Txn] = []
    for month in ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]:
        txns.append(_txn(month, 10_000, True, "SALARY PAYROLL"))
        txns.append(_txn(month, 750, False, "MYSTERY PLAN"))
    return txns


def _offer() -> Offer:
    return Offer(
        id="o1",
        institution="Bank A",
        product_name="Personal Finance",
        category=Category.PERSONAL,
        structure=Structure.TAWARRUQ,
        flat_rate_annual=0.05,
        admin_fee_pct=0.01,
        admin_fee_cap_sar=5_000,
        min_amount=10_000,
        max_amount=500_000,
        min_tenor_months=12,
        max_tenor_months=60,
        min_gross_salary=4_000,
        salary_transfer_required=False,
        eligible_employment=["private", "government"],
        nationality="both",
        max_age_at_maturity=60,
    )


def _run() -> orchestrator.JourneyResult:
    return orchestrator.run_journey(
        persona_id="p1",
        txns=_txns(),
        offers=[_offer()],
        requested_amount=20_000,
        requested_tenor_months=24,
        age=30,
        nationality="saudi",
        journey_id="journey-fixed",
    )


def _stable_payload(result: orchestrator.JourneyResult) -> str:
    payload = result.response_payload()
    for event in payload["events"]:
        event["created_at"] = "<timestamp>"
    return json.dumps(payload, ensure_ascii=False, sort_keys=True)


def test_no_key_journey_matches_disabled_categorizer_path(monkeypatch):
    with monkeypatch.context() as context:
        context.setattr(orchestrator, "_categorizer_configured", lambda: False)
        expected = _stable_payload(_run())

    _clear_llm_env(monkeypatch)

    def fail_if_called(_candidates):
        raise AssertionError("categorizer should not run without an LLM provider")

    monkeypatch.setattr(orchestrator.categorizer, "categorize", fail_if_called)
    actual = _stable_payload(_run())

    assert actual == expected


def test_configured_categorizer_relabels_profile_without_changing_amounts(monkeypatch):
    captured_candidates = []

    def fake_categorize(candidates):
        captured_candidates.extend(candidates)
        return categorizer.CategorizationBatch(
            labels={("MYSTERY PLAN", False): "other_obligation"},
            attempted_count=len(candidates),
            usage={"provider": "fake", "model": "fake-categorizer"},
        )

    txns = _txns()
    original_amounts = [txn.amount for txn in txns]
    monkeypatch.setattr(orchestrator, "_categorizer_configured", lambda: True)
    monkeypatch.setattr(orchestrator.categorizer, "categorize", fake_categorize)

    result = orchestrator.run_journey(
        persona_id="p1",
        txns=txns,
        offers=[_offer()],
        requested_amount=20_000,
        requested_tenor_months=24,
        age=30,
        nationality="saudi",
        journey_id="journey-fixed",
    )

    assert [(item.description, item.credit) for item in captured_candidates] == [
        ("MYSTERY PLAN", False)
    ]
    assert [txn.amount for txn in txns] == original_amounts
    assert result.profile.other_obligations == 750
    assert result.profile.gross_salary == 10_000

    categorizer_events = [
        event for event in result.events
        if (
            event.payload.get("tool") == "agents.categorizer.categorize"
            or "تصنيف أوصاف العمليات" in event.message_ar
        )
    ]
    assert len(categorizer_events) == 2
    assert categorizer_events[0].payload == {
        "tool": "agents.categorizer.categorize",
        "candidate_count": 1,
    }
    assert categorizer_events[1].payload == {
        "candidate_count": 1,
        "labeled_count": 1,
        "applied_label_count": 1,
        "fallback": False,
    }
    categorizer_payloads = json.dumps(
        [event.payload for event in categorizer_events],
        ensure_ascii=False,
    )
    assert "MYSTERY PLAN" not in categorizer_payloads
    assert "750" not in categorizer_payloads
