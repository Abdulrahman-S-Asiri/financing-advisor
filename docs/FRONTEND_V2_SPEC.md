# أثر (Athar) — Frontend v2 Build Specification

A complete, from-scratch rebuild of the consumer website in `frontend-v2/`.
This document is the single source of truth for the build: follow the steps
**in order**, satisfy each step's acceptance criteria before moving on, and
never violate the ground rules.

---

## 0. Ground rules (non-negotiable — check every step against these)

1. **Arabic-first, fully RTL.** `<html lang="ar" dir="rtl">`. Every layout
   uses CSS **logical properties** (`margin-inline-start`, `padding-inline-end`,
   `inset-inline-start`, `text-align: start`) — never `left`/`right` physical
   properties except for genuinely direction-neutral cases. All user-facing
   strings are Arabic and live in one catalog file. English appears only as
   optional small technical accents (e.g. "APR").
2. **The frontend never computes money.** Every riyal, ratio, APR, and
   eligibility outcome is rendered from API responses. No client-side
   installment math, ever — not even for previews.
3. **Honesty is the brand.** Every surface that shows an offer must show its
   `rate_verified` status (badge `سعر غير مؤكد` when false, with tooltip).
   Simulated features (OTP, application submission) keep visible `محاكاة`
   labels. The advisor's guardrail fallback replies (`guardrail_fallback:
   true`) render visually distinct with the badge `رد آمن — تم حجب أرقام غير
   مدعومة`. No fake logos, testimonials, approval promises, or invented
   statistics anywhere.
4. **The backend contract is frozen.** Do not modify anything outside
   `frontend-v2/`. The API, its payload shapes, and the SSE framing are fixed
   (section 4). If something seems missing from the API, work around it in the
   client or leave a `TODO` note — do not touch backend code.
5. **`frontend/` (v1) is the live fallback — never edit it.** v2 is built in
   parallel in `frontend-v2/`, dev server on **port 3001**. v1 remains the
   behavioral reference: when this spec says "match v1 behavior", open the
   referenced v1 file and replicate its logic.
6. **Green at every step.** After each step: `npm run lint`, `npx tsc
   --noEmit`, and `npm run build` must pass, plus that step's verify commands.
   Never proceed with a broken tree. (Do not run `npm run build` while the dev
   server is running — they share `.next/`.)

## 1. What v1 is (reference) and what v2 must fix

v1 lives in `frontend/src/`. Its content, Arabic copy, and flows are good —
carry them. Its architecture is the ceiling v2 removes:

| # | v1 weakness | v2 requirement |
|---|---|---|
| 1 | Entire journey in one 662-line client component (`features/journey/JourneyApp.tsx`, 27 `useState`); state dies on any navigation (offer detail → back loses everything) | Zustand store + sessionStorage persistence; stage-per-route; journey survives navigation and reload |
| 2 | One 2,595-line `globals.css`, global BEM-ish classes | Tailwind CSS v4 utilities over a CSS-variable token system; no global class soup |
| 3 | Zero frontend tests | Vitest + Testing Library unit tests, Playwright E2E for the three demo personas |
| 4 | API payloads trusted blindly (TS types only) | zod schemas validate every response at runtime; typed API client module |
| 5 | No dark mode | Light + dark from day one via token variables |
| 6 | Text-only loading states | Skeleton components for every async surface |
| 7 | Offer detail route duplicates type definitions | One shared schema/types module |
| 8 | Strings scattered through components | Central `strings.ts` catalog (Arabic), imported everywhere |

Carry over unchanged (content, not code): all Arabic copy, the seeded persona
cards (أحمد حالة حدية / سارة ملف قوي / خالد رفض مفسر), the Double Diamond
stage narrative (اكتشف/حدد/طوّر/سلّم), the honesty strip and trust sections,
the docs/limitations page content, the debt-payment coming-soon page content,
and the أثر brand + teal palette.

## 2. Target stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router, TypeScript `strict: true` | Path alias `@/*` → `src/*` |
| Styling | Tailwind CSS v4 | Theme from CSS variables (section 3); RTL via logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) — auditable rule: the strings `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right` must not appear in the codebase |
| State | Zustand (journey store) with `persist` middleware → `sessionStorage` | One store; everything else stays local component state |
| Validation | zod | Schemas mirror the backend contract; parse at the fetch boundary |
| Motion | framer-motion | Purposeful only: agent timeline entrance, number count-ups, offer re-rank layout animation, stage transitions. Respect `prefers-reduced-motion` |
| Font | IBM Plex Sans Arabic via `next/font/google`, weights 400/500/600/700 | CSS variable `--font-plex`; system-font fallback stack |
| Unit tests | Vitest + @testing-library/react + @testing-library/jest-dom | jsdom environment |
| E2E | Playwright (chromium only) | Runs against local services |
| Numbers | `Intl.NumberFormat("ar-SA")` for currency and percents, in ONE module (`lib/format.ts`, port from v1 `features/journey/format.ts`) | Consistent Arabic-Indic numerals everywhere; `غير متاح` for null |

No other runtime dependencies without a written justification comment in
`package.json`.

## 3. Design system

### 3.1 Tokens (define as CSS variables in `globals.css`, map into Tailwind theme)

Light (carry v1 palette): `--background #f6f7f9`, `--surface #ffffff`,
`--surface-soft #eef6f4`, `--ink #18201e`, `--muted #64706d`, `--line #dbe3e0`,
`--brand #0e766e` (teal), `--brand-strong #075c55`, `--accent #2756a3` (blue),
`--ok #198754`, `--warn #b26b00`, `--danger #b42318`, shadow
`0 18px 45px rgba(24,32,30,0.08)`.

Dark: derive a full set (`--background #0f1513`-range, surfaces slightly
lighter, ink near-white, same hue family for brand/status with raised
lightness for contrast). Dark mode = `class` strategy (`<html class="dark">`),
toggle in the nav, persisted in `localStorage`, default follows
`prefers-color-scheme`.

Status colors are semantic and fixed: eligible=ok, conditional=warn,
ineligible=danger, policy_review=accent.

### 3.2 Component inventory (build in `src/components/ui/`)

`Button` (primary/secondary/ghost, loading state), `Badge` (status variants +
`warning` for unverified + `simulation`), `Card`, `MetricCard` (label +
count-up value), `Gauge` (ratio vs cap bar, breach state), `Skeleton` (text /
card / table variants), `EmptyState` (title, hint, optional action),
`ErrorState` (message + retry action), `Stepper` (journey stages + application
progress), `ChatBubble` (user/advisor/fallback variants), `SegmentedControl`
(filters/sort), `Tooltip` (title-attribute minimum; no library),
`SectionHeading` (eyebrow + h2 pattern from v1).

Every component: RTL-correct, both themes, keyboard-accessible.

## 4. Backend contract (frozen — copy, do not reinterpret)

### 4.1 Access

Next.js rewrite proxy, same as v1: `/backend/:path*` →
`${process.env.BACKEND_URL ?? "http://127.0.0.1:8000"}/:path*` in
`next.config.mjs`. All client fetches use relative `/backend/...` paths.

### 4.2 Endpoints used by the website

| Endpoint | Use |
|---|---|
| `POST /backend/journey/connect/stream` | Run journey — SSE stream (body: `persona_id`, `requested_amount`, `requested_tenor_months`, `age`, `nationality`) |
| `POST /backend/advisor/chat/stream` | Advisor chat — SSE deltas + `done` frame carrying `guardrail_fallback` |
| `POST /backend/advisor/tools/simulate` | What-if simulator (`journey_id`, optional `requested_amount`/`requested_tenor_months`, `salary_transfer`) |
| `GET /backend/advisor/tools/{journeyId}/offers/{offerId}` | Offer detail |
| `GET /backend/advisor/tools/{journeyId}/offers/{offerId}/payment-schedule` | Full schedule (detail route only) |
| `POST /backend/applications/draft` / `POST .../{id}/submit` / `POST .../{id}/advance` / `GET .../{id}` | Simulated application state machine |
| `GET /backend/healthz` | Status page: booleans/counts only |
| `GET /backend/offers/verification` | Status page: verification coverage (honest 0/8 today) |
| `GET /backend/integrations/open-banking/status` | Status page: provider + mock flag |
| `GET /backend/analytics/overview` | Status page: aggregate session activity |

Errors are `{"detail": "<string>"}` with 400/404/502/503. Special case: chat
503 = LLM provider unconfigured → show the Arabic guidance message (see v1
`JourneyApp.tsx` `submitChat`). Journey 503 includes the mock-service start
hint — surface `detail` verbatim.

### 4.3 Payload shapes — source of truth

Copy the TypeScript types from `frontend/src/features/journey/types.ts` into
`frontend-v2/src/lib/schemas.ts` as zod schemas (`JourneyResponse`,
`OfferMatch`, `AgentEvent`, `FinancialHealth`, `CostBreakdown`, `DbrDecision`,
`SimulationResponse`, `ApplicationRecord`, chat frames). The backend pins
these key sets in `core/tests/fixtures/frontend_contract_keys.json` — the zod
schemas must accept exactly those keys (unknown keys: `passthrough()`, missing
required keys: hard error). Nullables stay nullable (`monthly_installment`
etc. are null for ineligible matches).

### 4.4 SSE framing

Frames are `\n\n`-separated blocks with `event:`, `id:`, `retry:`, and `data:`
(JSON) lines. Port v1's parser (`frontend/src/features/journey/sse.ts`) and
the stream-consumption loops in v1 `JourneyApp.tsx` (`submitJourney`,
`submitChat`) **exactly** — buffering of partial frames included. Journey
stream: ~13 `AgentEvent` frames (profile → matching → cost agents), then the
completion frame whose handling v1 demonstrates; chat stream: text deltas then
a `done` frame with `guardrail_fallback`.

## 5. Route map and journey state machine

```
/                      Landing (server component)
/journey               Stage 1 — consent + persona + request form
/journey/analysis      Stage 2 — live agent timeline → financial dashboard
/journey/offers        Stage 3 — ranked offers, filters, compare, simulator
/journey/decision      Stage 4 — recommendation, application, advisor chat
/journeys/[journeyId]/offers/[offerId]   Offer detail (schedule lives here)
/debt-payment          Coming-soon page (carry v1 content, label ميزة قادمة)
/docs                  How it works + honest limitations
/status                Internal status dashboard
error.tsx, not-found.tsx                Arabic, with recovery links
```

**Store shape (Zustand, persisted to sessionStorage):** `journey`
(JourneyResponse | null), `liveEvents`, `journeyRequest` (persona/amount/
tenor/age), `simulation` (SimulationResponse | null), `filters` (status/
structure/sort/compare ids), `application` (ApplicationRecord | null),
`chatMessages`, plus actions (`runJourney`, `simulate`, `resetJourney`, …).

**Stage guards:** `/journey/analysis|offers|decision` redirect to `/journey`
when the store has no journey (and no run in progress). `?persona=<id>` on
`/journey` preselects a valid persona (validate against the three known ids).
Starting a new journey clears simulation/filters/application/chat.
**Acceptance for the whole section:** journey → offer detail → browser back →
filters, simulation, chat all intact; reload on `/journey/offers` keeps the
journey.

## 6. Step-by-step build plan

Execute in order. Each step lists Deliverables / Acceptance / Verify.

### Step 0 — Scaffold
Create `frontend-v2/` with create-next-app (TS, App Router, no src-dir
question — use `src/`), add Tailwind v4, zustand, zod, framer-motion, vitest,
@testing-library/react, playwright. Configure: port 3001 (`dev` script), the
`/backend` rewrite (4.1), `@/*` alias, strict TS, IBM Plex Sans Arabic,
`<html lang="ar" dir="rtl">`.
**Acceptance:** dev server renders an RTL placeholder page in the Plex font.
**Verify:** `npm run lint && npx tsc --noEmit && npm run build`.

### Step 1 — Tokens and theme
`globals.css` token blocks (light + dark, 3.1), Tailwind theme mapping, dark
class strategy, base typography.
**Acceptance:** a temporary `/dev-tokens` page shows all tokens in both themes
(delete this page in step 13).

### Step 2 — UI kit
Build the section-3.2 components with Vitest tests for `Badge` (all
variants), `Gauge` (cap/breach math is display-only), `Stepper`, `EmptyState`.
**Acceptance:** components render RTL in both themes; tests green.
**Verify:** `npm run test`.

### Step 3 — API layer
`src/lib/api.ts` (fetch wrapper: JSON, error `detail` extraction, zod parse),
`src/lib/schemas.ts` (4.3), `src/lib/sse.ts` (4.4 port), `src/lib/format.ts`
(port v1), `src/lib/strings.ts` (start the catalog).
**Acceptance:** unit tests parse recorded fixtures — capture one real journey
response from the running v1 backend (`POST /journey/connect` for
ahmed_borderline 80000/48) into `src/lib/__fixtures__/journey.json` and assert
the schema accepts it; assert a mutated payload (missing `matches`) rejects.

### Step 4 — Journey store
`src/stores/journey.ts` per section 5, including sessionStorage persistence
(persist only serializable state, not in-flight streams) and reset semantics.
**Acceptance:** store unit tests — run/reset/filter actions; persisted
rehydration.

### Step 5 — Site shell
`layout.tsx` (font, metadata template `%s | أثر`), `NavBar` (brand أثر, links
الرئيسية/الرحلة/سداد المديونية/كيف يعمل/الحالة, permanent `تجريبي` pill, theme
toggle, hamburger ≤760px), `Footer` (3 columns: description + demo
disclaimer, internal links, transparency line), `error.tsx`, `not-found.tsx`.
**Acceptance:** shell on every route, active-link state (treat `/journeys/*`
as الرحلة), mobile menu keyboard-operable.

### Step 6 — Landing
Port v1 sections with upgraded presentation: hero + honesty strip
(بيانات محاكاة · أسعار غير مؤكدة · ليس عرضاً تمويلياً), 4-step Double Diamond
cards, three trust cards (engine-not-model, rate transparency linking to
/status, explainability), persona cards linking `/journey?persona=<id>`,
final CTA. Motion: staggered section reveals, count-up on any numerals.
**Acceptance:** no fabricated claims; every CTA navigates; 375px clean.

### Step 7 — Stage 1: consent (`/journey`)
Persona selector, request form (amount 5,000–2,000,000 step 1,000; tenor 6–60
step 6; age 18–65) with inline Arabic validation messages, consent checkbox
(gate), submit → `runJourney` action → navigate to `/journey/analysis`.
**Acceptance:** invalid input blocks submit with proper messages; preselect
works; double-submit prevented.

### Step 8 — Stage 2: analysis (`/journey/analysis`)
The signature screen. While streaming: agent timeline items animate in per
SSE event (agent name Arabic labels, message_ar, event badges). On
completion: financial dashboard — metric cards (salary, computed income,
obligations, headroom — count-up), three DBR gauges vs caps with breach list,
profile facts (Arabic employment labels), detection notes.
**Acceptance:** with khalid_rejected the breach messages render; stream
interruption (kill API mid-run) shows ErrorState with retry; `aria-live` on
the timeline.

### Step 9 — Stage 3: offers (`/journey/offers`)
OfferCard grid (status badge, unverified badge + tooltip, installment/APR/
total, first reason/condition, near-miss line, detail link, compare toggle),
status + structure filters, sort control, compare panel (≤3, Arabic structure
labels), simulator panel (amount/tenor/salary-transfer → simulate → animated
re-rank via framer-motion layout), filtered-empty state with reset action.
**Acceptance:** simulator flip works for khalid (lower amount → statuses
change); compare shows تورق/مرابحة/إجارة; skeletons while simulating.

### Step 10 — Stage 4: decision (`/journey/decision`)
Recommendation card (or honest empty state when nothing actionable), next
steps linking /status, application tracker (choose offer → draft → submit →
advance ×2, Stepper + history timeline, `محاكاة` badge always visible),
advisor chat (streaming bubbles, suggested questions as tap-chips, fallback
badge rendering, 503 Arabic guidance, disabled state while streaming).
**Acceptance:** full ahmed flow works; fallback bubble style verifiable by
forcing `guardrail_fallback: true` in a mocked response test.

### Step 11 — Offer detail route
Server wrapper + client detail using shared schemas (no local type copies):
hero (status + badges + metrics), cost breakdown grid, DBR trace with
gauges, conditions/reasons/near-miss lists, full payment-schedule table
(sticky header, mobile horizontal scroll), source link + retrieved_at, back
link to `/journey/offers` (state survives — the v1 bug this build kills).
**Acceptance:** direct URL load works (fetches by journeyId/offerId); back
preserves filters.

### Step 12 — Docs, status, debt-payment
Port v1 content into v2 components. Status: 4 parallel fetches
(`Promise.allSettled`), per-card skeleton/error, server-down card with the
exact restart command, persona shortcut buttons, manual refresh. Docs: the
limitations section stays blunt. Debt-payment: coming-soon, no dead buttons —
the CTA links back to `/journey`.
**Acceptance:** status page honest with backend down AND up; 0/8 renders.

### Step 13 — Accessibility + responsive pass
Focus management on stage navigation, skip link, `htmlFor` on all inputs,
contrast check both themes, `prefers-reduced-motion` disables count-ups and
layout animation, 375px pass on every route. Delete `/dev-tokens`.
**Acceptance:** keyboard-only full journey possible.

### Step 14 — E2E + final verification
Playwright: three persona journeys (sara headroom 6,000 visible; khalid all-
rejected with near-miss; ahmed application to final status), offer-detail
round-trip state survival, status page. Then the full sweep.
**Verify:** `npm run lint && npx tsc --noEmit && npm run build && npm run
test && npx playwright test` — all green with backend + mock OB running.

## 7. Global definition of done

- [ ] All step acceptances met; full verify sweep green.
- [ ] No physical-direction utilities (grep rule in 2) — RTL audit passes.
- [ ] Unverified badge on every offer surface incl. compare, recommendation,
      detail, application chooser.
- [ ] Journey state survives: navigation, back button, reload.
- [ ] Both themes verified on every route; reduced-motion respected.
- [ ] All strings from `strings.ts`; no hardcoded English UI text.
- [ ] v1 untouched (`git status` shows changes only in `frontend-v2/` and this
      spec's checkboxes).
- [ ] The demo script (docs/DEMO_SCRIPT.md) is executable on v2 at :3001.

## 8. Risks and fallback

- **v1 is the demo fallback.** It stays runnable on :3000 until v2 passes the
  full definition of done plus one human demo rehearsal; only then swap
  (rename folders, update CI workflow's `working-directory`, re-point launch
  config) — the swap is a separate, explicit decision.
- **Contract drift**: if any zod schema rejects a real backend response, the
  schema is wrong, not the backend — fix the schema against
  `frontend_contract_keys.json`.
- **Scope creep**: no auth UI, no i18n framework, no English locale, no PWA,
  no new backend endpoints. Future work stays future.
