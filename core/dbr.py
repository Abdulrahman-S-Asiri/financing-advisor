"""Debt Burden Ratio engine.

Encodes SAMA "Responsible Lending Principles for Individual Customers"
(Circular 46538/99, 02/09/1439H, as amended), Quantitative Principles
paras 15-18. English translation reference:
https://rulebook.sama.gov.sa/en/responsible-lending-principles-individual-customers-0

TEAM TODO (enrichment week): re-verify these ratios against the current
consolidated Arabic text in the SAMA Rulebook and confirm with Alinma
mentors how their credit policy applies them in practice. The Arabic
text governs.

The three income tiers (total monthly income):
  <= 15,000        : salary-linked <= 33.33% (25% retiree); non-RE <= 45%;
                     total <= 55% (65% if MoH/REDF mortgage beneficiary)
  15,000 - 25,000  : salary-linked <= 33.33% (25% retiree); non-RE <= 45%;
                     total <= 65%
  >= 25,000        : salary-linked <= 33.33% (25% retiree); rest subject
                     to creditor credit policy (we surface POLICY_REVIEW,
                     we do not invent a cap)

Also para 18: consumer finance term <= 60 months, except real estate and
credit cards. Para 16.b (income haircut) is applied in FinancialProfile.
"""
from __future__ import annotations

import math

from core.models import DbrDecision, FinancialProfile

SALARY_LINKED_CAP_EMPLOYEE = 1 / 3          # 33.33%
SALARY_LINKED_CAP_RETIREE = 0.25
NON_RE_CAP_LOW_TIERS = 0.45
TOTAL_CAP_TIER1 = 0.55
TOTAL_CAP_TIER1_HOUSING_SUPPORT = 0.65
TOTAL_CAP_TIER2 = 0.65
TIER1_MAX_INCOME = 15_000.0
TIER3_MIN_INCOME = 25_000.0
MAX_CONSUMER_TENOR_MONTHS = 60              # except real estate & credit cards


def evaluate(
    profile: FinancialProfile,
    new_installment: float,
    new_is_salary_linked: bool,
    new_is_real_estate: bool = False,
) -> DbrDecision:
    """Evaluate whether adding `new_installment` keeps the consumer within
    the SAMA deductible-ratio caps for their income tier.

    Deterministic by design: agents may *call* this and *explain* its
    output, but never recompute or override it.
    """
    income = profile.total_monthly_income
    if income <= 0:
        return DbrDecision(
            passes=False, tier="unknown",
            salary_linked_ratio=1.0, non_real_estate_ratio=1.0, total_ratio=1.0,
            salary_linked_cap=0, non_real_estate_cap=0, total_cap=0,
            breaches=["No verifiable income detected in the observed period."],
        )

    salary_cap = (
        SALARY_LINKED_CAP_RETIREE if profile.is_retiree else SALARY_LINKED_CAP_EMPLOYEE
    )

    sl = profile.salary_linked_obligations + (new_installment if new_is_salary_linked else 0.0)
    re_obl = profile.real_estate_obligations + (new_installment if new_is_real_estate else 0.0)
    other = profile.other_obligations + (
        new_installment if not (new_is_salary_linked or new_is_real_estate) else 0.0
    )

    total_obl = sl + other + re_obl
    non_re_obl = sl + other

    # Salary-linked ratio is against GROSS SALARY, not total income (para 15/16/17.a)
    salary_linked_ratio = sl / profile.gross_salary if profile.gross_salary > 0 else 1.0
    non_re_ratio = non_re_obl / income
    total_ratio = total_obl / income

    breaches: list[str] = []
    policy_review = False

    if income <= TIER1_MAX_INCOME:
        tier = "<=15k"
        non_re_cap: float | None = NON_RE_CAP_LOW_TIERS
        total_cap: float | None = (
            TOTAL_CAP_TIER1_HOUSING_SUPPORT
            if profile.mohousing_or_redf_beneficiary
            else TOTAL_CAP_TIER1
        )
    elif income < TIER3_MIN_INCOME:
        tier = "15k-25k"
        non_re_cap = NON_RE_CAP_LOW_TIERS
        total_cap = TOTAL_CAP_TIER2
    else:
        tier = ">=25k"
        non_re_cap = None   # creditor credit policy
        total_cap = None
        policy_review = True

    if salary_linked_ratio > salary_cap + 1e-9:
        breaches.append(
            f"Salary-deduction obligations would be {salary_linked_ratio:.1%} of gross "
            f"salary; cap is {salary_cap:.2%} "
            f"({'retiree' if profile.is_retiree else 'employee'})."
        )
    if non_re_cap is not None and non_re_ratio > non_re_cap + 1e-9:
        breaches.append(
            f"Non-real-estate obligations would be {non_re_ratio:.1%} of total monthly "
            f"income; cap is {non_re_cap:.0%} for the {tier} tier."
        )
    if total_cap is not None and total_ratio > total_cap + 1e-9:
        breaches.append(
            f"Total credit obligations would be {total_ratio:.1%} of total monthly "
            f"income; cap is {total_cap:.0%} for the {tier} tier."
        )

    return DbrDecision(
        passes=not breaches,
        tier=tier,
        salary_linked_ratio=round(salary_linked_ratio, 4),
        non_real_estate_ratio=round(non_re_ratio, 4),
        total_ratio=round(total_ratio, 4),
        salary_linked_cap=salary_cap,
        non_real_estate_cap=non_re_cap,
        total_cap=total_cap,
        breaches=breaches,
        policy_review=policy_review,
    )


def max_affordable_installment(
    profile: FinancialProfile, salary_linked: bool = True
) -> float:
    """Largest new monthly installment that still passes every applicable cap.
    Powers the advisor line: 'you can afford up to SAR X/month'.
    """
    income = profile.total_monthly_income
    if income <= 0 or profile.gross_salary <= 0:
        return 0.0

    salary_cap = (
        SALARY_LINKED_CAP_RETIREE if profile.is_retiree else SALARY_LINKED_CAP_EMPLOYEE
    )
    candidates: list[float] = []

    if salary_linked:
        candidates.append(salary_cap * profile.gross_salary - profile.salary_linked_obligations)

    if income < TIER3_MIN_INCOME:
        non_re_now = profile.salary_linked_obligations + profile.other_obligations
        candidates.append(NON_RE_CAP_LOW_TIERS * income - non_re_now)

        total_now = non_re_now + profile.real_estate_obligations
        if income <= TIER1_MAX_INCOME:
            cap = (
                TOTAL_CAP_TIER1_HOUSING_SUPPORT
                if profile.mohousing_or_redf_beneficiary
                else TOTAL_CAP_TIER1
            )
        else:
            cap = TOTAL_CAP_TIER2
        candidates.append(cap * income - total_now)

    headroom = min(candidates) if candidates else 0.0
    # Floor, don't round: rounding up by a fraction of a halala would breach
    # the very cap this number was derived from.
    return max(0.0, math.floor(headroom * 100) / 100)
