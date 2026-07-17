"""Tests for the deterministic core. If these are green, the agents can
be trusted to *narrate* the numbers; if they are red, nothing else matters.
Run: pytest tests -q
"""
from core import cost, dbr
from core.eligibility import match_offer, rank_matches
from core.models import (
    Category,
    EmploymentType,
    FinancialProfile,
    MatchStatus,
    Offer,
    Structure,
)


def _profile(**over) -> FinancialProfile:
    base = dict(
        persona_id="t",
        gross_salary=10_000,
        employment_type=EmploymentType.PRIVATE,
        age=30,
        salary_bank="Bank A",
    )
    base.update(over)
    return FinancialProfile(**base)


def _offer(**over) -> Offer:
    base = dict(
        id="o1",
        institution="Bank A",
        product_name="Personal Finance (Tawarruq)",
        category=Category.PERSONAL,
        structure=Structure.TAWARRUQ,
        flat_rate_annual=0.05,
        admin_fee_pct=0.01,
        admin_fee_cap_sar=5_000,
        min_amount=10_000,
        max_amount=500_000,
        min_tenor_months=12,
        max_tenor_months=60,
        min_gross_salary=4_000,
        salary_transfer_required=True,
        eligible_employment=["government", "private", "military"],
        nationality="both",
        max_age_at_maturity=60,
    )
    base.update(over)
    return Offer(**base)


# ---------------- cost engine ----------------

def test_flat_installment_exact():
    # 100k, 5% flat, 60 months: profit 25k, installment (125k/60)
    m = cost.monthly_installment_flat(100_000, 0.05, 60)
    assert abs(m - 125_000 / 60) < 1e-6


def test_apr_exceeds_flat_and_is_sane():
    # Rule of thumb: APR of a 60-month flat-rate loan is ~1.8-1.95x the flat rate.
    m = cost.monthly_installment_flat(100_000, 0.05, 60)
    apr = cost.apr_effective(100_000, m, 60)
    assert 0.085 < apr < 0.105


def test_admin_fee_raises_apr():
    m = cost.monthly_installment_flat(100_000, 0.05, 60)
    assert cost.apr_effective(100_000, m, 60, upfront_fee=1_000) > cost.apr_effective(
        100_000, m, 60
    )


def test_admin_fee_cap():
    assert cost.admin_fee(1_000_000, 0.01, 5_000) == 5_000


def test_payment_schedule_reconciles_totals():
    schedule = cost.payment_schedule_flat(100_000, 0.05, 60)
    assert len(schedule) == 60
    assert schedule[-1].remaining_principal == 0
    assert round(sum(row.principal_component for row in schedule), 2) == 100_000
    assert round(sum(row.profit_component for row in schedule), 2) == 25_000


# ---------------- income haircut (para 16.b) ----------------

def test_other_income_counts_at_half():
    p = _profile(gross_salary=10_000, other_monthly_income_avg=4_000)
    assert p.total_monthly_income == 12_000


# ---------------- DBR tiers ----------------

def test_tier1_salary_linked_cap_breach():
    p = _profile(gross_salary=6_000, salary_linked_obligations=2_600)  # already 43%
    d = dbr.evaluate(p, new_installment=200, new_is_salary_linked=True)
    assert not d.passes and d.tier == "<=15k"
    assert any("gross" in b.lower() for b in d.breaches)


def test_tier1_total_cap_55_and_housing_65():
    p = _profile(gross_salary=10_000, other_obligations=3_000,
                 real_estate_obligations=2_200)
    # +400 non-salary-linked -> total 5,600/10,000 = 56% > 55%
    d = dbr.evaluate(p, new_installment=400, new_is_salary_linked=False)
    assert not d.passes
    p2 = _profile(gross_salary=10_000, other_obligations=3_000,
                  real_estate_obligations=2_200, mohousing_or_redf_beneficiary=True)
    d2 = dbr.evaluate(p2, new_installment=400, new_is_salary_linked=False)
    assert d2.passes  # 56% <= 65% housing-support cap


def test_tier2_total_cap_is_65():
    p = _profile(gross_salary=20_000, other_obligations=8_000,
                 real_estate_obligations=4_500)
    # non-RE after +500: 8,500/20,000 = 42.5% (<45%); total 13,000/20,000 = 65%
    d = dbr.evaluate(p, new_installment=500, new_is_salary_linked=False)
    assert d.tier == "15k-25k" and d.passes
    d2 = dbr.evaluate(p, new_installment=600, new_is_salary_linked=False)
    assert not d2.passes  # 65.5% > 65%


def test_tier3_policy_review_not_invented_cap():
    p = _profile(gross_salary=30_000, other_obligations=15_000)  # 50% of income
    d = dbr.evaluate(p, new_installment=1_000, new_is_salary_linked=False)
    assert d.tier == ">=25k" and d.passes and d.policy_review
    assert d.total_cap is None


def test_retiree_cap_25():
    p = _profile(gross_salary=10_000, is_retiree=True,
                 employment_type=EmploymentType.RETIREE)
    d = dbr.evaluate(p, new_installment=2_600, new_is_salary_linked=True)  # 26%
    assert not d.passes


def test_max_affordable_installment_respects_all_caps():
    p = _profile(gross_salary=9_500, salary_linked_obligations=1_400,
                 other_obligations=300)
    cap = dbr.max_affordable_installment(p, salary_linked=True)
    d = dbr.evaluate(p, new_installment=cap, new_is_salary_linked=True)
    assert d.passes
    d2 = dbr.evaluate(p, new_installment=cap + 5, new_is_salary_linked=True)
    assert not d2.passes


# ---------------- eligibility ----------------

def test_tenor_cap_60_months_consumer():
    r = match_offer(_offer(max_tenor_months=84), _profile(), 50_000, 72)
    assert r.status == MatchStatus.INELIGIBLE
    assert any("60 months" in x for x in r.reasons)
    assert any(s.kind == "shorter_tenor" and s.requested_tenor_months == 60
               for s in r.near_miss_suggestions)


def test_salary_floor_reason_is_user_readable():
    r = match_offer(_offer(min_gross_salary=12_000), _profile(gross_salary=9_500),
                    50_000, 36)
    assert r.status == MatchStatus.INELIGIBLE and "below" in r.reasons[0]


def test_near_miss_skips_amount_and_tenor_searches_for_salary_floor(monkeypatch):
    def fail_search(*_args, **_kwargs):
        raise AssertionError("Amount/tenor search should not run for salary floor.")

    monkeypatch.setattr("core.eligibility._suggest_lower_amount", fail_search)
    monkeypatch.setattr("core.eligibility._suggest_shorter_tenor", fail_search)

    r = match_offer(
        _offer(min_gross_salary=12_000),
        _profile(gross_salary=9_500),
        50_000,
        36,
    )

    assert r.status == MatchStatus.INELIGIBLE
    assert not r.near_miss_suggestions


def test_conditional_when_salary_elsewhere():
    r = match_offer(_offer(institution="Bank B"), _profile(salary_bank="Bank A"),
                    50_000, 36)
    assert r.status == MatchStatus.CONDITIONAL
    assert any("salary" in c.lower() for c in r.conditions)
    assert any(s.kind == "salary_transfer" for s in r.near_miss_suggestions)


def test_ranking_cheapest_eligible_first():
    p = _profile(gross_salary=15_000, salary_bank="Bank A")
    cheap = match_offer(_offer(id="cheap", flat_rate_annual=0.03), p, 50_000, 36)
    pricey = match_offer(_offer(id="pricey", flat_rate_annual=0.07), p, 50_000, 36)
    bad = match_offer(_offer(id="bad", min_gross_salary=50_000), p, 50_000, 36)
    ranked = rank_matches([bad, pricey, cheap])
    assert [r.offer.id for r in ranked] == ["cheap", "pricey", "bad"]


def test_near_miss_lower_amount_for_dbr_breach():
    p = _profile(gross_salary=9_500, salary_linked_obligations=1_400,
                 salary_bank="Bank A")
    r = match_offer(_offer(), p, 80_000, 48)
    assert r.status == MatchStatus.INELIGIBLE
    lower_amount = next(
        suggestion for suggestion in r.near_miss_suggestions
        if suggestion.kind == "lower_amount"
    )
    assert lower_amount.requested_amount < 80_000
    rerun = match_offer(_offer(), p, lower_amount.requested_amount, 48)
    assert rerun.status != MatchStatus.INELIGIBLE
