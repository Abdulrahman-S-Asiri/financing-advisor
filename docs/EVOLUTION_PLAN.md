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
5. **Green gates before moving on.** Backend: `python -m pytest tests -q`
   (path `core/tests` until Phase 2 moves it). MCP:
   `python -m pytest mcp_server/tests -q`. Frontend:
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
- **Frontend v1** (`frontend/`, :3000) — live site; working tree carries an
  uncommitted rebrand to the official ATHAR identity (Midnight Navy `#0A1F44`,
  Dune Gold `#C9A86A`, Sand White `#FAF7F2`, Ink `#111111`; Space Grotesk /
  IBM Plex Sans Arabic / IBM Plex Mono).
- **Frontend v2** (`frontend-v2/`, :3001, untracked) — from-scratch rebuild
  per `docs/FRONTEND_V2_SPEC.md`: Next.js 15, Tailwind v4, Zustand +
  sessionStorage, zod at the fetch boundary, stage-per-route journey, Vitest
  unit tests, Playwright E2E (last run: passed). Built on the **old teal
  palette** — predates the ATHAR identity.
- **CI** — backend tests with Postgres service + v1 lint/build only. No
  frontend unit tests, no E2E, nothing for v2.
- **Open external items** — offer rates 0/8 verified (`ready_for_public_demo`
  is false until fixed); SAMA DBR tiers + admin-fee cap not yet re-verified
  against the current Arabic rulebook text.

## 2. Decisions this plan makes (owner may veto before Phase 1)

| # | Decision | Rationale |
|---|---|---|
| D1 | **v2 adopts the official ATHAR identity** (navy/gold/sand tokens + approved type stack), replacing its teal palette | README and the v1 working tree declare ATHAR the official identity; shipping v2 in teal would fork the brand |
| D2 | **v2 is promoted to `frontend/`; v1 is retired** after the definition-of-done audit and one human demo rehearsal | v2 supersedes v1 on every axis (state survival, tests, validation, theming); two frontends is the largest organization debt |
| D3 | **Python packages stay at repo root** (`core/`, `agents/`, `api/`, `mock_open_banking/`); organization comes from packaging metadata, a unified `tests/` tree, `scripts/`, and `docs/` — not from moving import roots | Moving packages rewrites every import, CI, run command, and doc for zero functional gain |
| D4 | **Advisor moves from context-stuffing to a tool-use loop** | Cheaper tokens, engine-computed what-ifs mid-chat, and the flagship agentic capability |
| D5 | **Deployment targets free/low-cost tiers** (frontend on Vercel, API + mock OB on one small host, Postgres on Neon), gated behind the honesty rules | Bootstrapped budget: everything except LLM usage stays ≈ $0–15/month; hard flag anything above $50/month |

---

## Phase 0 — Land the in-flight work

Everything below assumes a clean tree. Today's tree has ~15 modified files
(ATHAR rebrand of v1 + docs) and three untracked paths (`frontend-v2/`,
`docs/FRONTEND_V2_SPEC.md`, `frontend/src/components/site/AtharLogo.tsx`).

**Steps**

1. Extend `.gitignore` for v2 build artifacts before anything is staged:
   `frontend-v2/node_modules/`, `frontend-v2/.next/`, `frontend-v2/.env*`,
   `frontend-v2/test-results/`, `frontend-v2/playwright-report/`,
   `*.tsbuildinfo`. Confirm `frontend-v2/tsconfig.tsbuildinfo` and
   `frontend-v2/test-results/` are not staged.
2. Prepare three coherent commits (do not commit until approved **[OWNER]**):
   a. v1 ATHAR identity + doc updates (the 15 modified files + `AtharLogo.tsx`).
   b. `docs/FRONTEND_V2_SPEC.md`.
   c. `frontend-v2/` source (post-gitignore).
3. Run the full verify sweep on both frontends and the backend first.

**Acceptance:** `git status` clean after the approved commits; no build
artifacts, caches, or local tooling files tracked.
**Verify:** backend + MCP pytest green; v1 `lint && build` green; v2
`lint && typecheck && test && build` green.

---

## Phase 1 — One frontend: finish, re-skin, and promote v2

**Steps**

1. **ATHAR identity in v2 (D1).** Replace the teal token set in
   `frontend-v2/src/app/globals.css` (light + dark) with the ATHAR palette:
   brand = Midnight Navy `#0A1F44`, accent = Dune Gold `#C9A86A`, background =
   Sand White `#FAF7F2`, ink `#111111`; derive the dark set in the same hue
   families with contrast-checked lightness. Add Space Grotesk (headlines /
   English accents) and IBM Plex Mono (labels/data) via `next/font`, keeping
   IBM Plex Sans Arabic as the body face. Port `AtharLogo.tsx` from v1.
   Status colors remain semantic (ok/warn/danger/accent). Both themes pass
   the existing component tests; contrast ≥ WCAG AA on tokens.
2. **Definition-of-done audit** against `docs/FRONTEND_V2_SPEC.md` §7:
   physical-direction utility grep clean; unverified badge on every offer
   surface; journey survives navigation/back/reload; both themes on every
   route; reduced-motion respected; all strings in `strings.ts`; demo script
   executable at :3001. Fix gaps found; record the audit as a checklist in
   the PR description (not a new doc).
3. **Demo rehearsal [OWNER]** — human step: owner runs the three personas on
   :3001 (`sara_strong` headroom, `ahmed_borderline` full application flow,
   `khalid_rejected` explained rejection + simulator flip). Proceed only on
   owner sign-off.
4. **The swap [OWNER].** `frontend/` → deleted after tagging (`git tag
   frontend-v1-final` on the pre-swap commit), `frontend-v2/` → `frontend/`.
   Update: dev port back to 3000 in `package.json`, CI `working-directory`
   and cache paths, `.gitignore` paths, README run instructions,
   `docs/FRONTEND_V2_SPEC.md` marked completed (one status line at top).
   Grep the repo for `frontend-v2` and `3001` afterwards — zero live refs.

**Acceptance:** one frontend at `frontend/` on :3000 with all v2 gates green;
v1 recoverable via tag; CI green on the swapped layout.
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

1. **`pyproject.toml` replaces `requirements.txt`.** Project metadata,
   runtime dependencies (fastapi, uvicorn, httpx, pydantic, anthropic,
   python-dotenv, psycopg), a `dev` extra (pytest), and pytest configuration
   (`testpaths = ["tests", "mcp_server/tests"]`). Update README quickstart
   (`pip install -e .[dev]`), CI install step, and delete `requirements.txt`.
   `mcp_server/requirements.txt` stays (it is a self-contained tool).
2. **Unified `tests/` tree.** `core/tests/` currently mixes engine, agent,
   API, and e2e tests. Move to:
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
   tests). Grep for `core/tests` afterwards — zero live refs.
3. **`scripts/`.** `scripts/dev.ps1` + `scripts/dev.sh` (start mock OB, API,
   frontend — three processes, one command) and `scripts/check.ps1` +
   `scripts/check.sh` (the full verify sweep in order, fail-fast). Document
   in README. No new dependencies — plain shell/PowerShell.
4. **Docs consolidation.** Move `PLAN.md` → `docs/PLAN.md` and
   `PROJECT_PROGRESS.md` → `docs/PROGRESS.md`; refresh both to describe the
   post-swap reality (one frontend, new test layout) and link them from
   README. Root keeps README only. `docs/` then holds: PLAN, PROGRESS,
   FRONTEND_V2_SPEC (completed), EVOLUTION_PLAN (this file),
   PRODUCTION_READINESS, DATA_PRODUCTS, DEMO_SCRIPT, DEMO_CHECKLIST.
5. **Hygiene pass.** Remove dead code and stale references found by the
   moves; ensure `.env.example` documents every env var the code reads
   (`ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `DATABASE_URL`,
   `MOCK_OB_BASE_URL`, `OPEN_BANKING_PROVIDER`, `JOURNEY_STORE_MAX`,
   `APPLICATION_STORE_MAX`, auth TTLs); no secrets anywhere.

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

1. `agents/llm_client.py`: add tool-calling support — pass tool definitions,
   run the `tool_use` → execute → `tool_result` loop (max 5 rounds, then
   force a final text answer), aggregate usage across rounds. Keep lazy
   imports; everything must import without an API key.
2. `agents/advisor.py`: slim the initial context to the profile summary and
   per-offer headlines (institution, product, structure, status, installment,
   APR, `rate_verified`). Expose deterministic tools backed by existing code:
   `simulate_scenario` (`advisor_tools.simulate`), `get_offer_detail`,
   `get_payment_schedule`, and `evaluate_dbr` (`core/dbr.py`). Tool handlers
   validate inputs and return engine JSON only.
3. Guardrail update: the allowed-number set = initial context ∪ every tool
   result returned during the loop. Retry + flagged safe-fallback behavior
   unchanged (`guardrail_fallback: true` end-to-end).
4. Trace: each tool round appends a `TOOL_CALLED` event (existing machinery
   in `api/main.py` / `agents/events.py`) with tool name and round number —
   metadata only, never amounts in log lines.
5. Prompt caching: mark the system prompt and tool definitions with
   `cache_control` breakpoints; usage payload already tracks cache tokens —
   assert they flow through.
6. Tests (no API key needed): a scripted fake LLM client drives the loop —
   asserts tool dispatch, round cap, usage aggregation, guardrail over the
   union set, event recording, and the fallback path.

**Acceptance:** advisor answers what-if questions by calling `simulate_scenario`
itself; chat context payload shrinks (extend the existing payload-size
regression test); all guardrail tests green.

### 3B. LLM transaction categorizer (categories only, never amounts)

**Steps**

1. `core/profile.py`: add an optional `categorizer` callback parameter
   (injected by callers — `core/` itself imports nothing new). Heuristics
   remain the default and the fallback; the callback may only relabel the
   *category* of ambiguous descriptions, never amounts, dates, or decisions.
2. `agents/categorizer.py`: batch LLM categorization of ambiguous
   descriptions into the fixed category enum; strict JSON output parsing;
   on any error return no relabels (heuristics stand). Lazy imports.
3. `agents/orchestrator.py`: wire the categorizer when a key is configured;
   profile-agent events report counts of LLM-categorized transactions
   (`finding` events, Arabic).
4. Labeled dataset `db/categorizer_labels.json` (description → expected
   category, built from the three personas) + deterministic tests with a fake
   client; an accuracy comparison vs heuristics runs only when a key is
   present (skipped otherwise).

**Acceptance:** journey output is byte-identical when no key is configured;
with the fake client, relabeled categories flow into the profile while every
amount stays untouched (asserted).

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

1. **Golden-journey snapshots.** For each persona, run the in-process journey
   (as `tests/api/test_end_to_end.py` does) and snapshot the response payload
   minus volatile fields (`journey_id`, timestamps) into
   `tests/fixtures/golden/`. Any engine or payload change that alters demo
   output now fails loudly with a readable diff and requires a deliberate
   fixture update.
2. **CI overhaul** (`.github/workflows/ci.yml`):
   - backend job: unchanged, on the new `tests/` path;
   - mcp job: `pytest mcp_server/tests -q`;
   - frontend job: `lint`, `typecheck`, `test` (Vitest), `build`;
   - e2e job: boot mock OB + API in the background (no LLM key —
     journey/simulator/application specs only, chat spec skipped), then
     `npx playwright test`; upload the Playwright report on failure.
3. **Containerization.** One `Dockerfile` for the API and one for mock OB
   (slim Python base, non-root user); a `docker-compose.prod.yml` that runs
   db + both services for a one-command local prod-shape check.
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
| The swap breaks CI or local workflows | Grep gates for `frontend-v2`/`3001`/`core/tests`; tag before deleting; CI on a branch first |
| Tool-use loop weakens the guardrail | Allowed set is strictly context ∪ tool results; fallback path unchanged; fake-client tests cover the union logic |
| Public URL before rates are verified | noindex + permanent demo framing + honest `/status`; `ready_for_public_demo` stays the gate |
| LLM cost on a public endpoint | Prompt caching (3A.5), slim context, per-IP throttle, usage recorded per journey |
| Moves hide functional changes in diffs | Phases 1–2 contain **only** moves/renames/reference updates — no behavior changes mixed in |
