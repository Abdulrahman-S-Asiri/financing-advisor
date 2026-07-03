"""Synthetic Open Banking personas.

Three personas cover the three demo beats:
  sara_strong      approved with headroom (gov salary 18k, clean file, 15-25k tier)
  ahmed_borderline approved for some offers, blocked from others (salary 9.5k,
                   existing car installment + BNPL -> tight 33.33% headroom)
  khalid_rejected  rejected everywhere with a clear explanation (salary 6k,
                   obligations already 43% of gross salary)

Everything is SEEDED. A live demo must never surprise you: the same persona
produces byte-identical transactions on every run, on every machine.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

MONTHS = [f"2025-{m:02d}" for m in range(7, 13)] + [f"2026-{m:02d}" for m in range(1, 7)]


@dataclass
class PersonaSpec:
    persona_id: str
    bank: str
    salary: float
    salary_desc: str
    age: int
    obligations: list[tuple[str, float]] = field(default_factory=list)  # (desc, amount)
    rent_out: float = 0.0          # rental income (other periodic income)
    seed: int = 0


PERSONAS: dict[str, PersonaSpec] = {
    "sara_strong": PersonaSpec(
        persona_id="sara_strong",
        bank="Alinma Bank",
        salary=18_000,
        salary_desc="MUDAD-GOV SALARY MINISTRY OF EDUCATION",
        age=31,
        obligations=[],
        seed=11,
    ),
    "ahmed_borderline": PersonaSpec(
        persona_id="ahmed_borderline",
        bank="Al Rajhi Bank",
        salary=9_500,
        salary_desc="SALARY TRANSFER TECHCO LTD",
        age=28,
        obligations=[
            ("قسط سيارة EMKAN FINANCE INSTALLMENT", 1_400.0),
            ("TABBY SUBSCRIPTION PLAN", 300.0),
        ],
        seed=22,
    ),
    "khalid_rejected": PersonaSpec(
        persona_id="khalid_rejected",
        bank="Riyad Bank",
        salary=6_000,
        salary_desc="SALARY PAYROLL ALFA TRADING",
        age=35,
        obligations=[
            ("قسط تمويل شخصي NAYIFAT INSTALLMENT", 1_800.0),
            ("قسط FINANCE INSTALLMENT AJIL", 800.0),
        ],
        seed=33,
    ),
}

_MERCHANTS = [
    ("PANDA RETAIL", 120, 480),
    ("STC PAY TOPUP", 30, 150),
    ("SACO HARDWARE", 60, 400),
    ("ALBAIK RESTAURANT", 25, 90),
    ("PETROMIN FUEL", 80, 220),
    ("JARIR BOOKSTORE", 50, 600),
]


def _txn(month: str, day: int, amount: float, credit: bool, desc: str) -> dict:
    """Mock AIS transaction shape. TEAM TODO: align field names with the
    published SAMA AIS spec during enrichment; core.profile.Txn.from_ais is
    the single adapter to update."""
    return {
        "transactionId": f"{month}-{day:02d}-{abs(hash(desc)) % 99999}",
        "bookingDateTime": f"{month}-{day:02d}T09:00:00+03:00",
        "creditDebitIndicator": "Credit" if credit else "Debit",
        "amount": {"amount": f"{amount:.2f}", "currency": "SAR"},
        "transactionInformation": desc,
        "status": "Booked",
    }


def generate_transactions(persona_id: str) -> list[dict]:
    spec = PERSONAS[persona_id]
    rng = random.Random(spec.seed)
    txns: list[dict] = []
    for month in MONTHS:
        txns.append(_txn(month, 27, spec.salary, True, spec.salary_desc))
        if spec.rent_out:
            txns.append(_txn(month, 5, spec.rent_out, True, "RENT INCOME UNIT 4B"))
        for desc, amount in spec.obligations:
            txns.append(_txn(month, 28, amount, False, desc))
        for _ in range(rng.randint(6, 10)):
            merchant, lo, hi = rng.choice(_MERCHANTS)
            txns.append(
                _txn(month, rng.randint(1, 26), round(rng.uniform(lo, hi), 2), False, merchant)
            )
    return txns


def account_for(persona_id: str) -> dict:
    spec = PERSONAS[persona_id]
    return {
        "accountId": f"acc-{persona_id}",
        "currency": "SAR",
        "accountType": "Personal",
        "accountSubType": "CurrentAccount",
        "nickname": spec.bank,
        "servicer": {"name": spec.bank},
    }


def balance_for(persona_id: str) -> dict:
    spec = PERSONAS[persona_id]
    return {
        "accountId": f"acc-{persona_id}",
        "amount": {"amount": f"{spec.salary * 1.4:.2f}", "currency": "SAR"},
        "type": "InterimAvailable",
    }
