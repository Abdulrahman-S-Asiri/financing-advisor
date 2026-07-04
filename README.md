# Financing Advisor — Amad Hackathon 2026 scaffold

An agentic financing advisor for the Saudi market: reads the customer's real
financial life through (mock) Open Banking AIS, matches it against a catalog
of financing offers, ranks them by true total cost across Islamic structures,
explains every decision — including rejections — and answers questions
through an advisor agent.

Core architecture rule, repeat it in the pitch: **LLMs orchestrate and
explain; code calculates.** Every riyal, ratio, and eligibility decision
comes from the deterministic engine in `core/`. The agent narrates engine
output and is forbidden from producing numbers not in its context.

## Quickstart

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Prove the engine before running anything:
pytest core/tests -q

# Terminal 1 — mock Open Banking (AIS) service
uvicorn mock_open_banking.main:app --port 8100

# Terminal 2 — platform API
# Optional persistence: docker compose up -d db
# DATABASE_URL=postgresql://amad:amad@127.0.0.1:5432/amad
uvicorn api.main:app --port 8000

# Terminal 3 — Double Diamond frontend
cd frontend
npm install
npm run dev

# The demo spine:
curl -X POST http://127.0.0.1:8000/journey/connect \
  -H 'Content-Type: application/json' \
  -d '{"persona_id":"ahmed_borderline","requested_amount":80000,"requested_tenor_months":48,"age":28}'
```

Interactive docs: http://127.0.0.1:8000/docs and http://127.0.0.1:8100/docs.
Frontend: http://127.0.0.1:3000.
Advisor chat (`POST /advisor/chat`) needs `ANTHROPIC_API_KEY` in `.env`
(copy `.env.example`). When using DeepSeek through the Anthropic-compatible
API, also set `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`.
Everything else runs without any key.

## Architecture

```
frontend/  ─────────  Arabic RTL Double Diamond app (:3000)
   |  Discover        persona + consent + financing request
   |  Define          extracted profile + affordability frame
   |  Develop         ranked offers + eligibility reasons
   |  Deliver         recommendation + optional advisor chat
   |
   v
api/  ──────────────  the platform API (:8000)
   |  POST /journey/connect   consent -> profile -> matches (demo spine)
   |  POST /advisor/chat      advisor agent over the journey result
   |  POST /advisor/chat/stream
   |  POST /advisor/tools/simulate
   |  GET  /advisor/tools/{journey_id}/offers/{offer_id}
   |  GET  /advisor/tools/{journey_id}/offers/{offer_id}/payment-schedule
   |  GET  /offers
   |
   ├──> mock_open_banking/ (:8100)  AIS-shaped service over seeded personas.
   |        Real service boundary on purpose: swapping in a licensed TPP
   |        later is a base-URL + auth change, not a rewrite.
   |
   ├──> core/               deterministic engine (pure stdlib, unit-tested)
   |        profile.py      transactions -> FinancialProfile
   |        dbr.py          SAMA Responsible Lending tiers (see table below)
   |        cost.py         flat-rate installments, APR via IRR, fees
   |        eligibility.py  rules engine + explainable rejections + ranking
   |
   └──> agents/             LLM layer (lazy — engine runs without it)
            advisor.py      narrates engine output, hard no-invented-numbers rule
            llm_client.py   Anthropic-compatible wrapper, endpoint/model from env
db/   seed_offers.json (JSON-first offers repo) + schema.sql (Postgres path)
```

Set `DATABASE_URL` to enable Postgres-backed journey snapshots, ordered agent
trace events, and application status history. Without it, the API keeps the
same in-memory hot path for local demos and CI.

## DBR rules encoded (verify before demo)

SAMA Responsible Lending Principles for Individual Customers, Quantitative
Principles (paras 15–18). English reference:
<https://rulebook.sama.gov.sa/en/responsible-lending-principles-individual-customers-0>
— the Arabic text governs; re-verify the consolidated current version and
sanity-check with Alinma mentors during enrichment.

| Total monthly income | Salary-linked cap (of gross salary) | Non-real-estate cap | Total cap |
|---|---|---|---|
| ≤ 15,000 | 33.33% employee / 25% retiree | 45% | 55% (65% if MoH/REDF beneficiary) |
| 15,000–25,000 | 33.33% / 25% | 45% | 65% |
| ≥ 25,000 | 33.33% / 25% | creditor policy | creditor policy |

Also encoded: consumer tenor ≤ 60 months (except real estate & credit
cards); other periodic income counts at **half** its verified average
(para 16.b); the engine reports `policy_review` for the ≥25k tier instead
of inventing a cap.

## Team lanes (3 people)

- **Person A — engine & agents** (`core/`, `agents/`): port the stock_agents
  orchestrator pattern, add the LLM transaction-categorizer hook in
  `core/profile.py`, keep tests green.
- **Person B — frontend**: consumes `POST /journey/connect` and
  `POST /advisor/chat`. The contract is the JSON in those responses; run the
  end-to-end test to see real payloads. Priority screens: consent simulation
  → results dashboard (ranked offers + reasons) → advisor chat. Arabic-first,
  RTL.
- **Person C — data & pitch**: replace every `rate_verified:false` offer
  with the institution's published pricing (fill `source_url` + retrieval
  date; target 15–25 offers); audit the six licensed aggregators' funnels
  for the differentiation slide; own the deck and demo script.

## Build order

- **Before July 5**: repo on GitHub, everyone runs the quickstart green.
- **Enrichment wk 1 (Jul 5–9)**: real offer data in; DBR rules validated
  with mentors; AIS field names aligned to the official SAMA spec (single
  adapter: `core/profile.Txn.from_ais` + `mock_open_banking/personas.py`).
- **Enrichment wk 2 (Jul 10–15)**: frontend consent→dashboard→chat flow;
  LLM categorizer; demo personas rehearsed. **Scope freeze July 15.**
- **Hackathon (Jul 16–18)**: Day 1 integration + Arabic polish; Day 2 UX +
  advisor prompt tuning + deck; Day 3 freeze at noon, rehearse the demo
  with all three personas (the rejected-with-reasons persona is the
  strongest beat), pitch.

## Honesty box — placeholders and deliberate gaps

- **All offer rates are placeholders** (`rate_verified:false`) until
  Person C replaces them with published pricing. The flag propagates to
  API responses so nothing fake can silently look real.
- **AIS field names** follow the common Open Banking envelope style, not
  yet the official SAMA spec — align during enrichment (one adapter).
- **Admin-fee cap** (1% / SAR 5,000 in seeds) — verify the current SAMA
  consumer-finance fee cap before the demo.
- **Persistence is optional**; set `DATABASE_URL` to persist journey snapshots,
  agent traces, and application status history to Postgres. Without it, local
  demo sessions remain in-memory.
- **No auth, no real Open Banking, no application submission, no SME
  module** — cut by design; they are roadmap slides, not hackathon scope.
- Salary/obligation detection is heuristic (documented in
  `core/profile.py`); the LLM categorizer hook is where ambiguous
  descriptions go, never amounts or decisions.
