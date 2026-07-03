"""Financing cost engine.

Saudi consumer financing is typically quoted as an annual FLAT profit rate
(profit = principal * flat_rate * years, equal installments). Flat rates
are NOT comparable to reducing-balance rates: 4.9% flat over 60 months is
roughly a 9% effective annual rate. The regulator's answer to this is APR
disclosure; ours is the same. This module converts every offer to:

  - monthly installment
  - total amount payable (installments + upfront admin fee)
  - APR (effective annual, internal rate of return on the actual cash
    flows, admin fee included by reducing net proceeds)

Pure stdlib. IRR is solved by bisection rather than Newton or numpy:
bisection cannot diverge, needs no derivative, and avoids pulling numpy
onto ARM64 Windows machines for a 30-iteration loop.

Agents never compute money. They call these functions.
"""
from __future__ import annotations

from core.models import CostBreakdown, Offer, PaymentScheduleRow


def monthly_installment_flat(principal: float, flat_rate_annual: float, months: int) -> float:
    """Equal monthly installment under flat-rate pricing."""
    if months <= 0:
        raise ValueError("months must be positive")
    total_profit = principal * flat_rate_annual * (months / 12)
    return (principal + total_profit) / months


def admin_fee(principal: float, fee_pct: float, fee_cap_sar: float) -> float:
    """Upfront administrative fee: percentage of amount, subject to a SAR cap.
    TEAM TODO: verify the current SAMA admin-fee cap for consumer finance in
    the Updated Regulations for Consumer Financing before the demo."""
    return min(principal * fee_pct, fee_cap_sar)


def _npv(monthly_rate: float, net_proceeds: float, installment: float, months: int) -> float:
    """NPV of the borrower's cash flows at a candidate monthly rate:
    +net_proceeds now, -installment for `months` months."""
    if monthly_rate == 0:
        return net_proceeds - installment * months
    annuity = (1 - (1 + monthly_rate) ** -months) / monthly_rate
    return net_proceeds - installment * annuity


def apr_effective(
    principal: float, installment: float, months: int, upfront_fee: float = 0.0
) -> float:
    """Effective annual rate (IRR of actual cash flows), fee included.

    The borrower effectively receives principal - fee but repays against
    the full principal, so fees raise the APR. Bisection on the monthly
    rate in [0, 100%] to 1e-9, then annualized: (1 + i)^12 - 1.
    """
    net = principal - upfront_fee
    if net <= 0:
        raise ValueError("fees exceed principal")
    if installment * months <= net:
        return 0.0

    # NPV(rate) is increasing in rate here (higher discount rate shrinks the
    # installment annuity we subtract): NPV(0) < 0 < NPV(1). Keep the root
    # bracketed: NPV(mid) > 0 means mid is ABOVE the root -> shrink hi.
    lo, hi = 0.0, 1.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if _npv(mid, net, installment, months) > 0:
            hi = mid
        else:
            lo = mid
        if hi - lo < 1e-9:
            break
    monthly = (lo + hi) / 2
    return (1 + monthly) ** 12 - 1


def price_offer(offer: Offer, principal: float, months: int) -> CostBreakdown:
    """Full cost breakdown of one offer for a requested amount and tenor."""
    installment = monthly_installment_flat(principal, offer.flat_rate_annual, months)
    fee = admin_fee(principal, offer.admin_fee_pct, offer.admin_fee_cap_sar)
    total_profit = installment * months - principal
    return CostBreakdown(
        principal=principal,
        tenor_months=months,
        flat_rate_annual=offer.flat_rate_annual,
        monthly_installment=round(installment, 2),
        total_profit=round(total_profit, 2),
        admin_fee=round(fee, 2),
        total_amount_payable=round(installment * months + fee, 2),
        apr_effective=round(apr_effective(principal, installment, months, fee), 4),
    )


def payment_schedule_flat(
    principal: float,
    flat_rate_annual: float,
    months: int,
) -> list[PaymentScheduleRow]:
    """Month-by-month schedule under flat-rate pricing.

    Flat pricing allocates equal profit over the tenor. The last row absorbs
    rounding differences so principal and profit totals reconcile exactly.
    """
    if months <= 0:
        raise ValueError("months must be positive")

    total_profit = principal * flat_rate_annual * (months / 12)
    principal_per_month = principal / months
    profit_per_month = total_profit / months
    rows: list[PaymentScheduleRow] = []
    principal_allocated = 0.0
    profit_allocated = 0.0

    for month in range(1, months + 1):
        if month == months:
            principal_component = round(principal - principal_allocated, 2)
            profit_component = round(total_profit - profit_allocated, 2)
            remaining = 0.0
        else:
            principal_component = round(principal_per_month, 2)
            profit_component = round(profit_per_month, 2)
            principal_allocated = round(principal_allocated + principal_component, 2)
            profit_allocated = round(profit_allocated + profit_component, 2)
            remaining = round(max(principal - principal_allocated, 0.0), 2)

        rows.append(
            PaymentScheduleRow(
                month=month,
                installment=round(principal_component + profit_component, 2),
                principal_component=principal_component,
                profit_component=profit_component,
                remaining_principal=remaining,
            )
        )

    return rows


def payment_schedule(
    offer: Offer,
    principal: float,
    months: int,
) -> list[PaymentScheduleRow]:
    return payment_schedule_flat(principal, offer.flat_rate_annual, months)
