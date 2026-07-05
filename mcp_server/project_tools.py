"""Project meta-tools: overview, workflows, doc search, config, health checks.

Design rules for this module:
  - Read-only against the repository. No writes, no deletes, no network.
  - Subprocesses run ONLY through ALLOWED_CHECKS: fixed argv, shell=False,
    hard timeouts. Tool input never reaches an argv.
  - Secret values never appear in any output: config inspection reports key
    names and set/unset booleans only.
  - Outputs are bounded (result caps, output tails) because they land in a
    model context window.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from mcp_server.validation import require_choice, require_int, require_text

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Documentation files exposed to search. Deliberately an allowlist, not a
# glob over the whole repo: source code has its own search tools.
_DOC_GLOBS = (
    "README.md",
    "PLAN.md",
    "PROJECT_PROGRESS.md",
    "CLAUDE.md",
    "docs/*.md",
    "mcp_server/README.md",
)

_ROUTE_RE = re.compile(r'@app\.(get|post|put|delete|patch)\(\s*"([^"]+)"')
_ENV_KEY_RE = re.compile(r"^([A-Z][A-Z0-9_]*)=(.*)$")

_OUTPUT_TAIL_CHARS = 4000
_MAX_SEARCH_RESULTS = 25
_SNIPPET_CHARS = 240


def _doc_files() -> list[Path]:
    files: list[Path] = []
    for pattern in _DOC_GLOBS:
        if "*" in pattern:
            files.extend(sorted(PROJECT_ROOT.glob(pattern)))
        else:
            candidate = PROJECT_ROOT / pattern
            if candidate.exists():
                files.append(candidate)
    return files


def _routes(path: Path) -> list[str]:
    if not path.exists():
        return []
    matches = _ROUTE_RE.findall(path.read_text(encoding="utf-8"))
    return [f"{method.upper()} {route}" for method, route in matches]


def _frontend_scripts() -> dict[str, str]:
    package_json = PROJECT_ROOT / "frontend" / "package.json"
    if not package_json.exists():
        return {}
    data = json.loads(package_json.read_text(encoding="utf-8"))
    return dict(data.get("scripts", {}))


def _ci_jobs() -> list[str]:
    """Job ids from the CI workflow. Line-based on purpose: avoids requiring
    a YAML dependency for two indentation levels."""
    workflow = PROJECT_ROOT / ".github" / "workflows" / "ci.yml"
    if not workflow.exists():
        return []
    jobs: list[str] = []
    in_jobs = False
    for line in workflow.read_text(encoding="utf-8").splitlines():
        if line.rstrip() == "jobs:":
            in_jobs = True
            continue
        if in_jobs:
            if line and not line.startswith(" "):
                break
            match = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", line)
            if match:
                jobs.append(match.group(1))
    return jobs


def project_overview() -> dict:
    """Concise, current snapshot of what the project is and how it is laid out."""
    offers_path = PROJECT_ROOT / "db" / "seed_offers.json"
    offer_count = 0
    if offers_path.exists():
        offer_count = len(json.loads(offers_path.read_text(encoding="utf-8")).get("offers", []))

    from mock_open_banking.personas import PERSONAS

    return {
        "name": "financing-advisor",
        "purpose": (
            "Agentic financing advisor for the Saudi market: reads (mock) Open "
            "Banking transactions, computes SAMA-compliant affordability, matches "
            "and prices Islamic financing offers with honest APR, and explains "
            "every decision in Arabic."
        ),
        "core_rule": (
            "LLMs orchestrate and explain; code calculates. Every number comes "
            "from the deterministic engine in core/. The advisor agent may not "
            "state numbers absent from its context (enforced guardrail)."
        ),
        "layers": {
            "core/": "Pure-stdlib engine: profile extraction, SAMA DBR tiers, flat-rate->APR cost engine, explainable eligibility.",
            "agents/": "LLM layer (lazy): journey orchestrator, advisor with number-fidelity guardrail, simulated application agent.",
            "api/": "FastAPI platform API on :8000 — journey + SSE, advisor chat/tools, offers verification, simulated OTP, optional Postgres.",
            "mock_open_banking/": "AIS-shaped mock service on :8100 with seeded personas; real-TPP swap is a base-URL change.",
            "frontend/": "Next.js Arabic-RTL journey app on :3000 (Discover/Define/Develop/Deliver).",
            "db/": "seed_offers.json catalog (rate_verified flags) + Postgres schema.",
            "mcp_server/": "This local MCP tooling — read-only, not part of the app runtime.",
        },
        "key_commands": {
            "backend_tests": "python -m pytest core/tests -q",
            "mcp_tests": "python -m pytest mcp_server/tests -q",
            "api": "uvicorn api.main:app --port 8000",
            "mock_open_banking": "uvicorn mock_open_banking.main:app --port 8100",
            "frontend_dev": "cd frontend && npm run dev",
            "frontend_checks": "cd frontend && npm run lint && npm run build",
            "optional_db": "docker compose up -d db",
        },
        "counts": {
            "offers_in_catalog": offer_count,
            "seeded_personas": len(PERSONAS),
            "api_routes": len(_routes(PROJECT_ROOT / "api" / "main.py")),
            "backend_test_files": len(list((PROJECT_ROOT / "core" / "tests").glob("test_*.py"))),
        },
        "docs": [str(p.relative_to(PROJECT_ROOT)) for p in _doc_files()],
    }


def list_project_workflows() -> dict:
    """Detected entry points: API routes, services, scripts, CI jobs."""
    return {
        "services": {
            "platform_api": "uvicorn api.main:app --port 8000",
            "mock_open_banking": "uvicorn mock_open_banking.main:app --port 8100",
            "frontend": "cd frontend && npm run dev",
            "postgres_optional": "docker compose up -d db",
        },
        "api_routes": _routes(PROJECT_ROOT / "api" / "main.py"),
        "mock_open_banking_routes": _routes(PROJECT_ROOT / "mock_open_banking" / "main.py"),
        "frontend_scripts": _frontend_scripts(),
        "ci_jobs": _ci_jobs(),
        "demo_spine": (
            'POST /journey/connect {"persona_id":"ahmed_borderline",'
            '"requested_amount":80000,"requested_tenor_months":48,"age":28}'
        ),
    }


def search_project_docs(query: str, max_results: int = 8) -> dict:
    """Case-insensitive substring search over README/PLAN/PROGRESS/docs files."""
    query = require_text("query", query, min_len=2, max_len=200)
    max_results = require_int("max_results", max_results, 1, _MAX_SEARCH_RESULTS)

    needle = query.lower()
    results: list[dict] = []
    files = _doc_files()
    for path in files:
        if len(results) >= max_results:
            break
        for line_no, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if needle in line.lower():
                results.append(
                    {
                        "file": str(path.relative_to(PROJECT_ROOT)),
                        "line": line_no,
                        "snippet": line.strip()[:_SNIPPET_CHARS],
                    }
                )
                if len(results) >= max_results:
                    break
    return {
        "query": query,
        "files_searched": [str(p.relative_to(PROJECT_ROOT)) for p in files],
        "result_count": len(results),
        "results": results,
    }


def _env_file_keys(path: Path) -> dict[str, bool]:
    """Key name -> has a non-empty value. Values themselves are read only to
    test emptiness and are never stored or returned."""
    keys: dict[str, bool] = {}
    if not path.exists():
        return keys
    for line in path.read_text(encoding="utf-8").splitlines():
        match = _ENV_KEY_RE.match(line.strip())
        if match:
            keys[match.group(1)] = bool(match.group(2).strip())
    return keys


def inspect_config() -> dict:
    """Report which environment variables are configured — names and booleans
    only, never values."""
    import os

    example_keys = list(_env_file_keys(PROJECT_ROOT / ".env.example"))
    env_file = PROJECT_ROOT / ".env"
    env_file_keys = _env_file_keys(env_file)

    variables = [
        {
            "key": key,
            "set_in_env_file": env_file_keys.get(key, False),
            "set_in_process_env": bool(os.environ.get(key, "").strip()),
        }
        for key in example_keys
    ]
    extra_in_env_file = sorted(set(env_file_keys) - set(example_keys))

    return {
        "guarantee": "This tool never returns configuration values, only key names and set/unset flags.",
        "env_example_file": ".env.example",
        "env_file_exists": env_file.exists(),
        "variables": variables,
        "keys_in_env_file_missing_from_example": extra_in_env_file,
        "notes": {
            "ANTHROPIC_API_KEY / DEEPSEEK_API_KEY": "Optional — only advisor chat needs one; everything else runs without keys.",
            "DATABASE_URL": "Optional — enables Postgres persistence; unset keeps the in-memory demo path.",
            "MOCK_OB_BASE_URL": "Defaults to http://127.0.0.1:8100 when unset.",
        },
    }


@dataclass(frozen=True)
class CheckSpec:
    program: str            # "python" -> sys.executable, "npm" -> resolved from PATH
    args: tuple[str, ...]
    cwd: str                # relative to project root
    timeout_seconds: int
    description: str


# The complete set of commands this server is allowed to run. Fixed argv,
# no shell, no tool input in the command line. Extend only via code review.
ALLOWED_CHECKS: dict[str, CheckSpec] = {
    "python-version": CheckSpec(
        "python", ("--version",), ".", 30, "Interpreter smoke check."
    ),
    "backend-tests": CheckSpec(
        "python", ("-m", "pytest", "core/tests", "-q"), ".", 420,
        "Full deterministic-engine and API contract test suite.",
    ),
    "mcp-tests": CheckSpec(
        "python", ("-m", "pytest", "mcp_server/tests", "-q"), ".", 300,
        "Tests for this MCP server's tools.",
    ),
    "frontend-lint": CheckSpec(
        "npm", ("run", "lint"), "frontend", 300, "ESLint with --max-warnings=0.",
    ),
    "frontend-build": CheckSpec(
        "npm", ("run", "build"), "frontend", 600, "Next.js production build.",
    ),
}


def _resolve_program(program: str) -> str | None:
    if program == "python":
        return sys.executable
    return shutil.which(program)


def project_health_check(check: str) -> dict:
    """Run one allowlisted project check and return its outcome."""
    check = require_choice("check", check, tuple(ALLOWED_CHECKS))
    spec = ALLOWED_CHECKS[check]

    executable = _resolve_program(spec.program)
    if executable is None:
        return {
            "check": check,
            "ok": False,
            "error": f"'{spec.program}' was not found on PATH. Install it or fix PATH, then retry.",
        }

    argv = [executable, *spec.args]
    started = time.monotonic()
    try:
        completed = subprocess.run(
            argv,
            cwd=PROJECT_ROOT / spec.cwd,
            capture_output=True,
            text=True,
            timeout=spec.timeout_seconds,
            shell=False,
        )
    except subprocess.TimeoutExpired:
        return {
            "check": check,
            "command": argv,
            "ok": False,
            "error": f"Timed out after {spec.timeout_seconds}s.",
        }

    output = (completed.stdout or "") + (completed.stderr or "")
    return {
        "check": check,
        "description": spec.description,
        "command": argv,
        "returncode": completed.returncode,
        "ok": completed.returncode == 0,
        "duration_seconds": round(time.monotonic() - started, 1),
        "output_tail": output[-_OUTPUT_TAIL_CHARS:],
    }
