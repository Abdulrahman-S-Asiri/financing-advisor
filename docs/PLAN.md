# ATHAR / أثر Financing Advisor — Execution Plan

This is the working execution plan for the project. It is written so that any
future engineering session can continue the work without other context: what
the product is, what exists, how it is verified, and what comes next.
Repository planning documents live under `docs/`; the root `README.md` is the
public entry point.

**The one non-negotiable engineering rule, repeated everywhere:**
*The model explains; the code calculates.* Every number — riyal, ratio, APR,
eligibility decision — comes from deterministic, unit-tested functions in
`core/`. The LLM never invents a profit rate, a ratio, or a decision, and a
number-fidelity guardrail enforces this on every advisor reply.

---

## 1. Product vision

ATHAR / أثر is the financing intelligence layer for Saudi Arabia — not a comparison table.
An agentic advisor that reads the customer's real financial life through Open
Banking, matches it against every offer in the market, prices offers honestly
(flat rate → effective APR), explains every decision in Arabic — including
rejections and the minimal change that would flip them — and eventually
applies on the customer's behalf. Explainability and honesty are the brand;
the consented outcome data is the long-term moat.

## 2. Final full-website scope

A complete consumer-facing website (Arabic-first, RTL), currently demo-grade:

- Public landing page with an honest value proposition and demo framing.
- Official ATHAR / أثر visual identity across the frontend: Midnight Navy,
  Dune Gold, Sand White, Ink, geometric decision-dot mark, and the approved
  Space Grotesk / IBM Plex Sans Arabic / IBM Plex Mono typography stack.
- The four-stage journey (consent → analysis → offers → decision) as the app.
- Offer detail views with full cost breakdown and payment schedule.
- A "how it works" page stating exactly what is computed vs narrated and the
  demo's limits.
- An internal status page: service health, offer-verification coverage,
  config booleans (never values), session activity, demo shortcuts.
- Error and not-found pages; shared navigation and footer with a permanent
  demo disclaimer.

## 3. Architecture

```
frontend/  Next.js App Router (:3000), ATHAR tokens, Tailwind v4, Arabic-first RTL
   |   /            landing (static)
   |   /journey     consent + persona/request form (?persona= preselect)
   |   /journey/analysis   live event timeline + financial dashboard
   |   /journey/offers     ranked offers + filters + compare + simulator
   |   /journey/decision   recommendation + simulated application + chat
   |   /journeys/[journeyId]/offers/[offerId]   offer detail
   |   /docs        honest architecture + limitations
   |   /status      internal status dashboard
   |   API access via Next rewrite proxy: /backend/* -> http://127.0.0.1:8000
   v
api/       FastAPI platform API (:8000) — see §6
   ├──> mock_open_banking/ (:8100)  AIS-shaped seeded service behind
   |        api/open_banking.OpenBankingGateway (licensed-TPP swap = base URL)
   ├──> core/    deterministic engine: profile, dbr, cost, eligibility,
   |             offer_verification, offers_catalog (validation gate)
   └──> agents/  orchestrator (Arabic events), advisor (guardrailed LLM),
                 application (simulated state machine), llm_client
db/        seed_offers.json (validated at load) + schema.sql (Postgres path)
mcp_server/ local MCP dev tooling (read-only; not part of the app runtime)
```

Dependencies point downward only (`api → agents → core`); `core/` is pure
stdlib with no I/O — callers read files and pass parsed payloads in.

## 4. User journeys

1. **Visitor → demo user:** landing → CTA or persona card →
   `/journey?persona=<id>` (form pre-seeded) → consent → live agent events →
   financial dashboard → ranked offers with reasons → simulator → advisor
   chat → simulated application with status timeline.
2. **Skeptical reviewer (judge/regulator):** landing trust section → `/docs`
   (who computes, who narrates, limitations) → offer detail eligibility trace
   → `/status` for the honest verification coverage.
3. **Operator/developer:** `/status` for health, catalog coverage, and config
   booleans; `/healthz` for probes; MCP tools for engine-level inspection.

## 5. Frontend pages

| Route | Type | Content / notes |
|---|---|---|
| `/` | static | Hero + honesty strip, 4-step how-it-works, 3 trust cards, persona cards → journey, CTA band |
| `/journey` | client | Consent, persona selector, and financing request form; `?persona=` seeds the form |
| `/journey/analysis` | client | Live Arabic event timeline and financial dashboard |
| `/journey/offers` | client | Ranked offers, filters, comparison, and simulator |
| `/journey/decision` | client | Recommendation, simulated application tracker, and advisor chat |
| `/journeys/[jid]/offers/[oid]` | client | Cost breakdown, DBR trace, month-by-month schedule, source link |
| `/docs` | static | Idea, engine-vs-narrator, data path, demo limitations, verification meaning |
| `/status` | client | healthz + offers/verification + OB status + analytics cards; persona shortcuts; refresh; server-down guidance |
| `error.tsx` / `not-found.tsx` | — | Arabic fallbacks with recovery links |

Site shell: `src/components/site/` (AtharLogo, NavBar with mobile menu + demo
pill, Footer with disclaimer). Journey state is persisted in session storage
so route changes, offer-detail round-trips, and reloads keep the active demo
state.

## 6. Backend APIs

All errors are `HTTPException` with string `detail`. No auth is enforced (demo
scope, by design — production auth is Nafath, see §14).

| Area | Endpoints |
|---|---|
| Health | `GET /healthz` — status, version, offers_loaded, catalog_valid, postgres_enabled, llm_configured, open_banking_provider (booleans/counts only) |
| Journey | `POST /journey/connect`, `POST /journey/connect/stream` (SSE agent events, final frame carries the journey payload) |
| Advisor | `POST /advisor/chat` (`reply`, `guardrail_fallback`, `guardrail_retries`), `POST /advisor/chat/stream` (deltas + `done` frame with the flag) |
| Advisor tools | `POST /advisor/tools/simulate`, `GET /advisor/tools/{jid}/offers/{oid}`, `GET .../payment-schedule` |
| Offers | `GET /offers`, `GET /offers/verification`, `GET /offers/review-checklist(.csv)` |
| Applications | `POST /applications/draft`, `GET /applications/{id}`, `POST /applications/{id}/submit`, `POST /applications/{id}/advance` |
| Auth (simulated) | `POST /auth/otp/start`, `POST /auth/otp/verify`, `GET /auth/session/{token}` |
| Analytics | `GET /analytics/overview` (aggregate-only, recent in-memory sessions) |
| Integrations | `GET /integrations/open-banking/status` |

## 7. Agentic AI flow

Five agents (profile, matching, cost, advisor, application) — thin
orchestration over deterministic tools, emitting ordered Arabic events
(`agent_started`, `tool_called`, `finding`, `agent_completed`) that the UI
renders live. The advisor is the only active LLM surface today:

- Context = engine outputs only (no raw transactions; PDPL minimization).
- **Number-fidelity guardrail:** every reply's numbers must exist in the
  engine context; percent forms match their decimal ratios (10.2% ↔ 0.102,
  tolerance 5e-5); violations trigger one retry, then a deterministic Arabic
  safe-fallback reply flagged `guardrail_fallback: true` end-to-end — the
  chat UI renders it as a marked amber bubble.
- Advisor tool-use loop: chat starts from a slim engine context, calls
  deterministic tools for simulations, offer detail, schedules, and DBR checks,
  records metadata-only tool traces, and uses Anthropic prompt caching where
  supported.
- Transaction categorizer: core callback seam, strict wrapper, seeded label
  dataset, orchestrator wiring, metadata-only events, and no-key regression
  tests are in place. It may return categories only, never amounts.

## 8. MCP integration (developer tooling)

`mcp_server/` hosts a local, read-only MCP (Model Context Protocol) stdio
server for development: run the deterministic journey in-process, price
financing, evaluate DBR scenarios, check offer-verification status, search
docs, inspect config as booleans, and run allowlisted checks. It shares the
engine and the catalog validation gate with the app but is never imported by
it. Charter: no shell, no writes, no secrets, no network. Editor/session
setup and the tool list live in `mcp_server/README.md` and (local-only)
`docs/MCP_AND_SKILLS.md`.

## 9. Database / storage plan

- **Hot path:** in-memory stores, LRU-bounded (`JOURNEY_STORE_MAX` /
  `APPLICATION_STORE_MAX`, default 500 each) so long-running demos cannot
  grow without limit. `/analytics/overview` therefore reflects retained
  (recent) sessions.
- **Optional Postgres** via `DATABASE_URL` (`db/schema.sql`): journeys,
  ordered agent events, application history persist; evicted entries reload
  transparently on access. CI runs with Postgres up.
- Offers stay JSON-first (`db/seed_offers.json`) behind `OffersRepo`; the
  Postgres offers table exists in the schema when worth switching.

## 10. Validation and guardrails

- **Offer catalog gate** (`core/offers_catalog.py`): required fields, types,
  enum membership, ranges (incl. the 4.9-vs-0.049 flat-rate unit trap),
  unknown-key and duplicate-id rejection. All problems reported at once; the
  API fails startup on an invalid catalog; MCP tools raise the same errors.
- **Input validation:** pydantic at the API edge; explicit range/choice
  validation in MCP tools.
- **Number-fidelity guardrail** with percent equivalence + structured
  fallback flag (§7).
- **Contract fixture** (`tests/fixtures/frontend_contract_keys.json`):
  backend payload keys are pinned against the frontend types; drift fails CI
  with named keys. Update fixture + `types.ts` together.
- `rate_verified:false` propagates to every surface; nothing placeholder can
  look real.

## 11. Testing strategy

- `python -m pytest tests -q` — engine math (hand-computed fixtures),
  guardrail (incl. percent + fallback), end-to-end journey over in-process
  ASGI (no ports, no API key), catalog gate, store eviction, healthz,
  contract, payload-size regressions. New API endpoint tests live in
  `tests/api/`; engine tests live in `tests/core/`; agent tests live in
  `tests/agents/`.
- `python -m pytest mcp_server/tests -q` — tool validation and allowlist.
- `cd frontend && npm run lint && npm run typecheck && npm run test && npm run build`
  — the frontend gate.
- `.\scripts\check.ps1` on Windows PowerShell, or `bash scripts/check.sh` on
  POSIX shells, runs the backend, MCP, and frontend gates in fail-fast order.
  Use `-IncludeE2E` / `--include-e2e` only when local services are already
  running.
- `.\scripts\dev.ps1` on Windows PowerShell, or `bash scripts/dev.sh` on
  POSIX shells, starts mock Open Banking, the API, and the frontend for local
  demos.
- Python dependencies are declared in `pyproject.toml`; local setup uses
  `pip install -e .[dev]`. The MCP server keeps its own requirements file.
- CI (GitHub Actions): backend tests with Postgres service, MCP tests,
  frontend lint/typecheck/unit/build, and a live-service Playwright job that
  starts mock Open Banking + the API before running browser E2E. Keep every
  phase green before moving on.

## 12. Security rules

- Never commit `.env`; never log or return secret values. `/healthz` and
  `/status` expose booleans/counts only (tested with planted canaries).
- LLM context carries engine outputs, never raw transactions (PDPL
  data-minimization by design).
- Simulated features (OTP, application submission, bank data) stay labeled
  simulated in API responses and UI copy — no exceptions.
- No arbitrary command execution anywhere; MCP subprocesses are a fixed-argv
  allowlist.
- Landing/docs copy must not promise approval, imply licensure, or hide the
  unverified-rates state.

## 13. Demo-readiness checklist

- [x] Full journey works end-to-end in the browser via `/journey` (verified).
- [x] Landing, docs, status, error/404 pages live with nav + footer.
- [x] Persona shortcuts pre-seed the journey form.
- [x] All checks green: backend tests, MCP tests, frontend lint, typecheck,
      unit tests, and build.
- [x] Guardrail fallback visibly marked in chat.
- [ ] **Offer rates verified from official lender pages (0/8 today)** — the
      one open external item; `/status` and `GET /offers/verification` track
      it (`ready_for_public_demo` stays false until then).
- [ ] SAMA DBR ratios + admin-fee cap re-verified against the current Arabic
      rulebook text with mentors.
- [ ] Demo rehearsed with all three personas (rejected-with-reasons persona
      is the strongest beat).

## 14. Implementation phases

| Status | Phase | Scope |
|---|---|---|
| ✅ | Engine + agents + API + mock OB | Deterministic core, journey pipeline + SSE, advisor guardrail, simulated applications, optional Postgres |
| ✅ | Platform hardening | Catalog validation gate, LRU-bounded stores, `/healthz`, backend↔frontend contract test, guardrail percent fix + fallback flag |
| ✅ | Full website | Landing + nav/footer + `/journey` move + persona preselect + `/docs` + `/status` + error/404 + Arabic webfont |
| ✅ | Frontend v2 promotion | Route-split journey, session storage persistence, zod response validation, UI tests, and Playwright smoke coverage promoted into `frontend/` |
| ✅ | Repository organization | Python packaging metadata, unified `tests/` tree, developer scripts, planning docs consolidated under `docs/`, env docs, and stale-reference cleanup |
| ⏳ | Data review (external) | Replace placeholder rates from official pages (target ≥15 offers), fill `source_url`/`retrieved_at`, flip `rate_verified` only with a real source |
| ⏳ | Regulatory verification (external) | Arabic rulebook check of DBR tiers, tenor cap, fee cap |
| ✅ | Advisor tool-use loop | LLM client loop, deterministic advisor handlers, guardrail union, metadata-only traces, prompt caching, and compact context regression tests |
| ✅ | Transaction categorizer | Core callback seam, strict wrapper, seeded labels, orchestrator wiring, fake-client tests, no-key regression, and optional live accuracy gate |
| ✅ | Golden-journey snapshots | Three demo persona payloads are locked under `tests/fixtures/golden/` with volatile fields stripped and raw transaction fields excluded |
| ✅ | CI quality gates | GitHub Actions runs backend, MCP, frontend, and live-service Playwright jobs with service logs uploaded on E2E failure |
| ✅ | Containerized backend services | API and mock Open Banking Dockerfiles plus `docker-compose.prod.yml` run Postgres, mock OB, and API with health checks and non-root containers |
| 🔜 | Production edges | Nafath identity, licensed TPP, lender submission, hosting — all external-partner work |

## 15. Priority table (next work, ranked)

| # | Task | Why | Size |
|---|---|---|---|
| 1 | Verified offers data pass | Unblocks public demo; everything else is ready | external, days |
| 2 | Structured logging + journey-scoped request IDs | Observability + audit trail | M |

## 16. Known risks

| Risk | State / mitigation |
|---|---|
| Placeholder rates leak into screenshots | `rate_verified` flag on every surface; `/status` shows honest 0/8; `ready_for_public_demo` gate |
| Journey state persistence can drift from backend contracts | zod schemas validate every response; Playwright covers offer-detail round-trip state survival |
| SAMA rules drift from the current Arabic text | Rules isolated in `core/dbr.py` with rulebook citations; external verification pending |
| Custom ATHAR fonts may not be installed on every machine | CSS declares the ATHAR font stack and falls back to system fonts; production builds no longer fetch fonts at build time |
| Analytics under LRU eviction shows recent-only activity | Documented on the endpoint and the status card label |
| Regulatory misstep at launch | Demo/simulation framing everywhere until licensed; legal consult before real users or referral revenue |

## 17. Done vs not done

**Done (code, verified):** deterministic engine with SAMA DBR tiers ·
flat→APR pricing + schedules · explainable matching + near-miss suggestions ·
journey orchestrator with Arabic SSE events · guardrailed advisor (percent
equivalence, retry, flagged safe fallback) · simulated OTP + application state
machine · optional Postgres persistence · LRU-bounded stores · offer catalog
validation gate · `/healthz` · backend↔frontend contract test · full website
(landing, route-split journey, persona preselect, docs, status, error/404,
nav/footer, Arabic webfont) · frontend unit tests and Playwright smoke
coverage · MCP dev tooling with tests · CI · containerized API/mock OB
backend stack.

**Not done (external / future):** verified offer rates (0/8 — the blocking
item for public demo) · SAMA text re-verification · real identity (Nafath),
licensed Open Banking, lender APIs · hosting/deployment · approval-likelihood
modeling (needs real consented outcomes).

### DBR rules encoded (verify before any public use)

SAMA Responsible Lending Principles for Individual Customers, Quantitative
Principles (paras 15–18); the Arabic text governs:

| Total monthly income | Salary-linked cap (of gross salary) | Non-real-estate cap | Total cap |
|---|---|---|---|
| ≤ 15,000 | 33.33% employee / 25% retiree | 45% | 55% (65% if MoH/REDF beneficiary) |
| 15,000–25,000 | 33.33% / 25% | 45% | 65% |
| ≥ 25,000 | 33.33% / 25% | creditor policy | creditor policy |

Also encoded: consumer tenor ≤ 60 months (except real estate & credit cards);
other periodic income counts at **half** its verified average (para 16.b);
the ≥25k tier reports `policy_review` instead of inventing a cap. Admin-fee
cap (1% / SAR 5,000 in seeds) needs verification against the current consumer
finance regulations.

### Explicit non-goals

No SME module, credit cards, or BNPL origination. No investment or trading
features (separate CMA licensing world). No bank-partner portal until the
consumer product is flagship-grade.

### Cost posture (bootstrapped)

Free tiers throughout when hosting starts (Vercel + Neon/Supabase + small VM);
nothing should exceed ~SAR 0–50/month besides LLM usage. The deterministic
engine keeps token spend low; per-journey token usage is recorded in the
trace events.
