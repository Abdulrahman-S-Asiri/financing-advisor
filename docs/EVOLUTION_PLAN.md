# ATHAR / أثر — Evolution Plan (demo → platform)

This document is a self-contained build specification for the next major
evolution of the project. It is written so any engineer (or implementation
agent) can execute it without other context. Execute the phases **in order**;
inside a phase, execute steps in order. Every step lists Deliverables /
Acceptance / Verify. Never proceed on a broken tree.

Owner (Abdulrahman) reviews between phases. Steps marked **[OWNER]** require
explicit approval before executing (deletions, pushes, deployments, spending).

---

## 0. Ground rules (non-negotiable — inherited from the project, re-stated)

1. **LLMs orchestrate and explain; code calculates.** Every riyal, ratio, APR,
   and eligibility decision comes from the deterministic engine in `core/`.
   The advisor may only state numbers already present in its context or in
   deterministic tool results. Never move money math into a prompt.
2. **`core/` stays pure stdlib.** No pydantic, no numpy, no I/O, no new
   dependencies — under any circumstances.
3. **Honesty end-to-end.** `rate_verified:false` stays visible on every
   surface. Simulated features (OTP, application submission) stay labeled
   simulated. No copy that promises approval or implies licensure.
4. **PDPL data minimization.** The advisor context and all logs carry engine
   outputs and event metadata only — never raw transactions.
5. **Green gates before moving on.** Backend: `python -m pytest tests -q`.
   MCP: `python -m pytest mcp_server/tests -q`. Frontend:
   `npm run lint && npm run typecheck && npm run test && npm run build`
   (+ `npx playwright test` where stated).
6. **No commits or pushes without owner approval.** Prepare the commit,
   show the diff summary and proposed message, wait.
7. Explanation strings stay user-facing quality: Arabic for agent events,
   plain English for engine reasons. New SAMA constants go in `core/dbr.py`
   with the rulebook paragraph cited; unverified values carry a `VERIFY` note.

## 1. Current state (verified 2026-07-06)

- **Backend** — mature and tested: deterministic engine (`core/`), five-agent
  journey pipeline with Arabic SSE events (`agents/`), FastAPI platform API
  (`api/`, :8000), seeded mock Open Banking AIS service
  (`mock_open_banking/`, :8100), optional Postgres persistence, LRU-bounded
  stores, offer-catalog validation gate, number-fidelity guardrail with
  flagged safe fallback, simulated OTP + application state machine.
- **Frontend** (`frontend/`, :3000) — promoted rebuilt site with the official
  ATHAR identity (Midnight Navy `#0A1F44`, Dune Gold `#C9A86A`, Sand White
  `#FAF7F2`, Ink `#111111`; Space Grotesk / IBM Plex Sans Arabic / IBM Plex
  Mono), Next.js 15, Tailwind v4, Zustand + sessionStorage, zod at the fetch
  boundary, stage-per-route journey, Vitest unit tests, and Playwright E2E.
- **CI** — backend tests with Postgres service plus frontend lint, typecheck,
  unit tests, and build.
- **Open external items** — offer rates 0/8 verified (`ready_for_public_demo`
  is false until fixed); SAMA DBR tiers + admin-fee cap not yet re-verified
  against the current Arabic rulebook text.

## 2. Decisions this plan makes (owner may veto before Phase 1)

| # | Decision | Rationale |
|---|---|---|
| D1 | **The rebuilt frontend adopts the official ATHAR identity** (navy/gold/sand tokens + approved type stack), replacing its earlier teal palette | README declares ATHAR the official identity; shipping a separate palette would fork the brand |
| D2 | **The rebuilt frontend is promoted to `frontend/`; the prior implementation is retired behind a tag** after the definition-of-done audit and one human demo rehearsal | The rebuilt frontend supersedes the prior app on every axis (state survival, tests, validation, theming); two frontends is the largest organization debt |
| D3 | **Python packages stay at repo root** (`core/`, `agents/`, `api/`, `mock_open_banking/`); organization comes from packaging metadata, a unified `tests/` tree, `scripts/`, and `docs/` — not from moving import roots | Moving packages rewrites every import, CI, run command, and doc for zero functional gain |
| D4 | **Advisor moves from context-stuffing to a tool-use loop** | Cheaper tokens, engine-computed what-ifs mid-chat, and the flagship agentic capability |
| D5 | **Deployment targets free/low-cost tiers** (frontend on Vercel, API + mock OB on one small host, Postgres on Neon), gated behind the honesty rules | Bootstrapped budget: everything except LLM usage stays ≈ $0–15/month; hard flag anything above $50/month |

---

## Phase 0 — Land the in-flight work

Everything below was completed before the promotion. The tree now keeps one
live frontend and the prior implementation is recoverable by tag.

**Steps**

1. Extend `.gitignore` for frontend build artifacts before anything is staged:
   `frontend/node_modules/`, `frontend/.next/`, `frontend/.env*`,
   `frontend/test-results/`, `frontend/playwright-report/`,
   `*.tsbuildinfo`. Confirm TypeScript build info and Playwright artifacts are
   not staged.
2. Prepare three coherent commits (do not commit until approved **[OWNER]**):
   a. ATHAR identity + doc updates.
   b. `docs/FRONTEND_V2_SPEC.md`.
   c. Rebuilt frontend source (post-gitignore).
3. Run the full verify sweep on both frontends and the backend first.

**Acceptance:** `git status` clean after the approved commits; no build
artifacts, caches, or local tooling files tracked.
**Verify:** backend + MCP pytest green; frontend
`lint && typecheck && test && build` green.

---

## Phase 1 — One frontend: finish, re-skin, and promote the rebuilt app

**Steps**

1. **ATHAR identity in the rebuilt frontend (D1).** Replace the teal token set in
   `frontend/src/app/globals.css` (light + dark) with the ATHAR palette:
   brand = Midnight Navy `#0A1F44`, accent = Dune Gold `#C9A86A`, background =
   Sand White `#FAF7F2`, ink `#111111`; derive the dark set in the same hue
   families with contrast-checked lightness. Add Space Grotesk (headlines /
   English accents) and IBM Plex Mono (labels/data) via `next/font`, keeping
   IBM Plex Sans Arabic as the body face. Port `AtharLogo.tsx` from the prior
   implementation.
   Status colors remain semantic (ok/warn/danger/accent). Both themes pass
   the existing component tests; contrast ≥ WCAG AA on tokens.
2. **Definition-of-done audit** against `docs/FRONTEND_V2_SPEC.md` §7:
   physical-direction utility grep clean; unverified badge on every offer
   surface; journey survives navigation/back/reload; both themes on every
   route; reduced-motion respected; all strings in `strings.ts`; demo script
   executable at :3000. Fix gaps found; record the audit as a checklist in
   the PR description (not a new doc).
3. **Demo rehearsal [OWNER]** — human step: owner runs the three personas on
   :3000 (`sara_strong` headroom, `ahmed_borderline` full application flow,
   `khalid_rejected` explained rejection + simulator flip). Proceed only on
   owner sign-off.
4. **The swap [OWNER].** The prior `frontend/` was deleted after tagging
   (`git tag frontend-v1-final` on the pre-swap commit), then the rebuilt
   source was promoted to `frontend/`.
   Update: dev port back to 3000 in `package.json`, CI `working-directory`
   and cache paths, `.gitignore` paths, README run instructions,
   `docs/FRONTEND_V2_SPEC.md` marked completed (one status line at top).
   Grep the repo for retired v2 path and retired port references afterwards —
   zero live refs.

**Acceptance:** one frontend at `frontend/` on :3000 with all v2 gates green;
the prior app recoverable via tag; CI green on the swapped layout.
**Verify:** full sweep — backend pytest, MCP pytest, frontend
`lint && typecheck && test && build`, `npx playwright test` with backend +
mock OB running.

---

## Phase 2 — Repository organization

Root becomes: `README.md`, `pyproject.toml`, `docker-compose.yml`, config
dotfiles, and the six working directories (`core/`, `agents/`, `api/`,
`mock_open_banking/`, `frontend/`, `mcp_server/`) plus `db/`, `docs/`,
`tests/`, `scripts/`, `.github/`.

**Steps**

1. **`pyproject.toml` replaces `requirements.txt` — completed.** Project metadata,
   runtime dependencies (fastapi, uvicorn, httpx, pydantic, anthropic,
   python-dotenv, psycopg), a `dev` extra (pytest), and pytest configuration
   now live in `pyproject.toml`. Pytest discovers
   `["tests", "mcp_server/tests"]`. README quickstart and CI use
   `pip install -e .[dev]`; root `requirements.txt` is removed.
   `mcp_server/requirements.txt` stays (it is a self-contained tool).
2. **Unified `tests/` tree — completed.** The previous backend test tree mixed
   engine, agent, API, and e2e tests. Move to:
   - `tests/core/` — `test_engine.py`, `test_profile.py`,
     `test_offers_catalog.py`, `test_offer_verification.py`
   - `tests/agents/` — `test_advisor_guardrail.py`, `test_llm_client.py`
   - `tests/api/` — `test_advisor_chat_api.py`, `test_healthz.py`,
     `test_persistence_bounds.py`, `test_phase_groundwork.py`,
     `test_frontend_contract.py`, `test_end_to_end.py`
   - `tests/fixtures/` — `frontend_contract_keys.json`
   Fix relative fixture paths, then update **every** reference:
   `.github/workflows/ci.yml`, README, `docs/`, the MCP
   `project_health_check` allowlist in `mcp_server/project_tools.py` (+ its
   tests). Grep for the retired backend test path afterwards — zero live refs.
3. **`scripts/` — completed.** `scripts/dev.ps1` + `scripts/dev.sh` start
   mock OB, API, and frontend as three processes from one command.
   `scripts/check.ps1` + `scripts/check.sh` run backend tests, MCP tests, and
   the frontend lint/typecheck/unit/build gate in fail-fast order, with an
   optional E2E flag for live-service Playwright checks. README documents both
   paths. No new dependencies — plain shell/PowerShell.
4. **Docs consolidation — completed.** The root execution plan moved to
   `docs/PLAN.md`, and the root progress log moved to `docs/PROGRESS.md`.
   README now links the docs map, the moved docs describe the post-swap reality
   (one frontend, new test layout, developer scripts), and MCP doc search
   follows the consolidated docs location. Root keeps README only. `docs/`
   now holds: PLAN, PROGRESS,
   FRONTEND_V2_SPEC (completed), EVOLUTION_PLAN (this file),
   PRODUCTION_READINESS, DATA_PRODUCTS, DEMO_SCRIPT, DEMO_CHECKLIST.
5. **Hygiene pass — completed.** Stale live references from the test move were
   cleaned up, `.env.example` now documents the backend, frontend, persistence,
   provider, store-cap, and simulated-auth env vars the code reads, and no
   new secrets were added.

**Acceptance:** root contains no loose planning files; tests run from the new
tree with identical counts; scripts work on Windows (PowerShell) and POSIX.
**Verify:** `python -m pytest tests -q` (all previous tests present and
green), MCP pytest, frontend sweep, `scripts/check.ps1` end-to-end, CI green.

---

## Phase 3 — Agentic evolution (the new level)

### 3A. Advisor tool-use loop (D4)

Replace context-stuffing with native tool calling while keeping the
number-fidelity guardrail authoritative.

**Steps**

1. **LLM client tool loop — completed.** `agents/llm_client.py` now accepts
   tool definitions and deterministic handlers, runs the
   `tool_use` → execute → `tool_result` loop, forces a final text answer after
   the configured round cap, and aggregates usage across model calls. Lazy
   imports are preserved, and fake-client tests cover the loop without an API
   key.
2. **Advisor deterministic handlers — completed.** `agents/advisor.py` now
   uses a slim initial context (profile summary + per-offer headlines) and
   exposes `simulate_scenario`, `get_offer_detail`, `get_payment_schedule`,
   and `evaluate_dbr` as deterministic tool handlers. Tool inputs are
   validated and tool outputs come only from existing engine/tool code.
3. **Guardrail tool-result union — completed.** The allowed-number set is now
   initial context ∪ every deterministic tool result returned during the tool
   loop. Retry + flagged safe-fallback behavior remains unchanged
   (`guardrail_fallback: true` end-to-end).
4. **Advisor tool trace — completed.** API chat now records each advisor tool
   call as a `TOOL_CALLED` event with tool name, round number, and error flag
   only — no tool input amounts or output values in the event payload.
5. **Prompt caching — completed.** Anthropic requests now mark the system prompt
   and final tool definition with `cache_control` breakpoints; DeepSeek
   compatibility requests stay plain, and fake-client tests assert cache-token
   usage aggregation.
6. **Tests — completed.** Scripted fake LLM tests assert tool dispatch, round
   cap, prompt-cache payload shape, usage aggregation, guardrail over the union
   set, metadata-only event recording, fallback behavior, and the compact
   advisor-context payload regression.

**Acceptance:** advisor answers what-if questions by calling `simulate_scenario`
itself; chat context payload shrinks (extend the existing payload-size
regression test); all guardrail tests green.

### 3B. LLM transaction categorizer (categories only, never amounts)

**Steps**

1. **Core callback seam — completed.** `core/profile.py` accepts an optional
   `categorizer` callback injected by callers; `core/` imports nothing new.
   Heuristics remain the default and fallback, and the callback may only
   relabel the *category* of ambiguous descriptions, never amounts, dates, or
   decisions.
2. **Categorizer wrapper — completed.** `agents/categorizer.py` batches
   descriptions into the fixed category enum, sends only description +
   direction, parses strict JSON, and returns no relabels on any error.
3. **Orchestrator wiring — completed.** `agents/orchestrator.py` runs the
   categorizer only when an LLM provider is configured, sends ambiguous
   descriptions only, and emits Arabic profile-agent events with metadata
   counts only.
4. **Label dataset + optional live accuracy gate — completed.**
   `db/categorizer_labels.json` captures seeded persona descriptions and
   expected categories; deterministic fake-client tests cover strict parsing,
   safe fallback, prompt fields, and the dataset schema. A live accuracy test
   compares the categorizer against the seeded labels and the deterministic
   heuristic baseline, and skips unless an LLM provider is configured.

**Acceptance:** journey output is byte-identical when no key is configured;
with the fake client, relabeled categories flow into the profile while every
amount stays untouched (asserted). The live accuracy gate exists but does not
run without provider configuration.

### 3C. Structured logging + journey-scoped request IDs

**Steps**

1. Stdlib `logging` with a JSON formatter in `api/`: one request log line
   (method, path, status, duration, `X-Request-ID`) and journey lifecycle
   lines keyed by `journey_id`. Middleware assigns/propagates
   `X-Request-ID`; SSE responses echo it as a header.
2. Log hygiene rule enforced by a test: log lines never contain amounts,
   transaction descriptions, phone numbers, or secret values (canary test in
   the spirit of the existing healthz secret-leak test).

**Acceptance:** every API response carries `X-Request-ID`; a journey can be
traced across log lines by `journey_id`; canary test green.

---

## Phase 4 — Quality gates and deployment

**Steps**

1. **Golden-journey snapshots — completed.** For each persona, the in-process
   journey snapshot test stores the response payload minus volatile fields
   (`journey_id`, timestamps) in `tests/fixtures/golden/`. Any engine or
   payload change that alters demo output now fails loudly with a readable diff
   and requires a deliberate fixture update. The snapshot test also asserts raw
   transaction fields are not present.
2. **CI overhaul — completed.** `.github/workflows/ci.yml` now has separate
   backend, MCP, frontend, and live-service Playwright jobs. The e2e job boots
   mock Open Banking + the API in the background, waits for `/healthz`, lets
   Playwright start the Next.js frontend, and uploads Playwright reports plus
   service logs on failure.
3. **Containerization — completed.** `Dockerfile.api` and
   `Dockerfile.mock-open-banking` use Python 3.12 slim images and non-root
   users. `.dockerignore` keeps local secrets, caches, dependency folders, and
   private tooling out of the build context. `docker-compose.prod.yml` runs
   Postgres + mock Open Banking + the API with health checks, initializes
   `db/schema.sql`, and wires the API to the mock OB service and database.
4. **Deploy [OWNER]** (D5 — flag any cost > $50/month before committing):
   - Postgres → Neon free tier; run `db/schema.sql`.
   - API + mock OB → one small host (Fly.io / Railway / small VM) with
     `DATABASE_URL`, `ANTHROPIC_API_KEY`, `MOCK_OB_BASE_URL` as platform
     secrets — never in the repo.
   - Frontend → Vercel; `BACKEND_URL` env points the rewrite proxy at the
     API host.
   - Guard rails for a public URL: `robots.txt` noindex while
     `ready_for_public_demo` is false; demo disclaimer already permanent;
     CORS restricted to the frontend origin; simple per-IP throttle on
     `/advisor/chat*` (in-memory, no new dependency) since LLM calls cost
     money.
5. **Post-deploy smoke:** `/healthz` green, one full persona journey on the
   public URL, `/status` shows honest verification coverage.

**Acceptance:** CI runs four green jobs on every PR; the public demo URL
serves the full journey; no secret appears in the repo, logs, or `/healthz`.
**Verify:** CI on a test branch; the smoke checklist above.

---

## Phase 5 — Data truth and the moat (human + code)

**Steps**

1. **[HUMAN] Offer-rate verification pass.** Replace the 8 placeholder rates
   from official lender pages; fill `source_url` + `retrieved_at`; flip
   `rate_verified` only with a real source; grow the catalog toward 15–25
   offers. Tracked by `GET /offers/verification`; `ready_for_public_demo`
   flips automatically. *This is research, not code — the implementer must
   not invent rates or sources.*
2. **[HUMAN] SAMA re-verification.** Confirm DBR tiers, the 60-month tenor
   cap, and the admin-fee cap against the current Arabic rulebook text;
   update `core/dbr.py` constants + citations; remove `VERIFY` notes only
   with a confirmed source.
3. **Aggregate outcome persistence.** Extend `db/schema.sql` +
   `api/persistence.py` with an aggregate outcomes table (journey counts,
   status distribution, simulator usage — no persona IDs, no transactions,
   per `docs/DATA_PRODUCTS.md`); `/analytics/overview` reads Postgres when
   enabled so analytics survive restarts and LRU eviction.
4. **Roadmap refresh.** Update `docs/PLAN.md` phases/priority table to
   reflect everything above as done; next horizon items (Nafath, licensed
   TPP, lender submission) stay external-partner work.

**Acceptance:** `ready_for_public_demo: true` (after step 1);
`/analytics/overview` consistent across API restarts with Postgres enabled;
docs match reality.

---

## Sequencing and sizing

| Phase | Depends on | Size | Mostly |
|---|---|---|---|
| 0 — land in-flight work | — | S | git hygiene |
| 1 — one frontend | 0 | M | frontend |
| 2 — repo organization | 1 | M | moves + references |
| 3A — advisor tool loop | 0 | L | agents + tests |
| 3B — categorizer | 3A | M | agents + core hook |
| 3C — logging/IDs | 0 | S | api |
| 4 — quality + deploy | 1, 2 | M–L | CI + infra |
| 5 — data truth | 4 | external + S | human research |

3A/3C can proceed in parallel with 1–2 (different layers, no file overlap).
Each step is sized to land as one reviewable commit.

## Risks

| Risk | Mitigation |
|---|---|
| Brand re-skin regresses v2 contrast/tests | Token-only change + component tests + WCAG check in Phase 1 step 1 |
| The swap breaks CI or local workflows | Grep gates for retired frontend path, retired port, and backend test path; tag before deleting; CI on a branch first |
| Tool-use loop weakens the guardrail | Allowed set is strictly context ∪ tool results; fallback path unchanged; fake-client tests cover the union logic |
| Public URL before rates are verified | noindex + permanent demo framing + honest `/status`; `ready_for_public_demo` stays the gate |
| LLM cost on a public endpoint | Prompt caching (3A.5), slim context, per-IP throttle, usage recorded per journey |
| Moves hide functional changes in diffs | Phases 1–2 contain **only** moves/renames/reference updates — no behavior changes mixed in |
