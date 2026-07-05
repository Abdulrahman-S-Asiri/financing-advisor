"""Tests for the deterministic finance tools.

Expected values are computed against core/ directly (the engine is the source
of truth), never copied from the tool's own output.
"""
import json

import pytest

from core import cost, dbr
from mcp_server import engine_tools


# --- list_personas ---------------------------------------------------------

def test_list_personas_covers_the_three_demo_beats():
    result = engine_tools.list_personas()
    ids = {p["persona_id"] for p in result["personas"]}
    assert {"sara_strong", "ahmed_borderline", "khalid_rejected"} <= ids
    borderline = next(
        p for p in result["personas"] if p["persona_id"] == "ahmed_borderline"
    )
    assert borderline["monthly_salary"] == 9_500
    assert borderline["monthly_obligations_total"] == 1_700.0


# --- run_journey -----------------------------------------------------------

def test_run_journey_borderline_extracts_seeded_profile():
    result = engine_tools.run_journey("ahmed_borderline", 80_000, 48)
    assert abs(result["profile"]["gross_salary"] - 9_500) < 1
    assert result["matches_total"] >= 1
    statuses = {m["status"] for m in result["matches"]}
    assert statuses <= {"eligible", "conditional", "ineligible", "policy_review"}
    assert all("rate_verified" in m for m in result["matches"])
    assert sum(result["status_counts"].values()) == result["matches_total"]


def test_run_journey_respects_max_offers():
    result = engine_tools.run_journey("sara_strong", 50_000, 36, max_offers=2)
    assert len(result["matches"]) <= 2
    assert result["matches_total"] >= len(result["matches"])


@pytest.mark.parametrize(
    "kwargs",
    [
        {"persona_id": "nobody", "requested_amount": 80_000, "requested_tenor_months": 48},
        {"persona_id": "sara_strong", "requested_amount": 10, "requested_tenor_months": 48},
        {"persona_id": "sara_strong", "requested_amount": 80_000, "requested_tenor_months": 0},
        {"persona_id": "sara_strong", "requested_amount": 80_000,
         "requested_tenor_months": 48, "nationality": "martian"},
        {"persona_id": "sara_strong", "requested_amount": 80_000,
         "requested_tenor_months": 48, "age": 12},
    ],
)
def test_run_journey_rejects_invalid_input(kwargs):
    with pytest.raises(ValueError):
        engine_tools.run_journey(**kwargs)


# --- price_financing -------------------------------------------------------

def test_price_financing_matches_core_math():
    result = engine_tools.price_financing(120_000, 60, flat_rate_annual=0.049)
    expected_installment = cost.monthly_installment_flat(120_000, 0.049, 60)
    assert result["cost"]["monthly_installment"] == round(expected_installment, 2)
    assert result["cost"]["admin_fee"] == 0.0
    # Flat 4.9% over 60 months must land near ~9% effective — the asymmetry
    # the product exists to expose.
    assert 0.08 < result["cost"]["apr_effective"] < 0.11


def test_price_financing_with_catalog_offer_flags_placeholder_rates():
    offer = engine_tools.load_offers()[0]
    result = engine_tools.price_financing(80_000, 48, offer_id=offer.id)
    assert result["offer"]["offer_id"] == offer.id
    expected = cost.price_offer(offer, 80_000, 48)
    assert result["cost"]["total_amount_payable"] == expected.total_amount_payable
    if not offer.rate_verified:
        assert any("PLACEHOLDER" in w for w in result["warnings"])


def test_price_financing_schedule_summary_reconciles():
    result = engine_tools.price_financing(
        60_000, 24, flat_rate_annual=0.04, include_schedule_summary=True
    )
    summary = result["schedule_summary"]
    assert summary["months"] == 24
    assert summary["last_row"]["remaining_principal"] == 0.0


@pytest.mark.parametrize(
    "kwargs",
    [
        {"amount": 80_000, "tenor_months": 48},                              # no rate, no offer
        {"amount": 80_000, "tenor_months": 48, "offer_id": "no-such-offer"},
        {"amount": 80_000, "tenor_months": 48, "flat_rate_annual": 0.9},     # absurd rate
        {"amount": 500, "tenor_months": 48, "flat_rate_annual": 0.05},       # amount too small
    ],
)
def test_price_financing_rejects_invalid_input(kwargs):
    with pytest.raises(ValueError):
        engine_tools.price_financing(**kwargs)


def test_price_financing_warns_on_tenor_above_consumer_cap():
    result = engine_tools.price_financing(80_000, 72, flat_rate_annual=0.05)
    assert any("60" in w for w in result["warnings"])


# --- evaluate_dbr ----------------------------------------------------------

def test_evaluate_dbr_agrees_with_engine():
    result = engine_tools.evaluate_dbr(
        gross_salary=9_500,
        new_installment=2_000,
        salary_linked_obligations=1_400,
        other_obligations=300,
    )
    assert result["decision"]["tier"] == "<=15k"
    # 3,400 salary-linked on 9,500 gross = 35.8% > 33.33% cap -> breach.
    assert result["decision"]["passes"] is False
    expected_ratio = round(3_400 / 9_500, 4)
    assert result["decision"]["salary_linked_ratio"] == expected_ratio


def test_evaluate_dbr_headroom_matches_engine():
    result = engine_tools.evaluate_dbr(gross_salary=18_000, new_installment=0)
    assert result["decision"]["passes"] is True
    assert result["max_affordable_new_installment"]["salary_linked"] == pytest.approx(
        18_000 / 3, abs=1
    )


def test_evaluate_dbr_retiree_uses_25_percent_cap():
    result = engine_tools.evaluate_dbr(
        gross_salary=10_000, new_installment=0, is_retiree=True
    )
    assert result["decision"]["salary_linked_cap"] == dbr.SALARY_LINKED_CAP_RETIREE


def test_evaluate_dbr_rejects_negative_values():
    with pytest.raises(ValueError):
        engine_tools.evaluate_dbr(gross_salary=-1, new_installment=0)


# --- offer_verification_status ---------------------------------------------

def test_offer_verification_status_shape():
    report = engine_tools.offer_verification_status()
    assert report["total_offers"] == len(engine_tools.load_offers())
    assert report["verified_count"] + report["unverified_count"] == report["total_offers"]
    assert isinstance(report["ready_for_public_demo"], bool)
    json.dumps(report)  # must be JSON-serializable end to end
