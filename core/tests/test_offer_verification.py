from datetime import date

from core.models import Category, Offer, Structure
from core.offer_verification import (
    build_review_checklist,
    review_checklist_csv,
    verify_offers,
)


def _offer(
    offer_id: str,
    *,
    rate_verified: bool = False,
    source_url: str = "https://example.com/product",
    retrieved_at: str = "",
) -> Offer:
    return Offer(
        id=offer_id,
        institution="Test Bank",
        product_name="Personal Finance",
        category=Category.PERSONAL,
        structure=Structure.TAWARRUQ,
        flat_rate_annual=0.05,
        admin_fee_pct=0.01,
        admin_fee_cap_sar=5_000,
        min_amount=10_000,
        max_amount=200_000,
        min_tenor_months=12,
        max_tenor_months=60,
        min_gross_salary=4_000,
        salary_transfer_required=True,
        eligible_employment=["private"],
        nationality="both",
        max_age_at_maturity=60,
        rate_verified=rate_verified,
        source_url=source_url,
        retrieved_at=retrieved_at,
    )


def test_offer_verification_flags_placeholder_catalog():
    report = verify_offers([_offer("o1")], target_min_offers=2)

    assert report.total_offers == 1
    assert report.verified_count == 0
    assert report.unverified_count == 1
    assert report.ready_for_public_demo is False
    assert {issue.code for issue in report.issues} == {
        "target_offer_count",
        "placeholder_rate",
    }


def test_offer_verification_requires_fresh_retrieved_at_for_verified_rates():
    report = verify_offers(
        [
            _offer("fresh", rate_verified=True, retrieved_at="2026-07-01"),
            _offer("stale", rate_verified=True, retrieved_at="2026-05-01"),
            _offer("missing", rate_verified=True),
        ],
        today=date(2026, 7, 4),
        target_min_offers=1,
    )

    assert report.verified_count == 3
    assert report.stale_verified_count == 1
    assert report.ready_for_public_demo is False
    assert {issue.code for issue in report.issues} == {
        "stale_verified_rate",
        "missing_retrieved_at",
    }


def test_offer_review_checklist_exports_required_actions():
    checklist = build_review_checklist(
        [
            _offer("placeholder"),
            _offer("ready", rate_verified=True, retrieved_at="2026-07-01"),
        ],
        today=date(2026, 7, 4),
        target_min_offers=1,
    )

    placeholder = next(item for item in checklist.offers if item.offer_id == "placeholder")
    ready = next(item for item in checklist.offers if item.offer_id == "ready")

    assert checklist.total_offers == 2
    assert checklist.ready_count == 1
    assert checklist.needs_review_count == 1
    assert placeholder.review_status == "needs_review"
    assert placeholder.issue_codes == ["placeholder_rate"]
    assert "Fill retrieved_at" in " ".join(placeholder.required_actions)
    assert ready.review_status == "ready"

    csv_body = review_checklist_csv(checklist)
    assert "offer_id,institution,product_name" in csv_body
    assert "placeholder" in csv_body
    assert "ready" in csv_body
