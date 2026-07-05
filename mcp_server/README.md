# financing-advisor MCP server

A local, project-scoped [Model Context Protocol](https://modelcontextprotocol.io)
server exposing the project's deterministic engine and metadata to MCP clients
over stdio.

**Charter: read-only, offline, deterministic.** No LLM calls, no network, no
file writes, no arbitrary command execution. The only subprocesses are the
fixed-argv allowlist in `project_tools.ALLOWED_CHECKS`.

## Setup

```bash
# from the project root, inside the project venv
python -m pip install -r mcp_server/requirements.txt

# verify the tools work
python -m pytest mcp_server/tests -q

# run the server (stdio — normally launched by an MCP client, not by hand)
python -m mcp_server.server
```

Client configuration lives in the project-root `.mcp.json`. Local client setup
and troubleshooting: `docs/MCP_AND_SKILLS.md`.

## Tools

| Tool | What it does |
|---|---|
| `project_overview` | Purpose, layer map, key commands, live counts (offers/personas/routes/tests). |
| `list_project_workflows` | Service commands, all API routes (platform + mock OB), npm scripts, CI jobs. |
| `search_project_docs` | Substring search over README/PLAN/PROGRESS/docs markdown. |
| `inspect_config` | Which `.env.example` keys are set (names + booleans only, never values). |
| `project_health_check` | Run one allowlisted check: `python-version`, `backend-tests`, `mcp-tests`, `frontend-lint`, `frontend-build`. |
| `list_personas` | Seeded demo personas with salary, obligations, and demo role. |
| `run_journey` | Full deterministic pipeline (profile → DBR → matching → pricing) for a persona, in-process — no servers needed. |
| `price_financing` | Installment / total payable / effective APR for a catalog offer or ad-hoc flat rate. |
| `evaluate_dbr` | Hypothetical borrower vs SAMA DBR caps, with max affordable installment. |
| `offer_verification_status` | Placeholder-vs-verified coverage of `db/seed_offers.json`. |

## Layout

```
server.py         MCP entry point — the ONLY module importing the mcp SDK
project_tools.py  repo metadata + allowlisted health checks
engine_tools.py   deterministic finance tools over core/ + seeded personas
validation.py     shared input validation helpers
tests/            pytest suite (runs without the mcp SDK installed)
```

## Adding a tool

1. Implement a pure function in `project_tools.py` or `engine_tools.py`
   returning a bounded, JSON-serializable dict. Validate every input via
   `validation.py`; raise `ValueError` naming the valid range/set.
2. Register it in `server.py` with `@mcp.tool()` and a docstring written for
   the client choosing between tools.
3. Add tests (happy path + every rejection path; a no-secret-leak assertion
   if it touches config).
4. Update the table above. Restart the server in your client to pick it up.

Security rules: no shell, no writes, no secret values in output, no external
APIs. New subprocess commands go only into `ALLOWED_CHECKS` with fixed argv
and a timeout.

Note: offer loading goes through the shared validation gate in
`core/offers_catalog.py`. An invalid `db/seed_offers.json` makes the
offer-backed tools raise a `ValueError` listing every problem — the same
errors that fail the API at startup.
