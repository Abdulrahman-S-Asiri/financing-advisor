# Project Progress

This file records completed implementation phases, verification status, and the next planned slice.

## Current Status

- Branch: `master`
- Latest documented phase: Official ATHAR visual identity
- Main app flow: consent simulation, live journey events, financial dashboard, offers marketplace, what-if simulator, advisor chat, and simulated application tracker.
- Frontend identity: ATHAR / أثر is the official website identity, using Midnight Navy, Dune Gold, Sand White, Ink, the decision-dot mark, and the approved typography stack.
- Local private files are ignored by `.gitignore`, including `.env`, `.venv/`, frontend env files, Next cache, and dependency folders.

## Completed Phases

| Area | Status | Notes |
|---|---|---|
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
| Backend/frontend contract test | Done | Payload key sets pinned to `core/tests/fixtures/frontend_contract_keys.json`, mirroring frontend types; drift fails with named keys. |
| Guardrail fallback surfaced | Done | `guardrail_fallback` flag flows from the advisor through chat JSON and the SSE done frame; chat renders flagged safe replies as marked amber bubbles. |
| Full website shell | Done | Landing page, shared nav + footer with demo disclaimer, IBM Plex Sans Arabic, Arabic error/404 pages. |
| Journey route move | Done | Journey extracted to `features/journey/JourneyApp.tsx`, served at `/journey` with `?persona=` preselect; offer-detail back-link updated. |
| Docs and status pages | Done | `/docs` explains engine-vs-narrator and demo limits; `/status` shows health, honest rate-verification coverage (0/8), OB provider, and session activity from live endpoints. |
| Official ATHAR visual identity | Done | Frontend routes use ATHAR / أثر branding, navy/gold/sand/ink tokens, SVG logo variants, and Space Grotesk / IBM Plex Sans Arabic / IBM Plex Mono typography. |

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

- Run frontend lint and build.
- Run backend tests.
- Run Git whitespace checks.
- Check local frontend and backend health when servers are running.
- Commit and push the completed phase.
- Verify GitHub Actions CI is green.

## Next Planned Slice

Continue end-to-end journey QA and verified lender offer review. Real Nafath,
licensed Open Banking access, and lender submission remain external
partnership/compliance work before production launch.
