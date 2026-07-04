from datetime import date

from core.models import Category, Offer, Structure
from core.offer_verification import verify_offers


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
