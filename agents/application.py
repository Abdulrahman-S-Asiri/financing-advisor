"""Mock Application Agent state machine.

This is intentionally simulation-only. Real lender submission requires lender
agreements, production auth, and regulatory readiness; the demo flow only
tracks a deterministic application lifecycle for a selected offer.
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from core.models import FinancialProfile, MatchResult, MatchStatus


APPLICATION_STATUSES = ("draft", "submitted", "under_review", "approved", "declined")


@dataclass
class ApplicationHistoryItem:
    status: str
    message_ar: str
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class ApplicationRecord:
    application_id: str
    journey_id: str
    offer_id: str
    status: str
    summary: dict[str, Any]
    history: list[ApplicationHistoryItem]
    simulation: bool = True
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "application_id": self.application_id,
            "journey_id": self.journey_id,
            "offer_id": self.offer_id,
            "status": self.status,
            "summary": self.summary,
            "history": [item.__dict__ for item in self.history],
            "simulation": self.simulation,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _history(status: str, message_ar: str) -> ApplicationHistoryItem:
    return ApplicationHistoryItem(status=status, message_ar=message_ar)


def _final_status(profile: FinancialProfile, match: MatchResult) -> str:
    if match.status == MatchStatus.POLICY_REVIEW:
        return "declined"
    seed = f"{profile.persona_id}:{match.offer.id}".encode("utf-8")
    digest = hashlib.sha256(seed).hexdigest()
    return "approved" if int(digest[:2], 16) % 5 != 0 else "declined"


def create_draft(
    journey_id: str,
    profile: FinancialProfile,
    match: MatchResult,
) -> ApplicationRecord:
    if match.status == MatchStatus.INELIGIBLE:
        raise ValueError("Cannot draft an application for an ineligible offer.")

    cost = match.cost
    summary = {
        "applicant_persona_id": profile.persona_id,
        "institution": match.offer.institution,
        "product": match.offer.product_name,
        "offer_status": match.status.value,
        "requested_amount": cost.principal if cost else None,
        "requested_tenor_months": cost.tenor_months if cost else None,
        "monthly_installment": cost.monthly_installment if cost else None,
        "total_amount_payable": cost.total_amount_payable if cost else None,
        "rate_verified": match.offer.rate_verified,
        "simulation_notice_ar": "هذه محاكاة تقديم وليست طلباً مرسلاً إلى جهة تمويل.",
    }
    return ApplicationRecord(
        application_id=str(uuid.uuid4()),
        journey_id=journey_id,
        offer_id=match.offer.id,
        status="draft",
        summary=summary,
        history=[_history("draft", "تم تجهيز مسودة طلب التمويل للمراجعة.")],
    )


def submit(record: ApplicationRecord) -> ApplicationRecord:
    if record.status != "draft":
        return record
    record.status = "submitted"
    record.updated_at = _now()
    record.history.append(_history("submitted", "تم إرسال الطلب التجريبي للمراجعة."))
    return record


def advance(record: ApplicationRecord, final_status: str) -> ApplicationRecord:
    if final_status not in {"approved", "declined"}:
        raise ValueError("final_status must be approved or declined")
    if record.status == "draft":
        return submit(record)
    if record.status == "submitted":
        record.status = "under_review"
        record.updated_at = _now()
        record.history.append(_history("under_review", "الطلب التجريبي تحت المراجعة."))
        return record
    if record.status == "under_review":
        record.status = final_status
        record.updated_at = _now()
        message = (
            "تمت الموافقة في المحاكاة."
            if final_status == "approved"
            else "تم رفض الطلب في المحاكاة."
        )
        record.history.append(_history(final_status, message))
    return record


def final_status_for(profile: FinancialProfile, match: MatchResult) -> str:
    return _final_status(profile, match)
