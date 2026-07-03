# Financing Advisor — Full Product Plan

**From hackathon scaffold to the financing intelligence layer for Saudi Arabia.**

> The one-line pitch: not a comparison table — an agentic advisor that does the
> work for you, step by step. It reads your real financial life, matches you
> against every offer in the market, prices them honestly, explains every
> decision in Arabic, and (eventually) applies on your behalf.

**Engineering principle (non-negotiable, repeated everywhere):**
*The model explains; the code calculates.* Every number comes from
deterministic, unit-tested functions. The LLM never invents a profit rate,
a ratio, or an eligibility decision.

---

## 1. Where the project stands today (confirmed)

| Layer | State |
|---|---|
| `core/` engine | Done and tested — profile extraction, SAMA DBR tiers, flat-rate → APR cost engine, explainable eligibility + ranking |
| `mock_open_banking/` | Done — AIS-shaped service, 3 seeded personas |
| `agents/` | **Only 1 of 5 agents exists** (Advisor chat). Others are comments, not code |
| `api/` | One demo endpoint (`/journey/connect`) + chat. In-memory sessions, no auth |
| `frontend/` | Single-page Arabic RTL Double Diamond flow, functional but demo-grade. Plain CSS, no component library yet |
| Offers data | Placeholder rates (`rate_verified: false`) |

**Assumed (verify before building):** SAMA DBR ratios against current Arabic
rulebook text; admin-fee cap; official SAMA AIS field names.

---

## 2. The Agent Layer (Phase 1 — the core of the product)

Five named agents, matching the concept deck. Each agent is a thin LLM
orchestration wrapper around deterministic tools. Agents emit **structured
events** (`agent_started`, `tool_called`, `finding`, `agent_completed`) so the
UI can show them working live — this visibility *is* the product experience.

### 2.1 وكيل الملف المالي — Financial Profile Agent

Analyzes account transactions: income, salary stability, obligations, DBR.

- **Deterministic base (exists):** `core/profile.extract_profile` — salary
  detection, obligations, income haircut.
- **New LLM capability:** the transaction **categorizer hook** already
  designed into `core/profile.py`. Ambiguous descriptions (unlabeled
  recurring debits, unusual credits) go to the LLM which returns a
  *category only* — never an amount, never a decision.
- **New deterministic capability:** salary-stability score (variance across
  observed months), obligation trend (rising/falling), months-observed
  confidence level.
- **Output:** `FinancialProfile` + `profile_narrative` (Arabic summary of
  what was found and how confident the detection is).

### 2.2 وكيل المطابقة — Matching Agent

Runs the profile against every offer's eligibility conditions: DBR caps,
salary transfer, minimum salary, tenor, age, nationality.

- **Deterministic base (exists):** `core/eligibility.match_offer` +
  `rank_matches`.
- **Agent's job:** orchestrate the per-offer tool calls, group outcomes
  (eligible / conditional / policy-review / ineligible), and produce the
  **near-miss analysis**: for each rejection, compute the minimal change
  that flips it (lower amount, shorter tenor, salary transfer) by
  re-calling the engine with adjusted inputs — deterministic search, LLM
  narrates the result.
- **Output:** ranked matches + per-offer eligibility trace + near-miss
  suggestions ("this offer becomes available at SAR 65,000 instead of 80,000").

### 2.3 وكيل التكلفة — Cost Agent

Computes the true total cost of every offer with an APR equivalent — so
murabaha and tawarruq become comparable numbers.

- **Deterministic base (exists):** `core/cost.price_offer` (flat → installment,
  admin fee, IRR-based APR).
- **New deterministic capabilities:**
  - Full payment schedule per offer (month-by-month table).
  - Early-settlement estimate (per SAMA early-settlement rules — verify).
  - Pairwise savings: "cheapest offer saves you SAR X vs. the next one over
    the full tenor."
- **Output:** cost breakdowns + savings deltas, all engine-computed; agent
  narrates the comparison in Arabic.

### 2.4 وكيل المستشار — Advisor Agent (exists — extend)

Explains the ranking in Arabic and answers: "Why didn't offer X match me?"
and "What changes if I transfer my salary?"

- **Exists:** context-grounded chat with the hard no-invented-numbers rule.
- **Extend:**
  - **Tool use instead of context stuffing:** give the advisor tools —
    `simulate(amount, tenor, salary_transfer)` re-runs the engine;
    `get_offer_detail(id)`, `get_payment_schedule(id)`. What-if answers
    become engine-computed, not narrated guesses.
  - **Streaming responses** for the chat UI.
  - **Suggested questions** generated from the actual journey result (a
    rejected user sees "what can I change to qualify?").

### 2.5 وكيل التقديم — Application Agent (mocked now, real later)

Submits the financing application on your behalf and tracks its status.

- **Now (mock):** a deterministic state machine —
  `draft → submitted → under_review → approved/declined` — with realistic
  seeded timing, persisted per session. Agent prepares an "application
  summary" from the profile + chosen offer and walks the user through
  confirmation. **Clearly labeled simulation in the UI.**
- **Later (real):** integration with lender onboarding APIs / lead-gen
  agreements. This is a business-development milestone as much as a
  technical one.

### 2.6 The Orchestrator (new — ties the five together)

- A journey orchestrator that runs Profile → Matching → Cost as a pipeline,
  streams agent events to the frontend (SSE on FastAPI), and hands the
  assembled context to the Advisor and Application agents on demand.
- Keep it in-house and small (the existing `llm_client.py` pattern +
  Anthropic tool-use loop). No heavyweight agent framework — the
  deterministic engine is the framework.

### 2.7 Agent guardrails (important — judges and regulators will probe this)

- **Number-fidelity checker:** post-process every advisor reply — extract all
  numerals, assert each appears in the engine context. Violations are
  logged and the reply is regenerated. This turns the pitch line into an
  enforced invariant.
- **Agent trace log:** every tool call and its inputs/outputs persisted per
  journey — the audit trail a licensed platform would need anyway.

---

## 3. Platform hardening (Phase 2)

What must change under the hood to carry the product beyond the demo:

1. **Persistence:** move sessions + journeys + traces from in-memory dicts to
   Postgres (`db/schema.sql` already sketches the path). Local: docker-compose
   (exists). Hosted: Neon or Supabase free tier — SAR 0/month to start.
2. **Offers data pipeline:** an offers repo with `rate_verified`, `source_url`,
   `retrieved_at` as first-class citizens; a review checklist for updating
   published rates; target 15–25 verified offers across personal / auto /
   real-estate. Unverified rates stay visibly flagged end-to-end.
3. **AIS spec alignment:** adapt `Txn.from_ais` + mock service to the official
   SAMA Open Banking AIS field names (single-adapter change by design).
4. **Auth (real product):** Nafath is the Saudi-native identity path;
   phone-OTP as interim. Not needed for demo.
5. **Config & environments:** `.env`-driven everything (already the pattern);
   split dev/prod settings; never commit secrets.
6. **Testing:** keep `core/` at high coverage; add API contract tests for the
   streaming events; add the number-fidelity guardrail test with recorded LLM
   fixtures (no live key needed in CI).

---

## 4. The Flagship Consumer Interface (Phase 3 — "massive UI")

One consumer app, Arabic-first RTL, English secondary. The design goal:
**a national-champion fintech look** — closer to a premium banking app than a
hackathon dashboard. Next.js App Router (existing); component library built
in-house, adopting Tailwind for tokens/utility styling (new dependency —
the current frontend is plain CSS). No template kits — avoids the generic look.

### 4.1 Design system first

- **Typography:** IBM Plex Sans Arabic (free, excellent Arabic+Latin pairing).
- **Design tokens:** color scale (deep navy + warm sand + signal colors for
  eligible/conditional/rejected), spacing scale, radius scale, elevation.
- **Dark mode** from day one (tokens make it cheap).
- **Motion language:** agents "working" deserve purposeful motion — progress
  choreography, streaming text, count-up numbers. Subtle, not gimmicky.
- **RTL as the default**, LTR as the mirror — not the other way around.
- **Number formatting:** SAR everywhere via `Intl.NumberFormat("ar-SA")`
  (already started in the current page).

### 4.2 Screens

1. **Journey start / consent** — bank selection, consent simulation framed
   exactly like a real Open Banking consent screen (scopes, duration,
   revocability). Trust is the theme.
2. **Agents-at-work (the signature screen)** — a live timeline: each of the
   three pipeline agents lights up, shows its tool calls and findings as
   streamed events, hands off to the next. This is the demo moment and the
   brand moment; nobody in the market shows their work like this.
3. **Financial health dashboard** — detected salary + confidence, obligations
   breakdown, DBR gauges against the user's SAMA tier caps, affordable-
   installment headroom, detection notes surfaced honestly.
4. **Offers marketplace** — ranked cards with status badges (مؤهل / مشروط /
   مراجعة سياسة / غير مؤهل), structure badges (تورق / مرابحة / إجارة), APR and
   total-payable front and center, filters + sort, side-by-side compare (up
   to 3), the near-miss hints on rejected cards.
5. **Offer detail** — full cost breakdown, month-by-month payment schedule,
   the complete eligibility trace ("passed 6 of 7 checks — here's the one
   that failed"), rate-verification badge with source link.
6. **What-if simulator** — sliders for amount / tenor, toggle for salary
   transfer; every movement re-runs the real engine and animates the offer
   grid re-ranking. The advisor can be summoned in context.
7. **Advisor chat** — streaming, contextual, with generated suggested
   questions; renders engine numbers as tappable chips that deep-link to the
   relevant offer or dashboard element.
8. **Application flow + tracker** — choose offer → agent-prepared summary →
   confirm → status timeline (simulated, labeled as such).
9. **Empty / error / loading states** for every screen — a giant-company UI
   is defined by its edges, not its happy path.

### 4.3 Frontend architecture

- Restructure from single `page.tsx` to App Router routes per screen with a
  shared journey store (React context or Zustand — decide at build time,
  bias to the simplest that works).
- SSE client for agent events; optimistic UI for simulator interactions.
- Responsive: phone-first (this is a consumer product in a mobile-first
  market), desktop as the enhanced layout.

---

## 5. Trust, compliance, and the moat (Phase 4 + ongoing)

These are what make it a company rather than a demo:

- **Regulatory reality (flag early):** operating a real financing
  aggregation/brokerage platform in KSA requires SAMA authorization (finance
  broker / open-banking TPP licensing as applicable). Open Banking data
  access in production goes through a licensed TPP. Build the demo freely;
  budget the licensing conversation into any go-to-market step.
- **PDPL (Saudi data protection):** transaction data is highly sensitive.
  Data-minimization by design: the LLM sees categories and engine outputs,
  not raw statements, wherever possible; document what crosses the API
  boundary to the model provider.
- **Explainability as the brand:** the eligibility trace, the rejection
  reasons, the near-miss suggestions, the rate-verification badges — this
  transparency is the differentiator against every aggregator that just
  shows a sorted table.
- **The data moat (long-term):** anonymized, consented journey outcomes →
  the best dataset in the market on what real applicants qualify for.
  Roadmap: approval-likelihood modeling, offer-gap analytics for lenders.

### Explicit non-goals (for now)

- No SME module, no credit cards, no BNPL origination.
- No investment or trading features (separate CMA licensing world — keep out).
- No bank-partner portal or admin back-office (revisit after the consumer
  app is flagship-grade).

---

## 6. Build phases and order

| Phase | Scope | Exit criteria |
|---|---|---|
| **1 — Agent layer** | Orchestrator + 5 agents + SSE events + guardrails | Full pipeline streams events; near-miss analysis works; number-fidelity check enforced; tests green |
| **2 — Platform hardening** | Postgres persistence, offers pipeline, AIS alignment, contract tests | Journeys survive restart; 15+ verified offers; CI runs without an API key |
| **3 — Flagship UI** | Design system + all 9 screens, phone-first RTL | Full journey (consent → agents-at-work → dashboard → offers → simulator → chat → application) polished on mobile and desktop |
| **4 — Real-world edges** | Nafath/OTP auth, TPP integration groundwork, licensing prep | Production architecture documented; auth working; TPP swap validated against the adapter seam |
| **5 — Moat** | Outcome analytics, approval-likelihood modeling, lender-side insights | First data products specified |

Phases 1 → 3 are sequenced so that **each phase is independently demoable**.
(If a hackathon-shaped deadline appears, Phase 1 + a vertical slice of
Phase 3's screens 2, 4, and 7 is the winning cut.)

### Cost posture (bootstrapped)

- Hosting: free tiers throughout (Vercel for frontend, Neon/Supabase for
  Postgres, single small VM or Railway for the API if needed). Nothing in
  Phases 1–3 should exceed ~SAR 0–50/month besides LLM usage.
- LLM: usage-based; the deterministic engine keeps token spend low (agents
  narrate, they don't compute). Add per-journey token accounting in the
  trace log from day one.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| DBR rules drift from current SAMA text | Verify against Arabic rulebook + mentor review before any public demo; rules live in one module (`core/dbr.py`) |
| Placeholder rates leak into screenshots | `rate_verified` flag rendered on every surface, no exceptions |
| Agent theatrics without substance | Every event in the agents-at-work screen maps to a real tool call — no fake progress |
| LLM latency makes the pipeline feel slow | Profile/Matching/Cost are deterministic-first; LLM narration streams in parallel, never blocks the numbers |
| Regulatory misstep at launch | Demo/simulation framing until licensed; legal consult before any real user data or lender referral revenue |

---

## 8. Immediate next steps

1. Approve or amend this plan.
2. Phase 1, step 1: define the agent event schema + SSE endpoint contract
   (frontend and backend build against it in parallel).
3. Phase 1, step 2: implement the orchestrator and refit the existing
   Advisor agent into it; then Profile categorizer, Matching near-miss,
   Cost schedules, Application state machine — one agent per PR.
