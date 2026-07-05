"""Deterministic finance tools over the project's own engine.

Everything here calls existing, unit-tested code in core/ (and the seeded
personas in mock_open_banking/). No LLM, no network, no invented numbers —
the same "code calculates" rule the product itself follows.
"""
from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from agents import orchestrator
from core import cost, dbr
from core.models import Category, EmploymentType, FinancialProfile, Offer, Structure
from core.offer_verification import verify_offers
from core.offers_catalog import parse_offers_catalog
from core.profile import Txn
from mcp_server.validation import require_choice, require_int, require_number
from mock_open_banking.personas import PERSONAS, generate_transactions

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OFFERS_PATH = PROJECT_ROOT / "db" / "seed_offers.json"

# Sanity bounds for hypothetical inputs — wide enough for any real scenario,
# tight enough to catch unit mistakes (halalas vs riyals, years vs months).
AMOUNT_RANGE = (1_000.0, 5_000_000.0)
TENOR_RANGE = (1, 360)
MONEY_RANGE = (0.0, 10_000_000.0)
FLAT_RATE_RANGE = (0.0, 0.5)

_PERSONA_ROLES = {
    "sara_strong": "approved with headroom (gov salary, clean file)",
    "ahmed_borderline": "mixed outcomes (existing installments, tight headroom)",
    "khalid_rejected": "rejected everywhere with clear reasons",
}

_MAX_VERIFICATION_ISSUES = 40


def load_offers() -> list[Offer]:
    """Canonical load through the core validation gate. An invalid catalog
    raises OffersCatalogError (a ValueError) listing every problem — the same
    behavior the API has at startup."""
    raw = json.loads(OFFERS_PATH.read_text(encoding="utf-8"))
    return parse_offers_catalog(raw)


def list_personas() -> dict:
    """Seeded demo personas with their financial shape and demo role."""
    personas = []
    for persona_id, spec in PERSONAS.items():
        personas.append(
            {
                "persona_id": persona_id,
                "bank": spec.bank,
                "monthly_salary": spec.salary,
                "age": spec.age,
                "monthly_obligations_total": round(
                    sum(amount for _, amount in spec.obligations), 2
                ),
                "obligation_count": len(spec.obligations),
                "rental_income": spec.rent_out,
                "demo_role": _PERSONA_ROLES.get(persona_id, ""),
            }
        )
    return {"personas": personas, "note": "Transactions are seeded — identical bytes every run."}


def run_journey(
    persona_id: str,
    requested_amount: float,
    requested_tenor_months: int,
    age: int | None = None,
    nationality: str = "saudi",
    max_offers: int = 10,
) -> dict:
    """Run the full deterministic journey pipeline in-process for a persona."""
    persona_id = require_choice("persona_id", persona_id, tuple(PERSONAS))
    requested_amount = require_number("requested_amount", requested_amount, *AMOUNT_RANGE)
    requested_tenor_months = require_int("requested_tenor_months", requested_tenor_months, *TENOR_RANGE)
    nationality = require_choice("nationality", nationality, ("saudi", "expat"))
    max_offers = require_int("max_offers", max_offers, 1, 50)

    spec = PERSONAS[persona_id]
    if age is None:
        age = spec.age
    age = require_int("age", age, 18, 80)

    txns = [Txn.from_ais(t, bank=spec.bank) for t in generate_transactions(persona_id)]
    result = orchestrator.run_journey(
        persona_id=persona_id,
        txns=txns,
        offers=load_offers(),
        requested_amount=requested_amount,
        requested_tenor_months=requested_tenor_months,
        age=age,
        nationality=nationality,
    )

    payload = orchestrator.serialize_journey(
        result.journey_id, result.profile, result.matches, result.max_affordable
    )
    status_counts: dict[str, int] = {}
    for match in result.matches:
        status_counts[match.status.value] = status_counts.get(match.status.value, 0) + 1

    payload["request"] = {
        "persona_id": persona_id,
        "requested_amount": requested_amount,
        "requested_tenor_months": requested_tenor_months,
        "age": age,
        "nationality": nationality,
    }
    payload["status_counts"] = status_counts
    payload["matches_total"] = len(payload["matches"])
    payload["matches"] = payload["matches"][:max_offers]
    payload["agent_event_count"] = len(result.events)
    return payload


def price_financing(
    amount: float,
    tenor_months: int,
    flat_rate_annual: float | None = None,
    admin_fee_pct: float = 0.0,
    admin_fee_cap_sar: float = 0.0,
    offer_id: str | None = None,
    include_schedule_summary: bool = False,
) -> dict:
    """Price a financing scenario: installment, total payable, effective APR.

    Either pass offer_id (uses the catalog offer's rate and fees) or pass
    flat_rate_annual (+ optional fee terms) for an ad-hoc scenario.
    """
    amount = require_number("amount", amount, *AMOUNT_RANGE)
    tenor_months = require_int("tenor_months", tenor_months, *TENOR_RANGE)

    warnings: list[str] = []
    offer_meta: dict | None = None

    if offer_id is not None:
        offers = {offer.id: offer for offer in load_offers()}
        if offer_id not in offers:
            raise ValueError(
                f"offer_id {offer_id!r} not found. Available: {', '.join(sorted(offers))}."
            )
        offer = offers[offer_id]
        offer_meta = {
            "offer_id": offer.id,
            "institution": offer.institution,
            "product": offer.product_name,
            "structure": offer.structure.value,
            "rate_verified": offer.rate_verified,
            "source_url": offer.source_url,
        }
        if not offer.rate_verified:
            warnings.append("PLACEHOLDER RATE: this offer's pricing is not verified against a published source.")
        if not (offer.min_amount <= amount <= offer.max_amount):
            warnings.append(
                f"Amount is outside this product's range (SAR {offer.min_amount:,.0f}"
                f"-{offer.max_amount:,.0f}); pricing shown is hypothetical."
            )
        if not (offer.min_tenor_months <= tenor_months <= offer.max_tenor_months):
            warnings.append(
                f"Tenor is outside this product's range ({offer.min_tenor_months}"
                f"-{offer.max_tenor_months} months); pricing shown is hypothetical."
            )
        if offer.category != Category.REAL_ESTATE and tenor_months > dbr.MAX_CONSUMER_TENOR_MONTHS:
            warnings.append(
                f"Tenor exceeds the SAMA {dbr.MAX_CONSUMER_TENOR_MONTHS}-month consumer cap."
            )
    else:
        if flat_rate_annual is None:
            raise ValueError("Pass either offer_id or flat_rate_annual.")
        flat_rate_annual = require_number("flat_rate_annual", flat_rate_annual, *FLAT_RATE_RANGE)
        admin_fee_pct = require_number("admin_fee_pct", admin_fee_pct, 0.0, 0.2)
        admin_fee_cap_sar = require_number("admin_fee_cap_sar", admin_fee_cap_sar, 0.0, 100_000.0)
        # Minimal Offer shell: price_offer only reads the three pricing fields.
        offer = Offer(
            id="adhoc", institution="", product_name="", category=Category.PERSONAL,
            structure=Structure.TAWARRUQ, flat_rate_annual=flat_rate_annual,
            admin_fee_pct=admin_fee_pct, admin_fee_cap_sar=admin_fee_cap_sar,
            min_amount=0, max_amount=0, min_tenor_months=0, max_tenor_months=0,
            min_gross_salary=0, salary_transfer_required=False,
            eligible_employment=[], nationality="both", max_age_at_maturity=0,
        )
        if tenor_months > dbr.MAX_CONSUMER_TENOR_MONTHS:
            warnings.append(
                f"Tenor exceeds the SAMA {dbr.MAX_CONSUMER_TENOR_MONTHS}-month consumer "
                "cap (allowed only for real estate)."
            )

    breakdown = cost.price_offer(offer, amount, tenor_months)
    result: dict = {"cost": asdict(breakdown), "warnings": warnings}
    if offer_meta:
        result["offer"] = offer_meta

    if include_schedule_summary:
        rows = cost.payment_schedule(offer, amount, tenor_months)
        result["schedule_summary"] = {
            "months": len(rows),
            "first_row": asdict(rows[0]),
            "last_row": asdict(rows[-1]),
            "note": "Full month-by-month schedules come from core.cost.payment_schedule "
                    "or GET /advisor/tools/{journey_id}/offers/{offer_id}/payment-schedule.",
        }
    return result


def evaluate_dbr(
    gross_salary: float,
    new_installment: float,
    other_monthly_income_avg: float = 0.0,
    salary_linked_obligations: float = 0.0,
    other_obligations: float = 0.0,
    real_estate_obligations: float = 0.0,
    is_retiree: bool = False,
    mohousing_or_redf_beneficiary: bool = False,
    new_is_salary_linked: bool = True,
    new_is_real_estate: bool = False,
) -> dict:
    """Evaluate a hypothetical profile against the SAMA DBR caps (core.dbr)."""
    gross_salary = require_number("gross_salary", gross_salary, *MONEY_RANGE)
    new_installment = require_number("new_installment", new_installment, *MONEY_RANGE)
    other_monthly_income_avg = require_number(
        "other_monthly_income_avg", other_monthly_income_avg, *MONEY_RANGE
    )
    salary_linked_obligations = require_number(
        "salary_linked_obligations", salary_linked_obligations, *MONEY_RANGE
    )
    other_obligations = require_number("other_obligations", other_obligations, *MONEY_RANGE)
    real_estate_obligations = require_number(
        "real_estate_obligations", real_estate_obligations, *MONEY_RANGE
    )

    profile = FinancialProfile(
        persona_id="hypothetical",
        gross_salary=gross_salary,
        other_monthly_income_avg=other_monthly_income_avg,
        employment_type=EmploymentType.RETIREE if is_retiree else EmploymentType.PRIVATE,
        is_retiree=is_retiree,
        salary_linked_obligations=salary_linked_obligations,
        other_obligations=other_obligations,
        real_estate_obligations=real_estate_obligations,
        mohousing_or_redf_beneficiary=mohousing_or_redf_beneficiary,
    )
    decision = dbr.evaluate(
        profile,
        new_installment=new_installment,
        new_is_salary_linked=new_is_salary_linked,
        new_is_real_estate=new_is_real_estate,
    )
    return {
        "inputs_note": "Other periodic income counts at 50% (SAMA para 16.b) inside total_monthly_income.",
        "total_monthly_income": profile.total_monthly_income,
        "decision": asdict(decision),
        "max_affordable_new_installment": {
            "salary_linked": dbr.max_affordable_installment(profile, salary_linked=True),
            "not_salary_linked": dbr.max_affordable_installment(profile, salary_linked=False),
        },
    }


def offer_verification_status() -> dict:
    """Rate-verification coverage of the offer catalog: how much of it is
    placeholder vs verified vs stale, and the gap to the demo target."""
    report = verify_offers(load_offers()).to_dict()
    issues = report.get("issues", [])
    if len(issues) > _MAX_VERIFICATION_ISSUES:
        report["issues"] = issues[:_MAX_VERIFICATION_ISSUES]
        report["issues_truncated"] = len(issues) - _MAX_VERIFICATION_ISSUES
    return report
