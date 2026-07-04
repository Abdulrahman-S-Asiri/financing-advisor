"""Offer catalog verification checks.

This module does not fetch live bank pages. It validates the local catalog so
placeholder rates cannot look production-ready by accident.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from core.models import Offer


TARGET_MIN_OFFERS = 15
STALE_AFTER_DAYS = 30


@dataclass(frozen=True)
class OfferVerificationIssue:
    offer_id: str | None
    severity: str
    code: str
    message: str

    def to_dict(self) -> dict:
        return {
            "offer_id": self.offer_id,
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
        }


@dataclass(frozen=True)
class OfferVerificationReport:
    total_offers: int
    verified_count: int
    unverified_count: int
    missing_source_count: int
    stale_verified_count: int
    target_min_offers: int
    ready_for_public_demo: bool
    issues: list[OfferVerificationIssue]

    def to_dict(self) -> dict:
        return {
            "total_offers": self.total_offers,
            "verified_count": self.verified_count,
            "unverified_count": self.unverified_count,
            "missing_source_count": self.missing_source_count,
            "stale_verified_count": self.stale_verified_count,
            "target_min_offers": self.target_min_offers,
            "ready_for_public_demo": self.ready_for_public_demo,
            "issues": [issue.to_dict() for issue in self.issues],
        }


def _parse_retrieved_at(value: str) -> date | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized).date()
    except ValueError:
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None


def verify_offers(
    offers: list[Offer],
    *,
    today: date | None = None,
    target_min_offers: int = TARGET_MIN_OFFERS,
    stale_after_days: int = STALE_AFTER_DAYS,
) -> OfferVerificationReport:
    today = today or date.today()
    issues: list[OfferVerificationIssue] = []
    seen_ids: set[str] = set()
    verified_count = 0
    missing_source_count = 0
    stale_verified_count = 0

    if len(offers) < target_min_offers:
        issues.append(
            OfferVerificationIssue(
                offer_id=None,
                severity="warning",
                code="target_offer_count",
                message=(
                    f"Catalog has {len(offers)} offers; target is at least "
                    f"{target_min_offers} verified market offers."
                ),
            )
        )

    for offer in offers:
        if offer.id in seen_ids:
            issues.append(
                OfferVerificationIssue(
                    offer_id=offer.id,
                    severity="error",
                    code="duplicate_offer_id",
                    message="Offer id must be unique.",
                )
            )
        seen_ids.add(offer.id)

        if not offer.source_url:
            missing_source_count += 1
            issues.append(
                OfferVerificationIssue(
                    offer_id=offer.id,
                    severity="error",
                    code="missing_source_url",
                    message="Offer must include the source page used for review.",
                )
            )

        if not offer.rate_verified:
            issues.append(
                OfferVerificationIssue(
                    offer_id=offer.id,
                    severity="warning",
                    code="placeholder_rate",
                    message="Rate is not verified and must remain visibly flagged.",
                )
            )
            continue

        verified_count += 1
        retrieved_at = _parse_retrieved_at(offer.retrieved_at)
        if retrieved_at is None:
            issues.append(
                OfferVerificationIssue(
                    offer_id=offer.id,
                    severity="error",
                    code="missing_retrieved_at",
                    message="Verified rates require a retrieved_at date.",
                )
            )
            continue

        age_days = (today - retrieved_at).days
        if age_days > stale_after_days:
            stale_verified_count += 1
            issues.append(
                OfferVerificationIssue(
                    offer_id=offer.id,
                    severity="warning",
                    code="stale_verified_rate",
                    message=(
                        f"Verified rate is {age_days} days old; refresh within "
                        f"{stale_after_days} days."
                    ),
                )
            )

    return OfferVerificationReport(
        total_offers=len(offers),
        verified_count=verified_count,
        unverified_count=len(offers) - verified_count,
        missing_source_count=missing_source_count,
        stale_verified_count=stale_verified_count,
        target_min_offers=target_min_offers,
        ready_for_public_demo=not any(
            issue.severity == "error" for issue in issues
        ) and verified_count >= target_min_offers,
        issues=issues,
    )
