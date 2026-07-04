"""Deterministic tools available to the advisor layer."""
from __future__ import annotations

from dataclasses import replace

from agents.orchestrator import serialize_match
from core import cost, dbr
from core.eligibility import match_offer, rank_matches
from core.models import FinancialProfile, MatchResult, Offer


class AdvisorToolError(ValueError):
    pass


def _find_match(matches: list[MatchResult], offer_id: str) -> MatchResult:
    for match in matches:
        if match.offer.id == offer_id:
            return match
    raise AdvisorToolError("Offer not found in this journey.")


def _offer_payload(offer: Offer) -> dict:
    return {
        "id": offer.id,
        "institution": offer.institution,
        "product_name": offer.product_name,
        "category": offer.category.value,
        "structure": offer.structure.value,
        "flat_rate_annual": offer.flat_rate_annual,
        "admin_fee_pct": offer.admin_fee_pct,
        "admin_fee_cap_sar": offer.admin_fee_cap_sar,
        "min_amount": offer.min_amount,
        "max_amount": offer.max_amount,
        "min_tenor_months": offer.min_tenor_months,
        "max_tenor_months": offer.max_tenor_months,
        "min_gross_salary": offer.min_gross_salary,
        "salary_transfer_required": offer.salary_transfer_required,
        "eligible_employment": offer.eligible_employment,
        "nationality": offer.nationality,
        "max_age_at_maturity": offer.max_age_at_maturity,
        "rate_verified": offer.rate_verified,
        "source_url": offer.source_url,
        "retrieved_at": offer.retrieved_at,
        "notes": offer.notes,
    }


def _dbr_payload(match: MatchResult) -> dict | None:
    if match.dbr is None:
        return None
    return {
        "passes": match.dbr.passes,
        "tier": match.dbr.tier,
        "salary_linked_ratio": match.dbr.salary_linked_ratio,
        "non_real_estate_ratio": match.dbr.non_real_estate_ratio,
        "total_ratio": match.dbr.total_ratio,
        "salary_linked_cap": match.dbr.salary_linked_cap,
        "non_real_estate_cap": match.dbr.non_real_estate_cap,
        "total_cap": match.dbr.total_cap,
        "breaches": match.dbr.breaches,
        "policy_review": match.dbr.policy_review,
    }


def get_offer_detail(matches: list[MatchResult], offer_id: str) -> dict:
    match = _find_match(matches, offer_id)
    payload = serialize_match(match, include_details=True)
    payload["offer"] = _offer_payload(match.offer)
    payload["dbr"] = _dbr_payload(match)
    return payload


def get_payment_schedule(matches: list[MatchResult], offer_id: str) -> list[dict]:
    match = _find_match(matches, offer_id)
    if match.cost is None:
        return []
    return [
        row.__dict__
        for row in cost.payment_schedule(
            match.offer,
            match.cost.principal,
            match.cost.tenor_months,
        )
    ]


def _profile_for_offer(
    profile: FinancialProfile,
    offer: Offer,
    salary_transfer: bool,
) -> FinancialProfile:
    if salary_transfer and offer.salary_transfer_required:
        return replace(profile, salary_bank=offer.institution)
    return profile


def simulate(
    profile: FinancialProfile,
    offers: list[Offer],
    requested_amount: float,
    requested_tenor_months: int,
    *,
    salary_transfer: bool = False,
) -> dict:
    if requested_amount <= 0:
        raise AdvisorToolError("requested_amount must be positive.")
    if requested_tenor_months <= 0:
        raise AdvisorToolError("requested_tenor_months must be positive.")

    results = [
        match_offer(
            offer,
            _profile_for_offer(profile, offer, salary_transfer),
            requested_amount,
            requested_tenor_months,
        )
        for offer in offers
    ]
    ranked = rank_matches(results)
    return {
        "requested_amount": requested_amount,
        "requested_tenor_months": requested_tenor_months,
        "salary_transfer": salary_transfer,
        "max_affordable_new_installment": dbr.max_affordable_installment(profile),
        "matches": [serialize_match(match) for match in ranked],
    }
