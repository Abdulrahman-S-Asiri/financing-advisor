"""Financial profile extraction from Open Banking (AIS) transactions.

Deterministic heuristics, documented so judges can interrogate them:

  Salary   : recurring monthly CREDIT, amount stable within +/-10%, seen in
             >= 3 distinct months, boosted by keywords (SALARY, راتب, PAYROLL,
             MUDAD). Largest qualifying stream wins.
  Salary-linked obligations : recurring monthly DEBITs whose description
             matches finance-installment keywords (قسط, INSTALLMENT, EMKAN,
             NAYIFAT, FINANCE, TAMWEEL, AJIL) at the salary bank.
  Other obligations : same keyword class at other banks / BNPL keywords
             (TABBY, TAMARA).
  Real-estate obligations : mortgage keywords (REDF, عقاري, MORTGAGE, SAKANI).

Where the LLM fits (and does NOT): ambiguous transaction descriptions can be
sent to an LLM *categorizer* (agents layer) that maps description -> category.
The LLM never invents amounts, never computes ratios, never decides
eligibility. Numbers stay here.

TEAM TODO: field names below assume the mock AIS schema in
mock_open_banking/. When aligning to the published SAMA AIS spec, update
`Txn.from_ais` only — the rest of the pipeline reads the dataclass.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from statistics import mean, pstdev

from core.models import EmploymentType, FinancialProfile

SALARY_KEYWORDS = ("SALARY", "راتب", "PAYROLL", "MUDAD")
FINANCE_KEYWORDS = (
    "قسط", "INSTALLMENT", "FINANCE", "TAMWEEL", "EMKAN", "NAYIFAT", "AJIL",
)
BNPL_KEYWORDS = ("TABBY", "TAMARA")
MORTGAGE_KEYWORDS = ("REDF", "MORTGAGE", "عقاري", "SAKANI")
GOV_EMPLOYER_HINTS = ("MINISTRY", "وزارة", "GOV", "MUDAD-GOV")


@dataclass
class Txn:
    booking_month: str      # "YYYY-MM"
    amount: float           # positive number
    credit: bool            # True = money in
    description: str
    bank: str

    @classmethod
    def from_ais(cls, raw: dict, bank: str) -> "Txn":
        # Mock AIS shape; adjust here when adopting the official SAMA spec.
        return cls(
            booking_month=raw["bookingDateTime"][:7],
            amount=float(raw["amount"]["amount"]),
            credit=raw["creditDebitIndicator"] == "Credit",
            description=raw.get("transactionInformation", "").upper(),
            bank=bank,
        )


def _has(desc: str, keywords: tuple[str, ...]) -> bool:
    return any(k in desc for k in keywords)


def _recurring_monthly(txns: list[Txn]) -> dict[str, list[Txn]]:
    """Group by (rounded amount bucket, description head) and keep groups
    seen in >= 3 distinct months with amount stability within +/-10%."""
    groups: dict[tuple, list[Txn]] = defaultdict(list)
    for t in txns:
        bucket = round(t.amount / 100) * 100
        head = t.description[:12]
        groups[(bucket, head)].append(t)

    stable: dict[str, list[Txn]] = {}
    for key, items in groups.items():
        months = {t.booking_month for t in items}
        if len(months) < 3:
            continue
        avg = mean(t.amount for t in items)
        if avg <= 0:
            continue
        if all(abs(t.amount - avg) / avg <= 0.10 for t in items):
            stable[f"{key[1]}|{key[0]}"] = items
    return stable


def _salary_stability_score(items: list[Txn]) -> float:
    if not items:
        return 0.0
    avg = mean(t.amount for t in items)
    if avg <= 0:
        return 0.0
    variation = pstdev(t.amount for t in items) / avg
    return round(max(0.0, 1 - min(variation / 0.10, 1.0)), 2)


def _confidence_level(months_observed: int, salary_amount: float, stability_score: float) -> str:
    if salary_amount <= 0 or months_observed < 3:
        return "low"
    if months_observed >= 6 and stability_score >= 0.8:
        return "high"
    return "medium"


def _obligation_trend(monthly_obligations: dict[str, float]) -> str:
    if not monthly_obligations:
        return "none"
    months = sorted(monthly_obligations)
    if len(months) < 4:
        return "unknown"
    midpoint = len(months) // 2
    first = mean(monthly_obligations[m] for m in months[:midpoint])
    second = mean(monthly_obligations[m] for m in months[midpoint:])
    if first <= 0:
        return "rising" if second > 0 else "stable"
    change = (second - first) / first
    if change > 0.10:
        return "rising"
    if change < -0.10:
        return "falling"
    return "stable"


def extract_profile(
    persona_id: str,
    txns: list[Txn],
    age: int = 30,
    nationality: str = "saudi",
) -> FinancialProfile:
    months_observed = len({t.booking_month for t in txns})
    notes: list[str] = []

    # ---- salary ------------------------------------------------------
    # Rule: a keyword-tagged stream always beats an untagged one; within the
    # same class, the largest stable monthly average wins. Tuple comparison
    # (keyword_hit, avg) encodes exactly that ordering.
    credit_streams = _recurring_monthly([t for t in txns if t.credit])
    best_rank = (False, 0.0)
    salary_amount, salary_bank, salary_desc = 0.0, "", ""
    salary_items: list[Txn] = []
    for items in credit_streams.values():
        avg = mean(t.amount for t in items)
        rank = (_has(items[0].description, SALARY_KEYWORDS), avg)
        if rank > best_rank:
            best_rank = rank
            salary_amount, salary_bank = avg, items[0].bank
            salary_desc = items[0].description
            salary_items = items
    if salary_amount == 0.0:
        notes.append("No stable salary stream detected; treat profile as unverified.")

    employment = EmploymentType.PRIVATE
    if _has(salary_desc, GOV_EMPLOYER_HINTS):
        employment = EmploymentType.GOVERNMENT
    if "PENSION" in salary_desc or "معاش" in salary_desc:
        employment = EmploymentType.RETIREE

    # ---- other periodic income (counts at 50% per rule 16.b) ----------
    other_income = 0.0
    for key, items in credit_streams.items():
        avg = mean(t.amount for t in items)
        if abs(avg - salary_amount) < 1e-6 and items[0].bank == salary_bank:
            continue
        if _has(items[0].description, ("RENT", "ايجار", "DIVIDEND")):
            other_income += avg
            notes.append(f"Other periodic income detected (~SAR {avg:,.0f}/mo), counted at 50%.")

    # ---- obligations ---------------------------------------------------
    debit_streams = _recurring_monthly([t for t in txns if not t.credit])
    salary_linked = other_obl = re_obl = 0.0
    monthly_obligations: dict[str, float] = defaultdict(float)
    for key, items in debit_streams.items():
        avg = mean(t.amount for t in items)
        desc, bank = items[0].description, items[0].bank
        if _has(desc, MORTGAGE_KEYWORDS):
            re_obl += avg
            for item in items:
                monthly_obligations[item.booking_month] += item.amount
        elif _has(desc, FINANCE_KEYWORDS):
            if bank == salary_bank:
                salary_linked += avg
            else:
                other_obl += avg
            for item in items:
                monthly_obligations[item.booking_month] += item.amount
        elif _has(desc, BNPL_KEYWORDS):
            other_obl += avg
            for item in items:
                monthly_obligations[item.booking_month] += item.amount
            notes.append(f"Recurring BNPL commitment detected (~SAR {avg:,.0f}/mo).")

    stability_score = _salary_stability_score(salary_items)

    return FinancialProfile(
        persona_id=persona_id,
        gross_salary=round(salary_amount, 2),
        other_monthly_income_avg=round(other_income, 2),
        employment_type=employment,
        is_retiree=employment == EmploymentType.RETIREE,
        age=age,
        nationality=nationality,
        salary_linked_obligations=round(salary_linked, 2),
        other_obligations=round(other_obl, 2),
        real_estate_obligations=round(re_obl, 2),
        months_observed=months_observed,
        salary_bank=salary_bank,
        salary_stability_score=stability_score,
        obligation_trend=_obligation_trend(monthly_obligations),
        confidence_level=_confidence_level(months_observed, salary_amount, stability_score),
        detection_notes=notes,
    )
