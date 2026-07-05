"""Offer catalog structural validation.

db/seed_offers.json is hand-edited during data-review passes, so a typo'd
field name or a swapped min/max must fail loudly at load time — not as a
cryptic TypeError mid-request. This module validates the parsed catalog
payload and constructs the Offer objects.

Pure by design (core/ rule: stdlib only, no I/O): callers read the JSON file
themselves and pass the parsed dict here. All problems are collected before
failing so one review pass surfaces every issue, each message carrying the
offer's position and id.
"""
from __future__ import annotations

from core.models import Category, EmploymentType, Offer, Structure

# Sanity bounds. flat_rate_annual is a FRACTION (0.049 = 4.9% flat) — the cap
# catches the classic unit mistake of entering 4.9. Admin-fee cap mirrors the
# engine-side bound used by the pricing tools.
FLAT_RATE_ANNUAL_MAX = 0.5
ADMIN_FEE_PCT_MAX = 0.2
MAX_AGE_AT_MATURITY_RANGE = (18, 100)

_CATEGORY_VALUES = {item.value for item in Category}
_STRUCTURE_VALUES = {item.value for item in Structure}
_EMPLOYMENT_VALUES = {item.value for item in EmploymentType}
_NATIONALITY_VALUES = {"saudi", "expat", "both"}

# Field name -> accepted raw JSON type(s). bool is checked before number
# fields because bool is a subclass of int in Python.
_REQUIRED_FIELDS: dict[str, tuple[type, ...]] = {
    "id": (str,),
    "institution": (str,),
    "product_name": (str,),
    "category": (str,),
    "structure": (str,),
    "flat_rate_annual": (int, float),
    "admin_fee_pct": (int, float),
    "admin_fee_cap_sar": (int, float),
    "min_amount": (int, float),
    "max_amount": (int, float),
    "min_tenor_months": (int,),
    "max_tenor_months": (int,),
    "min_gross_salary": (int, float),
    "salary_transfer_required": (bool,),
    "eligible_employment": (list,),
    "nationality": (str,),
    "max_age_at_maturity": (int,),
}
_OPTIONAL_FIELDS: dict[str, tuple[type, ...]] = {
    "rate_verified": (bool,),
    "source_url": (str,),
    "retrieved_at": (str,),
    "notes": (str,),
}
_KNOWN_FIELDS = set(_REQUIRED_FIELDS) | set(_OPTIONAL_FIELDS)


class OffersCatalogError(ValueError):
    """Raised when the offer catalog payload is structurally invalid."""


def _type_ok(value, expected: tuple[type, ...]) -> bool:
    # bool passes isinstance(..., int); only accept it where bool is expected.
    if isinstance(value, bool):
        return bool in expected
    return isinstance(value, expected)


def _type_names(expected: tuple[type, ...]) -> str:
    names = {int: "integer", float: "number", str: "string", bool: "boolean",
             list: "list"}
    return " or ".join(names[t] for t in expected)


def _offer_errors(raw: dict, label: str) -> list[str]:
    errors: list[str] = []

    unknown = sorted(set(raw) - _KNOWN_FIELDS)
    if unknown:
        errors.append(
            f"{label}: unknown field(s) {', '.join(unknown)} — check for typos "
            f"against core/models.py::Offer."
        )

    for field, expected in _REQUIRED_FIELDS.items():
        if field not in raw:
            errors.append(f"{label}: missing required field '{field}'.")
        elif not _type_ok(raw[field], expected):
            errors.append(
                f"{label}: '{field}' must be a {_type_names(expected)} "
                f"(got {type(raw[field]).__name__})."
            )
    for field, expected in _OPTIONAL_FIELDS.items():
        if field in raw and not _type_ok(raw[field], expected):
            errors.append(
                f"{label}: '{field}' must be a {_type_names(expected)} "
                f"(got {type(raw[field]).__name__})."
            )
    if errors:
        # Value checks below assume presence and correct types.
        return errors

    if raw["category"] not in _CATEGORY_VALUES:
        errors.append(
            f"{label}: category {raw['category']!r} is not one of "
            f"{sorted(_CATEGORY_VALUES)}."
        )
    if raw["structure"] not in _STRUCTURE_VALUES:
        errors.append(
            f"{label}: structure {raw['structure']!r} is not one of "
            f"{sorted(_STRUCTURE_VALUES)}."
        )
    if raw["nationality"] not in _NATIONALITY_VALUES:
        errors.append(
            f"{label}: nationality {raw['nationality']!r} is not one of "
            f"{sorted(_NATIONALITY_VALUES)}."
        )
    if not raw["eligible_employment"]:
        errors.append(f"{label}: eligible_employment must not be empty.")
    else:
        bad = [v for v in raw["eligible_employment"] if v not in _EMPLOYMENT_VALUES]
        if bad:
            errors.append(
                f"{label}: eligible_employment value(s) {bad} not in "
                f"{sorted(_EMPLOYMENT_VALUES)}."
            )

    if not raw["id"].strip():
        errors.append(f"{label}: id must not be empty.")
    if not 0 <= raw["flat_rate_annual"] <= FLAT_RATE_ANNUAL_MAX:
        errors.append(
            f"{label}: flat_rate_annual must be between 0 and "
            f"{FLAT_RATE_ANNUAL_MAX} — it is a fraction, 4.9% flat is 0.049 "
            f"(got {raw['flat_rate_annual']})."
        )
    if not 0 <= raw["admin_fee_pct"] <= ADMIN_FEE_PCT_MAX:
        errors.append(
            f"{label}: admin_fee_pct must be between 0 and {ADMIN_FEE_PCT_MAX} "
            f"(got {raw['admin_fee_pct']})."
        )
    if raw["admin_fee_cap_sar"] < 0:
        errors.append(f"{label}: admin_fee_cap_sar must not be negative.")
    if raw["min_gross_salary"] < 0:
        errors.append(f"{label}: min_gross_salary must not be negative.")
    if raw["min_amount"] <= 0:
        errors.append(f"{label}: min_amount must be positive.")
    elif raw["min_amount"] > raw["max_amount"]:
        errors.append(
            f"{label}: min_amount ({raw['min_amount']:,}) exceeds max_amount "
            f"({raw['max_amount']:,})."
        )
    if raw["min_tenor_months"] <= 0:
        errors.append(f"{label}: min_tenor_months must be positive.")
    elif raw["min_tenor_months"] > raw["max_tenor_months"]:
        errors.append(
            f"{label}: min_tenor_months ({raw['min_tenor_months']}) exceeds "
            f"max_tenor_months ({raw['max_tenor_months']})."
        )
    lo, hi = MAX_AGE_AT_MATURITY_RANGE
    if not lo <= raw["max_age_at_maturity"] <= hi:
        errors.append(
            f"{label}: max_age_at_maturity must be between {lo} and {hi} "
            f"(got {raw['max_age_at_maturity']})."
        )

    return errors


def validate_offers_payload(raw) -> list[str]:
    """All structural problems in a parsed catalog payload, empty if valid.

    Top-level keys other than 'offers' (e.g. the seed file's _README) are
    allowed; unknown keys are rejected per offer, where typos actually hide.
    """
    if not isinstance(raw, dict):
        return ["Catalog payload must be a JSON object with an 'offers' list."]
    offers = raw.get("offers")
    if not isinstance(offers, list):
        return ["Catalog payload must contain an 'offers' list."]
    if not offers:
        return ["Catalog 'offers' list is empty."]

    errors: list[str] = []
    seen_ids: dict[str, int] = {}
    for index, offer in enumerate(offers):
        offer_id = offer.get("id") if isinstance(offer, dict) else None
        label = f"offers[{index}]" + (f" ({offer_id})" if offer_id else "")
        if not isinstance(offer, dict):
            errors.append(f"{label}: each offer must be a JSON object.")
            continue
        errors.extend(_offer_errors(offer, label))
        if isinstance(offer_id, str) and offer_id in seen_ids:
            errors.append(
                f"{label}: duplicate id — already used by "
                f"offers[{seen_ids[offer_id]}]."
            )
        elif isinstance(offer_id, str):
            seen_ids[offer_id] = index
    return errors


def parse_offers_catalog(raw) -> list[Offer]:
    """Validate a parsed catalog payload and construct the Offer list.

    Raises OffersCatalogError listing every problem when invalid.
    """
    errors = validate_offers_payload(raw)
    if errors:
        raise OffersCatalogError(
            "Offer catalog is invalid:\n" + "\n".join(errors)
        )
    return [
        Offer(**{**o, "category": Category(o["category"]),
                 "structure": Structure(o["structure"])})
        for o in raw["offers"]
    ]
