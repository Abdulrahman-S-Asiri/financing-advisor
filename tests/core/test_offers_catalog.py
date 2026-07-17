"""Catalog validation gate tests.

The live seed file must pass its own gate (written first, per plan), and each
violation class must produce a readable, id-carrying error message.
"""
import json
from pathlib import Path

import pytest

from core.models import Offer
from core.offers_catalog import (
    OffersCatalogError,
    parse_offers_catalog,
    validate_offers_payload,
)

SEED_PATH = Path(__file__).resolve().parents[2] / "db" / "seed_offers.json"


def _valid_offer(**overrides) -> dict:
    offer = {
        "id": "test-personal-tawarruq",
        "institution": "Test Bank",
        "product_name": "Personal Finance",
        "category": "personal",
        "structure": "tawarruq",
        "flat_rate_annual": 0.049,
        "admin_fee_pct": 0.01,
        "admin_fee_cap_sar": 5000,
        "min_amount": 10000,
        "max_amount": 500000,
        "min_tenor_months": 12,
        "max_tenor_months": 60,
        "min_gross_salary": 4000,
        "salary_transfer_required": True,
        "eligible_employment": ["government", "private"],
        "nationality": "both",
        "max_age_at_maturity": 60,
        "rate_verified": False,
        "source_url": "https://example.com",
    }
    offer.update(overrides)
    return offer


def _payload(*offers: dict) -> dict:
    return {"offers": list(offers)}


def test_live_seed_catalog_passes_the_gate():
    raw = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    offers = parse_offers_catalog(raw)
    assert len(offers) == len(raw["offers"])
    assert all(isinstance(offer, Offer) for offer in offers)


def test_top_level_readme_key_is_allowed():
    payload = {"_README": "notes", "offers": [_valid_offer()]}
    assert validate_offers_payload(payload) == []


@pytest.mark.parametrize(
    "payload, fragment",
    [
        ("not a dict", "JSON object"),
        ({}, "'offers' list"),
        ({"offers": "nope"}, "'offers' list"),
        ({"offers": []}, "empty"),
        ({"offers": ["not a dict"]}, "JSON object"),
    ],
)
def test_top_level_shape_violations(payload, fragment):
    errors = validate_offers_payload(payload)
    assert len(errors) == 1 and fragment in errors[0]


def test_unknown_key_typo_is_caught():
    offer = _valid_offer()
    offer["rate_verifed"] = True  # typo of rate_verified
    del offer["rate_verified"]
    errors = validate_offers_payload(_payload(offer))
    assert any("rate_verifed" in e and "typos" in e for e in errors)


def test_missing_required_field():
    offer = _valid_offer()
    del offer["min_gross_salary"]
    errors = validate_offers_payload(_payload(offer))
    assert errors == [
        "offers[0] (test-personal-tawarruq): missing required field 'min_gross_salary'."
    ]


@pytest.mark.parametrize(
    "overrides, fragment",
    [
        ({"flat_rate_annual": "high"}, "'flat_rate_annual' must be a"),
        ({"flat_rate_annual": True}, "'flat_rate_annual' must be a"),  # bool is not a rate
        ({"salary_transfer_required": 1}, "'salary_transfer_required' must be a boolean"),
        ({"min_tenor_months": 12.5}, "'min_tenor_months' must be a integer"),
        ({"eligible_employment": "private"}, "'eligible_employment' must be a list"),
        ({"category": "credit_card"}, "category 'credit_card' is not one of"),
        ({"structure": "leasing"}, "structure 'leasing' is not one of"),
        ({"nationality": "gcc"}, "nationality 'gcc' is not one of"),
        ({"eligible_employment": []}, "must not be empty"),
        ({"eligible_employment": ["private", "student"]}, "['student']"),
        ({"id": "  "}, "id must not be empty"),
        ({"flat_rate_annual": 4.9}, "4.9% flat is 0.049"),  # the unit mistake
        ({"admin_fee_pct": 0.5}, "admin_fee_pct must be between"),
        ({"admin_fee_cap_sar": -1}, "admin_fee_cap_sar"),
        ({"min_gross_salary": -100}, "min_gross_salary"),
        ({"min_amount": 0}, "min_amount must be positive"),
        ({"min_amount": 600000}, "exceeds max_amount"),
        ({"min_tenor_months": 0}, "min_tenor_months must be positive"),
        ({"min_tenor_months": 72}, "exceeds max_tenor_months"),
        ({"max_age_at_maturity": 150}, "max_age_at_maturity must be between"),
    ],
)
def test_single_violation_produces_readable_error(overrides, fragment):
    errors = validate_offers_payload(_payload(_valid_offer(**overrides)))
    assert any(fragment in e for e in errors), errors
    assert all(e.startswith("offers[0]") for e in errors)


def test_duplicate_ids_are_rejected():
    errors = validate_offers_payload(_payload(_valid_offer(), _valid_offer()))
    assert any("duplicate id" in e and "offers[0]" in e for e in errors)


def test_all_errors_are_collected_not_just_the_first():
    bad_one = _valid_offer(flat_rate_annual=4.9)
    bad_two = _valid_offer(id="other-offer", category="credit_card")
    errors = validate_offers_payload(_payload(bad_one, bad_two))
    assert any("offers[0]" in e for e in errors)
    assert any("offers[1] (other-offer)" in e for e in errors)


def test_parse_raises_with_joined_messages():
    with pytest.raises(OffersCatalogError) as exc:
        parse_offers_catalog(_payload(_valid_offer(min_amount=0), _valid_offer(id="x", structure="leasing")))
    message = str(exc.value)
    assert message.startswith("Offer catalog is invalid:")
    assert "min_amount" in message and "leasing" in message


def test_parse_constructs_typed_offers():
    offers = parse_offers_catalog(_payload(_valid_offer()))
    assert offers[0].category.value == "personal"
    assert offers[0].structure.value == "tawarruq"
    assert offers[0].rate_verified is False
