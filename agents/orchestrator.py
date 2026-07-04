"""Journey orchestrator for the deterministic financing pipeline."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from agents.events import AgentEvent, AgentEventType, AgentName, EventRecorder
from core import cost, dbr
from core.eligibility import match_offer, rank_matches
from core.models import FinancialProfile, MatchResult, MatchStatus, Offer
from core.profile import Txn, extract_profile


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


def _financial_health_payload(
    profile: FinancialProfile,
    max_affordable: float,
) -> dict:
    current_dbr = dbr.evaluate(
        profile,
        new_installment=0.0,
        new_is_salary_linked=True,
    )
    return {
        "tier": current_dbr.tier,
        "salary_linked_ratio": current_dbr.salary_linked_ratio,
        "non_real_estate_ratio": current_dbr.non_real_estate_ratio,
        "total_ratio": current_dbr.total_ratio,
        "salary_linked_cap": current_dbr.salary_linked_cap,
        "non_real_estate_cap": current_dbr.non_real_estate_cap,
        "total_cap": current_dbr.total_cap,
        "policy_review": current_dbr.policy_review,
        "breaches": current_dbr.breaches,
        "max_affordable_new_installment": max_affordable,
        "monthly_obligations": _obligations_total(profile),
    }


def serialize_match(match: MatchResult) -> dict:
    return {
        "offer_id": match.offer.id,
        "institution": match.offer.institution,
        "product": match.offer.product_name,
        "category": match.offer.category.value,
        "structure": match.offer.structure.value,
        "status": match.status.value,
        "monthly_installment": (
            match.cost.monthly_installment if match.cost else None
        ),
        "apr_effective": match.cost.apr_effective if match.cost else None,
        "total_amount_payable": (
            match.cost.total_amount_payable if match.cost else None
        ),
        "cost_breakdown": match.cost.__dict__ if match.cost else None,
        "dbr": _dbr_payload(match),
        "payment_schedule": [
            row.__dict__
            for row in (
                cost.payment_schedule(
                    match.offer,
                    match.cost.principal,
                    match.cost.tenor_months,
                )
                if match.cost
                else []
            )
        ],
        "reasons": match.reasons,
        "conditions": match.conditions,
        "rate_verified": match.offer.rate_verified,
        "source_url": match.offer.source_url,
        "retrieved_at": match.offer.retrieved_at,
        "near_miss_suggestions": [
            {
                "kind": suggestion.kind,
                "message": suggestion.message,
                "requested_amount": suggestion.requested_amount,
                "requested_tenor_months": suggestion.requested_tenor_months,
                "monthly_installment": suggestion.monthly_installment,
                "status": suggestion.status.value if suggestion.status else None,
            }
            for suggestion in match.near_miss_suggestions
        ],
    }


@dataclass
class JourneyResult:
    journey_id: str
    profile: FinancialProfile
    matches: list[MatchResult]
    max_affordable: float
    events: list[AgentEvent]

    def response_payload(self, include_events: bool = True) -> dict:
        payload = serialize_journey(
            self.journey_id,
            self.profile,
            self.matches,
            self.max_affordable,
        )
        if include_events:
            payload["events"] = [event.to_dict() for event in self.events]
        return payload


def serialize_journey(
    journey_id: str,
    profile: FinancialProfile,
    matches: list[MatchResult],
    max_affordable: float,
) -> dict:
    return {
        "journey_id": journey_id,
        "profile": {
            **profile.__dict__,
            "employment_type": profile.employment_type.value,
            "total_monthly_income": profile.total_monthly_income,
        },
        "max_affordable_new_installment": max_affordable,
        "financial_health": _financial_health_payload(profile, max_affordable),
        "matches": [serialize_match(match) for match in matches],
        "suggested_questions": suggested_questions(matches),
    }


def suggested_questions(matches: list[MatchResult]) -> list[str]:
    questions: list[str] = []
    if any(match.status == MatchStatus.ELIGIBLE for match in matches):
        questions.append("لماذا هذا أفضل خيار متاح؟")
    elif any(match.status == MatchStatus.CONDITIONAL for match in matches):
        questions.append("ما الشروط المطلوبة لتحويل العرض إلى مؤهل؟")

    if any(match.near_miss_suggestions for match in matches):
        questions.append("ما أقل تغيير يجعلني أتأهل؟")
    if any(match.status == MatchStatus.CONDITIONAL for match in matches):
        questions.append("ماذا يتغير إذا حولت راتبي؟")
    if any(not match.offer.rate_verified for match in matches):
        questions.append("كيف أتعامل مع الأسعار غير المؤكدة؟")

    return questions[:4]


def _status_counts(matches: list[MatchResult]) -> dict[str, int]:
    return {
        status.value: sum(1 for match in matches if match.status == status)
        for status in MatchStatus
    }


def _obligations_total(profile: FinancialProfile) -> float:
    return round(
        profile.salary_linked_obligations
        + profile.other_obligations
        + profile.real_estate_obligations,
        2,
    )


def _priced_matches(matches: list[MatchResult]) -> list[MatchResult]:
    return [match for match in matches if match.cost is not None]


def _cheapest_savings_payload(matches: list[MatchResult]) -> dict:
    visible_cost_statuses = {
        MatchStatus.ELIGIBLE,
        MatchStatus.CONDITIONAL,
        MatchStatus.POLICY_REVIEW,
    }
    priced = sorted(
        (
            match
            for match in matches
            if match.cost is not None and match.status in visible_cost_statuses
        ),
        key=lambda match: match.cost.total_amount_payable,
    )
    if not priced:
        return {"priced_offer_count": len(_priced_matches(matches))}

    cheapest = priced[0]
    payload = {
        "priced_offer_count": len(_priced_matches(matches)),
        "cheapest_offer_id": cheapest.offer.id,
        "cheapest_institution": cheapest.offer.institution,
        "cheapest_total_amount_payable": cheapest.cost.total_amount_payable,
    }
    if len(priced) > 1:
        payload["savings_vs_next_offer"] = round(
            priced[1].cost.total_amount_payable
            - cheapest.cost.total_amount_payable,
            2,
        )
    return payload


def run_journey(
    *,
    persona_id: str,
    txns: list[Txn],
    offers: list[Offer],
    requested_amount: float,
    requested_tenor_months: int,
    age: int,
    nationality: str,
    journey_id: str | None = None,
) -> JourneyResult:
    journey_id = journey_id or str(uuid.uuid4())
    events = EventRecorder(journey_id)

    events.emit(
        AgentEventType.AGENT_STARTED,
        AgentName.FINANCIAL_PROFILE,
        "بدأ وكيل الملف المالي تحليل العمليات.",
        {"transaction_count": len(txns)},
    )
    events.emit(
        AgentEventType.TOOL_CALLED,
        AgentName.FINANCIAL_PROFILE,
        "استدعاء أداة استخراج الراتب والالتزامات.",
        {"tool": "core.profile.extract_profile"},
    )
    profile = extract_profile(
        persona_id,
        txns,
        age=age,
        nationality=nationality,
    )
    events.emit(
        AgentEventType.FINDING,
        AgentName.FINANCIAL_PROFILE,
        "تم تحديد الدخل والالتزامات المتكررة.",
        {
            "gross_salary": profile.gross_salary,
            "total_monthly_income": profile.total_monthly_income,
            "monthly_obligations": _obligations_total(profile),
            "months_observed": profile.months_observed,
            "salary_bank": profile.salary_bank,
        },
    )
    events.emit(
        AgentEventType.AGENT_COMPLETED,
        AgentName.FINANCIAL_PROFILE,
        "اكتمل تحليل الملف المالي.",
    )

    events.emit(
        AgentEventType.AGENT_STARTED,
        AgentName.MATCHING,
        "بدأ وكيل المطابقة اختبار العروض.",
        {"offer_count": len(offers)},
    )
    events.emit(
        AgentEventType.TOOL_CALLED,
        AgentName.MATCHING,
        "استدعاء محرك الأهلية لكل عرض.",
        {
            "tool": "core.eligibility.match_offer",
            "requested_amount": requested_amount,
            "requested_tenor_months": requested_tenor_months,
        },
    )
    results = [
        match_offer(offer, profile, requested_amount, requested_tenor_months)
        for offer in offers
    ]
    ranked = rank_matches(results)
    events.emit(
        AgentEventType.FINDING,
        AgentName.MATCHING,
        "تم تصنيف العروض حسب الأهلية والتكلفة.",
        {
            "status_counts": _status_counts(ranked),
            "near_miss_count": sum(
                len(match.near_miss_suggestions) for match in ranked
            ),
        },
    )
    events.emit(
        AgentEventType.AGENT_COMPLETED,
        AgentName.MATCHING,
        "اكتملت مطابقة العروض.",
    )

    events.emit(
        AgentEventType.AGENT_STARTED,
        AgentName.COST,
        "بدأ وكيل التكلفة مقارنة إجمالي السداد.",
    )
    events.emit(
        AgentEventType.TOOL_CALLED,
        AgentName.COST,
        "قراءة نتائج التسعير المحسوبة من المحرك.",
        {"tool": "core.cost.price_offer"},
    )
    max_affordable = dbr.max_affordable_installment(profile)
    events.emit(
        AgentEventType.FINDING,
        AgentName.COST,
        "تم تحديد أرخص مسار متاح ومساحة القسط الجديدة.",
        {
            **_cheapest_savings_payload(ranked),
            "max_affordable_new_installment": max_affordable,
        },
    )
    events.emit(
        AgentEventType.AGENT_COMPLETED,
        AgentName.COST,
        "اكتملت مقارنة التكلفة.",
    )

    final_payload = serialize_journey(journey_id, profile, ranked, max_affordable)
    events.emit(
        AgentEventType.JOURNEY_COMPLETED,
        None,
        "اكتملت رحلة تحليل التمويل.",
        final_payload,
    )

    return JourneyResult(
        journey_id=journey_id,
        profile=profile,
        matches=ranked,
        max_affordable=max_affordable,
        events=events.events,
    )
