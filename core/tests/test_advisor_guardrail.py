from agents import advisor
from core.models import (
    Category,
    CostBreakdown,
    EmploymentType,
    FinancialProfile,
    MatchResult,
    MatchStatus,
    Offer,
    Structure,
)


def _profile() -> FinancialProfile:
    return FinancialProfile(
        persona_id="test",
        gross_salary=10_000,
        employment_type=EmploymentType.PRIVATE,
        age=30,
        salary_bank="Bank A",
    )


def _match() -> MatchResult:
    offer = Offer(
        id="o1",
        institution="Bank A",
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
        rate_verified=False,
    )
    cost = CostBreakdown(
        principal=50_000,
        tenor_months=36,
        flat_rate_annual=0.05,
        monthly_installment=1_597.22,
        total_profit=7_500,
        admin_fee=500,
        total_amount_payable=58_000,
        apr_effective=0.102,
    )
    return MatchResult(offer=offer, status=MatchStatus.ELIGIBLE, cost=cost)


def test_advisor_retries_when_reply_contains_unsupported_number(monkeypatch):
    replies = iter([
        "القسط هو 1,597.22 والرقم 999 غير مدعوم.",
        "القسط هو 1,597.22 حسب نتائج المحرك.",
    ])
    monkeypatch.setattr(
        advisor.llm_client,
        "complete",
        lambda _system, _user: next(replies),
    )

    reply = advisor.chat(_profile(), [_match()], 2_000, "ما هو القسط؟")

    assert reply == "القسط هو 1,597.22 حسب نتائج المحرك."


def test_advisor_returns_fallback_when_retry_still_contains_unsupported_number(
    monkeypatch,
):
    replies = iter([
        "القسط هو 1,597.22 والرقم 999 غير مدعوم.",
        "الرقم 888 غير مدعوم أيضاً.",
    ])
    monkeypatch.setattr(
        advisor.llm_client,
        "complete",
        lambda _system, _user: next(replies),
    )

    reply = advisor.chat(_profile(), [_match()], 2_000, "ما هو القسط؟")

    assert "أرقام غير موجودة" in reply
