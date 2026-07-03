from core.profile import Txn, extract_profile


def _txn(month: str, amount: float, credit: bool, description: str) -> Txn:
    return Txn(
        booking_month=month,
        amount=amount,
        credit=credit,
        description=description.upper(),
        bank="Bank A",
    )


def test_categorizer_marks_ambiguous_credit_as_other_income():
    txns = []
    for month in ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]:
        txns.append(_txn(month, 10_000, True, "SALARY PAYROLL"))
        txns.append(_txn(month, 2_000, True, "UNIT 4B"))

    profile = extract_profile(
        "p1",
        txns,
        categorizer=lambda description, credit: (
            "other_income" if credit and description == "UNIT 4B" else None
        ),
    )

    assert profile.other_monthly_income_avg == 2_000
    assert profile.total_monthly_income == 11_000


def test_categorizer_marks_ambiguous_debit_as_obligation():
    txns = []
    for month in ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]:
        txns.append(_txn(month, 10_000, True, "SALARY PAYROLL"))
        txns.append(_txn(month, 750, False, "MYSTERY PLAN"))

    profile = extract_profile(
        "p1",
        txns,
        categorizer=lambda description, credit: (
            "other_obligation" if not credit and description == "MYSTERY PLAN" else None
        ),
    )

    assert profile.other_obligations == 750
    assert profile.obligation_trend == "stable"
