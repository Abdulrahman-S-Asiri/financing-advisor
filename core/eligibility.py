"""Eligibility rules engine.

Every check produces a human-readable reason. The rejection explanation is
the demo's strongest moment ("here is exactly why, and what would change
it"), so reasons are written for end users, not logs.

Order of checks is deliberate: cheap static gates first (amount, tenor,
salary floor, employment, nationality, age), DBR last — DBR needs the
installment, which needs the cost engine.
"""
from __future__ import annotations

from core import cost, dbr
from core.models import (
    Category,
    FinancialProfile,
    MatchResult,
    MatchStatus,
    Offer,
)


def match_offer(
    offer: Offer,
    profile: FinancialProfile,
    requested_amount: float,
    requested_tenor_months: int,
) -> MatchResult:
    reasons: list[str] = []
    conditions: list[str] = []

    # --- static gates -------------------------------------------------
    if requested_amount < offer.min_amount:
        reasons.append(
            f"Requested amount SAR {requested_amount:,.0f} is below this product's "
            f"minimum of SAR {offer.min_amount:,.0f}."
        )
    if requested_amount > offer.max_amount:
        reasons.append(
            f"Requested amount SAR {requested_amount:,.0f} exceeds this product's "
            f"maximum of SAR {offer.max_amount:,.0f}."
        )

    tenor = requested_tenor_months
    if offer.category != Category.REAL_ESTATE and tenor > dbr.MAX_CONSUMER_TENOR_MONTHS:
        reasons.append(
            f"Consumer finance tenor cannot exceed {dbr.MAX_CONSUMER_TENOR_MONTHS} months "
            f"under SAMA Responsible Lending Principles (requested {tenor})."
        )
    if tenor < offer.min_tenor_months or tenor > offer.max_tenor_months:
        reasons.append(
            f"Tenor {tenor} months is outside this product's range "
            f"({offer.min_tenor_months}-{offer.max_tenor_months})."
        )

    if profile.gross_salary < offer.min_gross_salary:
        reasons.append(
            f"Detected gross salary SAR {profile.gross_salary:,.0f} is below this "
            f"product's minimum of SAR {offer.min_gross_salary:,.0f}."
        )

    if profile.employment_type.value not in offer.eligible_employment:
        reasons.append(
            f"Employment type '{profile.employment_type.value}' is not eligible; this "
            f"product accepts: {', '.join(offer.eligible_employment)}."
        )

    if offer.nationality != "both" and profile.nationality != offer.nationality:
        reasons.append(
            f"This product is limited to {offer.nationality} applicants."
        )

    age_at_maturity = profile.age + tenor // 12
    if age_at_maturity > offer.max_age_at_maturity:
        reasons.append(
            f"Age at maturity would be {age_at_maturity}, above the product cap of "
            f"{offer.max_age_at_maturity}."
        )

    # --- cost + DBR ----------------------------------------------------
    breakdown = None
    decision = None
    if not reasons:
        breakdown = cost.price_offer(offer, requested_amount, tenor)
        decision = dbr.evaluate(
            profile,
            new_installment=breakdown.monthly_installment,
            new_is_salary_linked=offer.salary_transfer_required,
            new_is_real_estate=(offer.category == Category.REAL_ESTATE),
        )
        if not decision.passes:
            reasons.extend(decision.breaches)

    # --- status --------------------------------------------------------
    if reasons:
        status = MatchStatus.INELIGIBLE
    elif decision is not None and decision.policy_review:
        status = MatchStatus.POLICY_REVIEW
        conditions.append(
            "Income is in the >= SAR 25,000 tier: final approval depends on the "
            "creditor's internal credit policy for non-salary-linked obligations."
        )
    elif offer.salary_transfer_required and profile.salary_bank != offer.institution:
        status = MatchStatus.CONDITIONAL
        conditions.append(
            f"Requires transferring your salary to {offer.institution} "
            f"(currently detected at {profile.salary_bank or 'another bank'})."
        )
    else:
        status = MatchStatus.ELIGIBLE

    if not offer.rate_verified:
        conditions.append(
            "Rate shown is a placeholder pending verification against the "
            "institution's published pricing."
        )

    return MatchResult(
        offer=offer,
        status=status,
        reasons=reasons,
        conditions=conditions,
        cost=breakdown,
        dbr=decision,
    )


def rank_matches(results: list[MatchResult]) -> list[MatchResult]:
    """Eligible and conditional offers first, cheapest total cost first;
    policy-review next; ineligible last (kept — their reasons are the
    explainability story)."""
    order = {
        MatchStatus.ELIGIBLE: 0,
        MatchStatus.CONDITIONAL: 1,
        MatchStatus.POLICY_REVIEW: 2,
        MatchStatus.INELIGIBLE: 3,
    }
    return sorted(
        results,
        key=lambda r: (
            order[r.status],
            r.cost.total_amount_payable if r.cost else float("inf"),
        ),
    )
