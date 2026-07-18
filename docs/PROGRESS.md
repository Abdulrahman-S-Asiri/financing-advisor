# Project Progress

This file records completed implementation phases, verification status, and the next planned slice.

## Current Status

- Branch: `master`
- Latest documented phase: Fresh bilingual frontend rebuild
- Main app flow: consent simulation, live journey events, financial dashboard, offers marketplace, what-if simulator, advisor chat, simulated application tracker, and route-persistent journey state.
- Frontend identity: ATHAR / أثر is the official website identity, using Midnight Navy, Dune Gold, Sand White, Ink, the decision-dot mark, and the approved typography stack.
- Repository shape: one live frontend in `frontend/`, Python dependencies in `pyproject.toml`, backend tests under `tests/`, and planning docs under `docs/`.
- Local private files are ignored by `.gitignore`, including `.env`, `.venv/`, frontend env files, Next cache, and dependency folders.

## Completed Phases

| Area | Status | Notes |
|---|---|---|
| Fresh bilingual frontend | Done | Previous frontend trees were owner-approved for deletion and replaced with one Next.js 16 app at `frontend/`, Arabic-default RTL and English `/en/*`, frozen zod contracts, route-persistent state, honesty surfaces, unit/audit tests, and Playwright coverage. |
| Provider configuration | Done | Supports Anthropic-compatible and DeepSeek provider settings from environment variables. |
| Agent event pipeline | Done | Journey pipeline emits ordered events for profile, matching, cost, advisor, and application surfaces. |
| Streaming contracts | Done | Journey and chat streams use structured SSE frames with IDs and retry hints. |
| Persistence | Done | Journey snapshots, trace events, and application status history can persist through Postgres when `DATABASE_URL` is set. |
| Open Banking adapter | Done | AIS-style PascalCase payloads and prior mock payloads are handled at the adapter boundary. |
| Advisor tools | Done | Simulator, offer detail, and payment schedule tool endpoints are available. |
| Offer verification | Done | Review checklist, CSV export, source flags, and unverified-rate warnings are exposed. |
| Marketplace UI | Done | Status filters, structure filters, sorting, comparison, DBR traces, and cost details are implemented. |
| Financial dashboard | Done | Shows salary confidence, obligations, DBR gauges, and affordable installment headroom. |
| What-if simulator | Done | Re-runs deterministic matching with amount, tenor, and salary-transfer changes. |
| Application tracker | Done | Simulated draft, submit, review, and final status flow is implemented. |
| Frontend module split | Done | Main journey page was split into feature modules and lazy-loaded stage screens. |
| Offer detail route | Done | Heavy offer detail and full payment schedule moved to a route-level detail screen. |
| Main journey payload trim | Done | Full payment schedule rows were removed from journey and simulator match payloads. |
| Advisor context payload trim | Done | Advisor chat context now carries schedule month counts instead of full schedule rows. |
| Response-size regression checks | Done | Seeded journey and advisor context sizes are covered by lightweight tests. |
| Offer detail route polish | Done | Offer detail labels are Arabic-first and generated offer detail routes are verified through local API and frontend HTTP checks. |
| Route mobile polish | Done | Offer detail topbar, hero copy, badges, trace text, and source links are tightened for small screens. |
| Main flow mobile polish | Done | Journey controls, offer actions, badges, and chat text wrap more safely on narrow screens. |
| CI action runtime update | Done | GitHub Actions first-party workflow actions are updated to Node 24-compatible major versions. |
| Interim auth contract | Done | Simulated phone OTP start/verify/session endpoints are available for local product wiring. |
| Open Banking gateway seam | Done | Mock AIS calls now pass through `api.open_banking.OpenBankingGateway`, with an integration status endpoint. |
| Outcome analytics groundwork | Done | Aggregate-only analytics endpoint and data-product spec are available without raw persona IDs or transactions. |
| Production readiness docs | Done | Auth, Open Banking, lender submission, compliance, and data-product next steps are documented. |
| Advisor guardrail percent handling | Done | Percent-formatted rates now match their decimal context values (10.2% ↔ 0.102) within a strict tolerance; fabricated percentages remain blocked. |
| Offer catalog validation gate | Done | `core/offers_catalog.py` validates fields, types, enums, ranges, unknown keys, and duplicate ids; the API fails startup with readable errors and MCP tooling shares the gate. |
| Bounded in-memory stores | Done | Journey and application stores are LRU-bounded (default 500, env-overridable); Postgres reload on miss unchanged. |
| Health endpoint | Done | `GET /healthz` reports version, offer count, and config booleans only — tested against secret leakage. |
| Backend/frontend contract test | Done | Payload key sets pinned to `tests/fixtures/frontend_contract_keys.json`, mirroring frontend schemas; drift fails with named keys. |
| Guardrail fallback surfaced | Done | `guardrail_fallback` flag flows from the advisor through chat JSON and the SSE done frame; chat renders flagged safe replies as marked amber bubbles. |
| Full website shell | Done | Landing page, shared nav + footer with demo disclaimer, IBM Plex Sans Arabic, Arabic error/404 pages. |
| Journey route split | Done | Journey now runs across `/journey`, `/journey/analysis`, `/journey/offers`, and `/journey/decision`, with `?persona=` preselect and offer-detail back-link state survival. |
| Docs and status pages | Done | `/docs` explains engine-vs-narrator and demo limits; `/status` shows health, honest rate-verification coverage (0/8), OB provider, and session activity from live endpoints. |
| Official ATHAR visual identity | Done | Frontend routes use ATHAR / أثر branding, navy/gold/sand/ink tokens, SVG logo variants, and Space Grotesk / IBM Plex Sans Arabic / IBM Plex Mono typography. |
| Frontend v2 implementation | Done | Route-split journey, zod API boundaries, Zustand session persistence, UI kit tests, and Playwright smoke coverage are implemented. |
| Frontend v2 promotion | Done | Rebuilt frontend is promoted to `frontend/` on :3000; the prior frontend is recoverable through the `frontend-v1-final` tag. |
| Python packaging metadata | Done | Root dependencies and pytest configuration now live in `pyproject.toml`; local and CI setup use editable install with the `dev` extra. |
| Unified backend test tree | Done | Backend tests moved from the engine package into `tests/core`, `tests/agents`, `tests/api`, and `tests/fixtures`; CI and MCP health checks run `pytest tests -q`. |
| Developer scripts | Done | `scripts/dev.*` starts the local demo stack, and `scripts/check.*` runs backend, MCP, and frontend verification in fail-fast order. |
| Docs consolidation | Done | Planning docs moved to `docs/PLAN.md` and `docs/PROGRESS.md`; README now links the docs map. |
| Repository hygiene | Done | `.env.example` documents runtime env vars, live stale test-path references are cleaned up, and ignored private notes remain untouched. |
| LLM tool-loop foundation | Done | `agents/llm_client.py` can run Anthropic-style tool calls through deterministic handlers, aggregate usage, and force a final answer after the round cap. |
| Advisor deterministic tools | Done | Chat can call simulation, offer detail, payment schedule, and DBR tools; guardrail checks include tool-result numbers; API trace logs metadata-only tool events. |
| Advisor prompt caching | Done | Anthropic advisor requests mark the system prompt and final tool definition with cache-control breakpoints; DeepSeek compatibility requests remain plain. |
| Advisor tool-loop regression tests | Done | Fake-client and end-to-end tests cover cache-token usage aggregation, provider-specific cache payloads, tool traces, guardrails, fallback behavior, and compact chat context size. |
| Categorizer callback seam | Done | `core.profile.extract_profile` accepts an injected category-only callback while keeping deterministic heuristics as the default fallback. |
| Transaction categorizer wrapper | Done | `agents/categorizer.py` sends only description and direction, parses strict JSON labels, and returns no relabels on malformed output or provider errors. |
| Categorizer label dataset | Done | `db/categorizer_labels.json` labels seeded persona descriptions; fake-client tests cover prompt fields, fallback behavior, and schema constraints. |
| Categorizer orchestration | Done | `agents.orchestrator` runs the categorizer only when an LLM provider is configured, emits metadata-only Arabic profile events, and keeps no-key journeys byte-identical to the disabled path. |
| Categorizer live accuracy gate | Done | A provider-gated test compares live categorizer labels against seeded fixtures and the deterministic heuristic baseline, skipping cleanly without an LLM provider. |
| Golden journey snapshots | Done | Three demo persona payloads are stored under `tests/fixtures/golden/`; snapshot tests strip volatile fields and assert raw transaction fields stay out of payloads. |
| CI live-service Playwright gate | Done | GitHub Actions now runs backend, MCP, frontend, and live-service Playwright jobs; the E2E job starts mock Open Banking and API services, waits on `/healthz`, and uploads browser/service logs on failure. |
| Containerized backend services | Done | `Dockerfile.api`, `Dockerfile.mock-open-banking`, `.dockerignore`, and `docker-compose.prod.yml` provide a production-shaped local stack for Postgres, mock Open Banking, and the API with health checks. |

## Recent Commits

- `dfb43ba` - Add debt payment coming soon UI
- `a07b495` - Improve main flow mobile wrapping
- `f01847d` - Improve route mobile layout
- `53f4d25` - Polish offer detail route
- `1a66bdf` - Add payload size regression checks
- `7fb2fd5` - Trim advisor context payload
- `eb5be51` - Trim journey schedule payloads
- `9bd3b58` - Add offer detail route
- `6b94478` - Refactor journey frontend modules
- `7836d8a` - Improve application flow tracker
- `c7e3d37` - Add marketplace filters and sorting
- `e3901ca` - Add financial health dashboard
- `f30d46a` - Expose offer DBR traces
- `fe277c8` - Expose offer cost breakdowns
- `35b7297` - Add offer comparison panel
- `0407d56` - Add frontend what-if simulator
- `e3934fb` - Stream journey events in frontend
- `a3ab46b` - Record advisor usage traces
- `7627d8e` - Align AIS payload adapters
- `d8252a6` - Harden streaming event contract

## Verification Pattern

Before closing each phase:

- Run frontend lint, typecheck, unit tests, and build.
- Run backend tests.
- Prefer `.\scripts\check.ps1` or `bash scripts/check.sh` for the complete
  local sweep.
- Run Git whitespace checks.
- Check local frontend and backend health when servers are running.
- Commit and push the completed phase.
- Verify GitHub Actions CI is green.

## Next Planned Slice

Phase 4 deploy support is next, but it is owner-gated because it can involve
hosting accounts, secrets, and cost. If deployment is not approved yet, the
next code slice is structured logging and journey-scoped request IDs. Verified
lender offer review remains the main external data task. Real Nafath,
licensed Open Banking access, and lender submission remain external
partnership/compliance work before production launch.
