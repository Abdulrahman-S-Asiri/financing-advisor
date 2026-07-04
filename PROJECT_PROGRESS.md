# Project Progress

This file records completed implementation phases, verification status, and the next planned slice.

## Current Status

- Branch: `master`
- Latest documented phase: response-size regression checks
- Main app flow: consent simulation, live journey events, financial dashboard, offers marketplace, what-if simulator, advisor chat, and simulated application tracker.
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

## Recent Commits

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

Continue route-level UI polish and add focused browser click-through checks for the offer detail path.
