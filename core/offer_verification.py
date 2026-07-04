"""Offer catalog verification checks.

This module does not fetch live bank pages. It validates the local catalog so
placeholder rates cannot look production-ready by accident.
"""
from __future__ import annotations

import csv
from io import StringIO
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


@dataclass(frozen=True)
class OfferReviewItem:
    offer_id: str
    institution: str
    product_name: str
    category: str
    structure: str
    rate_verified: bool
    source_url: str
    retrieved_at: str
    review_status: str
    required_actions: list[str]
    issue_codes: list[str]

    def to_dict(self) -> dict:
        return {
            "offer_id": self.offer_id,
            "institution": self.institution,
            "product_name": self.product_name,
            "category": self.category,
            "structure": self.structure,
            "rate_verified": self.rate_verified,
            "source_url": self.source_url,
            "retrieved_at": self.retrieved_at,
            "review_status": self.review_status,
            "required_actions": self.required_actions,
            "issue_codes": self.issue_codes,
        }


@dataclass(frozen=True)
class OfferReviewChecklist:
    total_offers: int
    ready_count: int
    needs_review_count: int
    catalog_actions: list[str]
    offers: list[OfferReviewItem]

    def to_dict(self) -> dict:
        return {
            "total_offers": self.total_offers,
            "ready_count": self.ready_count,
            "needs_review_count": self.needs_review_count,
            "catalog_actions": self.catalog_actions,
            "offers": [offer.to_dict() for offer in self.offers],
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


def _actions_for_offer(
    offer: Offer,
    issues: list[OfferVerificationIssue],
) -> list[str]:
    actions: list[str] = []
    codes = {issue.code for issue in issues}
    if "missing_source_url" in codes:
        actions.append("Add the official product source_url.")
    if "placeholder_rate" in codes:
        actions.extend([
            "Verify the published flat/profit rate from the source page.",
            "Verify salary floor, amount, tenor, admin fee, and eligibility fields.",
            "Fill retrieved_at with the review date before setting rate_verified true.",
        ])
    if "missing_retrieved_at" in codes:
        actions.append("Fill retrieved_at for the verified source review.")
    if "stale_verified_rate" in codes:
        actions.append("Refresh the source review and update retrieved_at.")
    if "duplicate_offer_id" in codes:
        actions.append("Assign a unique offer id.")
    if not actions and offer.rate_verified:
        actions.append("No blocking action; keep source evidence current.")
    return actions


def build_review_checklist(
    offers: list[Offer],
    *,
    today: date | None = None,
    target_min_offers: int = TARGET_MIN_OFFERS,
    stale_after_days: int = STALE_AFTER_DAYS,
) -> OfferReviewChecklist:
    report = verify_offers(
        offers,
        today=today,
        target_min_offers=target_min_offers,
        stale_after_days=stale_after_days,
    )
    issues_by_offer: dict[str, list[OfferVerificationIssue]] = {
        offer.id: [] for offer in offers
    }
    catalog_actions: list[str] = []
    for issue in report.issues:
        if issue.offer_id is None:
            if issue.code == "target_offer_count":
                catalog_actions.append(
                    "Add more verified offers until the catalog reaches the target size."
                )
            continue
        issues_by_offer.setdefault(issue.offer_id, []).append(issue)

    items: list[OfferReviewItem] = []
    for offer in offers:
        offer_issues = issues_by_offer.get(offer.id, [])
        issue_codes = [issue.code for issue in offer_issues]
        has_error = any(issue.severity == "error" for issue in offer_issues)
        has_warning = any(issue.severity == "warning" for issue in offer_issues)
        review_status = (
            "blocked"
            if has_error
            else "needs_review"
            if has_warning or not offer.rate_verified
            else "ready"
        )
        items.append(
            OfferReviewItem(
                offer_id=offer.id,
                institution=offer.institution,
                product_name=offer.product_name,
                category=offer.category.value,
                structure=offer.structure.value,
                rate_verified=offer.rate_verified,
                source_url=offer.source_url,
                retrieved_at=offer.retrieved_at,
                review_status=review_status,
                required_actions=_actions_for_offer(offer, offer_issues),
                issue_codes=issue_codes,
            )
        )

    ready_count = sum(1 for item in items if item.review_status == "ready")
    return OfferReviewChecklist(
        total_offers=len(items),
        ready_count=ready_count,
        needs_review_count=len(items) - ready_count,
        catalog_actions=catalog_actions,
        offers=items,
    )


def review_checklist_csv(checklist: OfferReviewChecklist) -> str:
    output = StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "offer_id",
            "institution",
            "product_name",
            "category",
            "structure",
            "rate_verified",
            "source_url",
            "retrieved_at",
            "review_status",
            "issue_codes",
            "required_actions",
        ],
    )
    writer.writeheader()
    for item in checklist.offers:
        writer.writerow({
            "offer_id": item.offer_id,
            "institution": item.institution,
            "product_name": item.product_name,
            "category": item.category,
            "structure": item.structure,
            "rate_verified": item.rate_verified,
            "source_url": item.source_url,
            "retrieved_at": item.retrieved_at,
            "review_status": item.review_status,
            "issue_codes": "; ".join(item.issue_codes),
            "required_actions": " | ".join(item.required_actions),
        })
    return output.getvalue()
