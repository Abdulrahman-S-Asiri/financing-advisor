"""Shared domain models for the deterministic core.

Design rule: this package (core/) is pure stdlib. No pydantic, no numpy.
Why: the money math must be unit-testable in isolation, runnable by any
teammate with bare Python, and importable by both the API service and the
agents without dependency coupling. Pydantic models live at the API edge.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Structure(str, Enum):
    TAWARRUQ = "tawarruq"
    MURABAHA = "murabaha"
    IJARAH = "ijarah"


class Category(str, Enum):
    PERSONAL = "personal"
    AUTO = "auto"
    REAL_ESTATE = "real_estate"


class EmploymentType(str, Enum):
    GOVERNMENT = "government"
    PRIVATE = "private"
    MILITARY = "military"
    RETIREE = "retiree"
    SELF_EMPLOYED = "self_employed"


class MatchStatus(str, Enum):
    ELIGIBLE = "eligible"
    CONDITIONAL = "conditional"      # eligible if a condition is met (e.g. salary transfer)
    INELIGIBLE = "ineligible"
    POLICY_REVIEW = "policy_review"  # >= SAR 25k tier: non-salary-linked caps are creditor policy


@dataclass
class Offer:
    """One financing product. Populated from db/seed_offers.json.

    rate_verified=False means the numbers are PLACEHOLDERS awaiting the
    real published rate from the institution's site. The API refuses to
    hide this: unverified offers carry a visible flag all the way to the UI.
    """
    id: str
    institution: str
    product_name: str
    category: Category
    structure: Structure
    flat_rate_annual: float          # e.g. 0.049 = 4.9% flat per year
    admin_fee_pct: float             # of finance amount
    admin_fee_cap_sar: float         # SAMA caps admin fees; verify current cap
    min_amount: float
    max_amount: float
    min_tenor_months: int
    max_tenor_months: int
    min_gross_salary: float
    salary_transfer_required: bool
    eligible_employment: list[str]   # EmploymentType values
    nationality: str                 # "saudi" | "expat" | "both"
    max_age_at_maturity: int
    rate_verified: bool = False
    source_url: str = ""
    notes: str = ""


@dataclass
class FinancialProfile:
    """Output of core.profile extraction over Open Banking transactions."""
    persona_id: str
    gross_salary: float                       # detected monthly salary credit
    other_monthly_income_avg: float = 0.0     # BEFORE the 50% haircut (rule 16.b)
    employment_type: EmploymentType = EmploymentType.PRIVATE
    is_retiree: bool = False
    age: int = 30
    nationality: str = "saudi"
    salary_linked_obligations: float = 0.0    # monthly installments deducted from salary
    other_obligations: float = 0.0            # monthly non-salary-linked credit obligations
    real_estate_obligations: float = 0.0      # monthly mortgage installments
    mohousing_or_redf_beneficiary: bool = False
    months_observed: int = 0
    salary_bank: str = ""
    detection_notes: list[str] = field(default_factory=list)

    @property
    def total_monthly_income(self) -> float:
        """SAMA Responsible Lending Principles, para 16.b: other periodic
        income counts at HALF of its verified monthly average."""
        return self.gross_salary + 0.5 * self.other_monthly_income_avg


@dataclass
class CostBreakdown:
    principal: float
    tenor_months: int
    flat_rate_annual: float
    monthly_installment: float
    total_profit: float
    admin_fee: float
    total_amount_payable: float   # installments + upfront fee
    apr_effective: float          # effective annual rate incl. admin fee


@dataclass
class PaymentScheduleRow:
    month: int
    installment: float
    principal_component: float
    profit_component: float
    remaining_principal: float


@dataclass
class DbrDecision:
    passes: bool
    tier: str
    salary_linked_ratio: float
    non_real_estate_ratio: float
    total_ratio: float
    salary_linked_cap: float
    non_real_estate_cap: float | None   # None => creditor policy (>=25k tier)
    total_cap: float | None
    breaches: list[str] = field(default_factory=list)
    policy_review: bool = False


@dataclass
class NearMissSuggestion:
    kind: str
    message: str
    requested_amount: float | None = None
    requested_tenor_months: int | None = None
    monthly_installment: float | None = None
    status: MatchStatus | None = None


@dataclass
class MatchResult:
    offer: Offer
    status: MatchStatus
    reasons: list[str] = field(default_factory=list)      # why ineligible / flagged
    conditions: list[str] = field(default_factory=list)   # what would make it eligible
    cost: CostBreakdown | None = None
    dbr: DbrDecision | None = None
    near_miss_suggestions: list[NearMissSuggestion] = field(default_factory=list)
