"""MCP stdio server for the financing-advisor project.

Run from the project root:

    python -m mcp_server.server

This is the only module that imports the `mcp` SDK. Tool logic lives in
project_tools.py and engine_tools.py so the test suite runs without the SDK.
All tools are read-only and deterministic; the only subprocesses are the
fixed-argv allowlist in project_tools.ALLOWED_CHECKS.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Script-mode safety: `python mcp_server/server.py` from anywhere still finds
# the project packages (core/, agents/, mock_open_banking/, mcp_server/).
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from mcp.server.fastmcp import FastMCP  # noqa: E402

from mcp_server import engine_tools, project_tools  # noqa: E402

mcp = FastMCP("financing-advisor")


@mcp.tool()
def project_overview() -> dict:
    """Concise overview of the financing-advisor project: purpose, the
    LLM-narrates/code-calculates rule, layer map, key commands, and live
    counts (offers, personas, routes, tests)."""
    return project_tools.project_overview()


@mcp.tool()
def list_project_workflows() -> dict:
    """Detected entry points: service run commands, every API route on the
    platform and mock Open Banking services, frontend npm scripts, CI jobs,
    and the demo-spine request."""
    return project_tools.list_project_workflows()


@mcp.tool()
def search_project_docs(query: str, max_results: int = 8) -> dict:
    """Search README, PLAN, PROJECT_PROGRESS, CLAUDE.md, and docs/*.md for a
    phrase (case-insensitive substring, 2-200 chars). Returns file, line, and
    snippet per match."""
    return project_tools.search_project_docs(query, max_results)


@mcp.tool()
def inspect_config() -> dict:
    """Report which environment variables from .env.example are configured in
    .env and the process environment. Returns key names and set/unset booleans
    only — never values."""
    return project_tools.inspect_config()


@mcp.tool()
def project_health_check(check: str) -> dict:
    """Run one allowlisted project check and return returncode plus output
    tail. Allowed checks: python-version, backend-tests, mcp-tests,
    frontend-lint, frontend-build. Arbitrary commands are not possible."""
    return project_tools.project_health_check(check)


@mcp.tool()
def list_personas() -> dict:
    """List the seeded Open Banking demo personas with salary, obligations,
    and each persona's demo role (approved / borderline / rejected)."""
    return engine_tools.list_personas()


@mcp.tool()
def run_journey(
    persona_id: str,
    requested_amount: float,
    requested_tenor_months: int,
    age: int | None = None,
    nationality: str = "saudi",
    max_offers: int = 10,
) -> dict:
    """Run the full deterministic journey pipeline (profile extraction -> SAMA
    DBR -> offer matching -> pricing) for a seeded persona, in-process, without
    starting any server. Returns the profile, financial health, ranked matches
    with eligibility reasons, and status counts. Amount SAR 1,000-5,000,000;
    tenor 1-360 months."""
    return engine_tools.run_journey(
        persona_id, requested_amount, requested_tenor_months, age, nationality, max_offers
    )


@mcp.tool()
def price_financing(
    amount: float,
    tenor_months: int,
    flat_rate_annual: float | None = None,
    admin_fee_pct: float = 0.0,
    admin_fee_cap_sar: float = 0.0,
    offer_id: str | None = None,
    include_schedule_summary: bool = False,
) -> dict:
    """Deterministic cost breakdown for a financing scenario: monthly
    installment, total profit, admin fee, total payable, and effective APR
    (IRR-based, fee included). Pass offer_id to price a catalog offer, or
    flat_rate_annual (e.g. 0.049 for 4.9% flat) for an ad-hoc scenario."""
    return engine_tools.price_financing(
        amount, tenor_months, flat_rate_annual, admin_fee_pct,
        admin_fee_cap_sar, offer_id, include_schedule_summary,
    )


@mcp.tool()
def evaluate_dbr(
    gross_salary: float,
    new_installment: float,
    other_monthly_income_avg: float = 0.0,
    salary_linked_obligations: float = 0.0,
    other_obligations: float = 0.0,
    real_estate_obligations: float = 0.0,
    is_retiree: bool = False,
    mohousing_or_redf_beneficiary: bool = False,
    new_is_salary_linked: bool = True,
    new_is_real_estate: bool = False,
) -> dict:
    """Evaluate a hypothetical borrower against the SAMA Responsible Lending
    DBR caps using the project's core.dbr engine. Returns the tier, ratios vs
    caps, breach explanations, and the maximum affordable new installment."""
    return engine_tools.evaluate_dbr(
        gross_salary, new_installment, other_monthly_income_avg,
        salary_linked_obligations, other_obligations, real_estate_obligations,
        is_retiree, mohousing_or_redf_beneficiary,
        new_is_salary_linked, new_is_real_estate,
    )


@mcp.tool()
def offer_verification_status() -> dict:
    """Rate-verification report for db/seed_offers.json: verified vs
    placeholder counts, missing sources, stale verifications (>30 days),
    readiness for public demo, and per-offer issues."""
    return engine_tools.offer_verification_status()


if __name__ == "__main__":
    mcp.run()
