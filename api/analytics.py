"""Aggregate outcome analytics for the moat phase.

Analytics responses deliberately avoid raw persona IDs and transaction data.
They are meant to describe portfolio-level product gaps and lender outcomes,
not individual applicants.
"""
from __future__ import annotations

from collections import Counter
from statistics import mean
from typing import Any, Iterable

from agents.application import ApplicationRecord
from core.models import MatchResult, MatchStatus


def _rounded_mean(values: list[float]) -> float | None:
    if not values:
        return None
    return round(mean(values), 2)


def _counter_items(counter: Counter, *, limit: int | None = None) -> list[dict]:
    items = counter.most_common(limit)
    return [{"value": value, "count": count} for value, count in items]


def _actionable(match: MatchResult) -> bool:
    return match.status in {
        MatchStatus.ELIGIBLE,
        MatchStatus.CONDITIONAL,
        MatchStatus.POLICY_REVIEW,
    }


def build_outcome_analytics(
    sessions: Iterable[dict[str, Any]],
    applications: Iterable[ApplicationRecord],
) -> dict:
    session_list = list(sessions)
    application_list = list(applications)

    requested_amounts: list[float] = []
    max_affordable_values: list[float] = []
    journeys_with_path_forward = 0
    match_status_counts: Counter = Counter()
    rejection_reasons: Counter = Counter()
    near_miss_kinds: Counter = Counter()
    institution_counts: Counter = Counter()
    actionable_by_institution: Counter = Counter()
    category_counts: Counter = Counter()
    product_gap_by_category: Counter = Counter()

    for session in session_list:
        requested_amount = session.get("requested_amount")
        if requested_amount is not None:
            requested_amounts.append(float(requested_amount))
        max_affordable = session.get("max_affordable")
        if max_affordable is not None:
            max_affordable_values.append(float(max_affordable))

        matches = list(session.get("matches") or [])
        if any(_actionable(match) for match in matches):
            journeys_with_path_forward += 1

        for match in matches:
            match_status_counts[match.status.value] += 1
            institution_counts[match.offer.institution] += 1
            category_counts[match.offer.category.value] += 1
            if _actionable(match):
                actionable_by_institution[match.offer.institution] += 1
            else:
                product_gap_by_category[match.offer.category.value] += 1
            for reason in match.reasons:
                rejection_reasons[reason] += 1
            for suggestion in match.near_miss_suggestions:
                near_miss_kinds[suggestion.kind] += 1

    application_status_counts = Counter(
        application.status for application in application_list
    )
    simulated_applications = sum(
        1 for application in application_list if application.simulation
    )

    total_journeys = len(session_list)
    path_forward_rate = (
        round(journeys_with_path_forward / total_journeys, 4)
        if total_journeys
        else None
    )

    return {
        "privacy": {
            "anonymized": True,
            "raw_persona_ids_included": False,
            "raw_transactions_included": False,
            "scope": "aggregate_demo_cache",
        },
        "journeys": {
            "total": total_journeys,
            "with_path_forward": journeys_with_path_forward,
            "path_forward_rate": path_forward_rate,
            "average_requested_amount": _rounded_mean(requested_amounts),
            "average_max_affordable_new_installment": _rounded_mean(
                max_affordable_values
            ),
        },
        "matches": {
            "status_counts": dict(match_status_counts),
            "category_counts": dict(category_counts),
            "institution_counts": dict(institution_counts),
            "actionable_by_institution": dict(actionable_by_institution),
            "top_rejection_reasons": _counter_items(rejection_reasons, limit=5),
            "near_miss_kinds": dict(near_miss_kinds),
            "product_gap_by_category": dict(product_gap_by_category),
        },
        "applications": {
            "total": len(application_list),
            "simulation_count": simulated_applications,
            "status_counts": dict(application_status_counts),
        },
        "data_products": [
            {
                "id": "offer_gap_insights",
                "name": "Offer gap insights",
                "status": "specified",
                "inputs": [
                    "match status counts",
                    "rejection reasons",
                    "near-miss suggestions",
                ],
                "output": "Which lender/product constraints block otherwise viable applicants.",
            },
            {
                "id": "lender_conversion_funnel",
                "name": "Lender conversion funnel",
                "status": "specified",
                "inputs": [
                    "selected offer",
                    "application status",
                    "simulation flag",
                ],
                "output": "Per-lender journey outcomes from selection to final status.",
            },
            {
                "id": "approval_likelihood_training_set",
                "name": "Approval likelihood training set",
                "status": "requires_real_outcomes",
                "inputs": [
                    "consented profile features",
                    "engine match trace",
                    "actual lender decision",
                ],
                "output": "Future model-ready dataset after licensed production launch.",
            },
        ],
    }
