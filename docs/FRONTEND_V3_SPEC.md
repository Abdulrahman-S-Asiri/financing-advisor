# ATHAR Frontend v3 — Build Specification (Next.js + TypeScript + Tailwind + shadcn/ui + next-intl)

## Context

The current `frontend/` (the promoted v2 rebuild) is solid — Tailwind v4, Zustand, zod, 19 unit tests, Playwright E2E — but it is Arabic-only with a hand-made 13-component UI kit. v3 is a **fresh redesign** in a parallel folder that adds a professional component system (shadcn/ui) and true bilingual support (next-intl: Arabic default RTL + English secondary LTR), while porting the proven contract layer (api/schemas/sse/store) largely verbatim. This spec is self-contained for any implementing engineer and is the single source of truth for the build.

Execute steps **in order**; each step lands as one reviewable commit and fits a 30–60 min block. Steps marked **[OWNER]** require explicit approval before executing.

## Ground rules (restated at the top of the spec; every step is bound by these)

1. **The frontend never computes money.** Every riyal, ratio, APR, cap, and eligibility verdict is rendered verbatim from API responses parsed by zod schemas. No arithmetic on financial values beyond display formatting.
2. **Honesty surfaces are mandatory.** `rate_verified:false` → visible "سعر غير مؤكد / Unverified rate" badge on every offer surface (card, compare, detail, decision). Simulated features keep visible محاكاة labels. Advisor replies with `guardrail_fallback:true` render visually distinct.
3. **Arabic-first RTL.** CSS logical properties only (`ms-/me-/ps-/pe-/start-/end-/text-start/text-end`). Banned: `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` — enforced by an audit test (Step 20).
4. **Backend contract is frozen.** No backend changes. Errors are `{"detail": string}`. Journey + chat use SSE. Contract pinned by `core/tests/fixtures/frontend_contract_keys.json`.
5. **Isolation.** All work in `frontend-v3/` on port **3002**. `frontend/` (:3000), API (:8000), mock bank (:8100) untouched until the swap step [OWNER].
6. **No commits/pushes without owner approval.** Prepare the diff + message, wait.
7. Runtime deps limited to: next-intl, shadcn/ui deps (radix-ui, class-variance-authority, clsx, tailwind-merge, lucide-react), framer-motion, zustand, zod. Anything else needs a written justification.

## Design decisions (fixed — do not re-litigate during implementation)

- **D1 — next-intl routing:** `src/app/[locale]/` segment, `localePrefix: "as-needed"`, `defaultLocale: "ar"` — Arabic URLs stay identical to today (`/`, `/journey/...`) so deep links survive the final swap; English lives at `/en/*`. Middleware matcher **excludes `/backend/:path*`** (the SSE proxy must never be locale-rewritten), `/_next`, and files with extensions. `setRequestLocale` in layout + pages; typed messages via `IntlMessages` augmentation from `ar.json`.
- **D2 — shadcn/ui mapping:** init with the current CLI (Tailwind v4, CSS-variables mode). ATHAR palette → shadcn semantic tokens: `--primary` = navy `#0a1f44`, `--primary-foreground` = sand, `--accent` = gold `#c9a86a`, `--background` = sand `#faf7f2`, `--foreground` = ink `#111111`, `--card` = white, `--ring` = gold; dark theme = navy-family surfaces, sand foreground (mirror v2's `.dark` block). Radix `DirectionProvider dir={locale==="ar"?"rtl":"ltr"}` in providers. **shadcn replaces:** button, badge, card, skeleton, tooltip, tabs (replaces segmented-control), dialog, sheet, sonner, select, accordion, table, separator, alert, dropdown-menu. **Stay custom:** gauge (SVG), chat-bubble (user/advisor/guardrail-fallback variants), stepper, metric count-up, section-heading, empty/error states (thin wrappers).
- **D3 — Redesign direction:** sticky translucent top nav (logo, links, locale + theme switchers); journey pages get a **stage rail** (horizontal progress strip under the header). Centered `max-w-6xl` container, 12-col grid on `lg+`, mobile-first single column. Landing: full-bleed navy hero (Arabic display type, gold accent line), honesty strip as three pledge cards, 3-step how-it-works, persona shortcuts, CTA. Card language: white surface, 1px border, `rounded-xl`, generous padding; gold only for accents/active states, never large fills. Motion: framer-motion for count-ups, timeline stagger, page fades — all gated on `useReducedMotion`; numbers never re-animate after settling. Every async surface gets skeleton / error(+retry) / empty states.
- **D4 — Formatting:** keep a custom `lib/format.ts` refactored to `getFormatters(locale)` factory + `useFormatters()` hook. ar → `ar-SA` (Arabic-Indic numerals, byte-identical to v2 test expectations); en → `en-US` digits with SAR currency. Chosen over next-intl's `useFormatter` because the domain helpers (formatCap, formatNearMiss, gaugePercent) must also run outside React (store, tests).
- **D5 — Store/i18n boundary:** the v2 store imports `strings` directly — v3 store stores **error codes** (e.g. `"journey.runError"`) or the backend's raw `detail`; components resolve via `useTranslations`. The store stays locale-free.

## Phase 0 — Scaffold and tooling

**Step 1 — Scaffold `frontend-v3/`.** create-next-app (TS, App Router, Tailwind v4, ESLint, `src/`); port 3002 in `dev`/`start` scripts; strict tsconfig; copy v2's `/backend/:path*` rewrite (`BACKEND_URL ?? http://127.0.0.1:8000`) into `next.config.mjs`; scripts mirroring v2 (`lint --max-warnings=0`, `typecheck`, `test`, `e2e`); root `.gitignore` entries for `frontend-v3/` artifacts (`node_modules`, `.next`, `.env*`, `test-results`, `playwright-report`, `*.tsbuildinfo`).
*Acceptance:* default page on :3002 while :3000 untouched. *Verify:* `npm run lint && npm run typecheck && npm run build`.

**Step 2 — Test tooling.** Vitest + Testing Library + jsdom + `src/test/setup.ts` (port from `frontend/src/test/setup.ts`); Playwright config `baseURL: http://127.0.0.1:3002`, chromium, webServer auto-start; one smoke unit test + one smoke e2e.
*Verify:* full sweep (`lint && typecheck && test && build`), `npm run e2e` with backend running.

**Step 3 — shadcn/ui init.** `npx shadcn@latest init` (CSS variables); add: button, badge, card, skeleton, tooltip, tabs, dialog, sheet, sonner, select, accordion, table, separator, alert, dropdown-menu; `src/lib/utils.ts` (`cn`).
*Acceptance:* `components.json` present; scratch page (deleted before commit) renders Button/Card/Dialog cleanly. *Verify:* full sweep.

## Phase 1 — i18n and theme foundation

**Step 4 — next-intl wiring (D1).** `src/i18n/routing.ts` (`defineRouting({locales:["ar","en"], defaultLocale:"ar", localePrefix:"as-needed"})`), `src/i18n/request.ts` (`getRequestConfig`), `src/i18n/navigation.ts` (`createNavigation`); `src/middleware.ts` with the `/backend`-excluding matcher; `src/app/[locale]/layout.tsx` with `<html lang={locale} dir={locale==="ar"?"rtl":"ltr"}>`, `NextIntlClientProvider`, `setRequestLocale`, `generateStaticParams`; placeholder `messages/ar.json` + `messages/en.json`; `src/global.d.ts` augmenting `IntlMessages`.
*Acceptance:* `/` = Arabic RTL, `/en` = English LTR, `/journey` unprefixed resolves to ar, `/backend/healthz` proxies untouched. *Verify:* full sweep.

**Step 5 — Message catalogs.** Convert `frontend/src/lib/strings.ts` (423 lines) → `messages/ar.json` preserving key structure (common, nav, landing, journey, analysis, offers, decision, detail, docs, status, debtPayment, errors). Author `messages/en.json` as human-quality translation — **مرابحة/تورق/إجارة stay transliterated (Murabaha, Tawarruq, Ijara) with a one-line English gloss on first use per page**. Unit test asserting flattened key-set parity between the two files.
*Acceptance:* parity test green; en.json reads naturally (owner spot-check). *Verify:* full sweep.

**Step 6 — Theme tokens + fonts (D2).** `globals.css` maps ATHAR palette into shadcn tokens (light + dark via class strategy); `next/font`: IBM Plex Sans Arabic (body), Space Grotesk (display/English), IBM Plex Mono (data) as CSS variables in `@theme inline`; theme provider (class toggle, localStorage-persisted, system default, no-flash inline script — port v2 approach); Radix `DirectionProvider` in `src/app/providers.tsx`.
*Acceptance:* navy primary/gold accent in both themes; mono digits; RTL dropdown alignment correct. *Verify:* full sweep.

**Step 7 — Locale switcher + metadata.** `LocaleSwitcher` using `usePathname`/`useRouter` from `i18n/navigation` (preserves path incl. dynamic segments); per-locale `generateMetadata` + `alternates.languages` hreflang (`ar`, `en`, `x-default`); unit test for path preservation.
*Acceptance:* switching on `/journeys/abc/offers/xyz` round-trips to `/en/...` and back. *Verify:* full sweep.

## Phase 2 — Core libraries (port from v2)

**Step 8 — Contract layer.** Port verbatim (import paths only): `frontend/src/lib/schemas.ts` (14 zod schemas), `frontend/src/lib/sse.ts` (partial-frame buffering), `frontend/src/lib/api.ts` (11 endpoints + `ApiError`), plus their unit tests and `__fixtures__`.
*Acceptance:* all ported tests green; a test loads `core/tests/fixtures/frontend_contract_keys.json` and asserts schema key coverage (create if v2 lacks it). *Verify:* full sweep.

**Step 9 — Locale-aware format (D4).** `getFormatters(locale)` + `useFormatters()`; ar outputs byte-identical to v2 test expectations; en variants added; "not available" text passed in via translation, not imported.
*Acceptance:* both locales covered for every formatter incl. formatCap/gaugePercent/formatNearMiss edges. *Verify:* full sweep.

**Step 10 — Journey store (D5).** Port `frontend/src/stores/journey.ts` (journey, request, liveEvents, running, simulation, filters + compareIds≤3, application, selectedOfferId, chatMessages; sessionStorage persist of the serializable subset) with strings import removed — errors stored as `{code, detail?}`. Port store tests + add error-code tests.
*Acceptance:* store has zero i18n imports; all actions type-check against Step 8. *Verify:* full sweep.

## Phase 3 — Shell and shared components

**Step 11 — App shell (D3).** Sticky top nav, footer, container/grid primitives, `error.tsx` / `not-found.tsx` / `loading.tsx` under `[locale]/`; sonner Toaster mounted.
*Acceptance:* shell correct in ar-RTL and en-LTR; keyboard navigable. *Verify:* full sweep.

**Step 12 — Custom components.** `gauge.tsx` (SVG, RTL-safe), `chat-bubble.tsx` (user / advisor / **guardrail-fallback** variant: muted surface + icon + "رد احترازي / Safety fallback" label), `stepper.tsx`, `metric-count-up.tsx` (reduced-motion aware), `section-heading.tsx`, `empty-state.tsx`, `error-state.tsx`; **single-source honesty badges**: `UnverifiedRateBadge` and `SimulationBadge` (no inline duplicates anywhere later). Unit tests for gauge math and all three bubble variants.
*Verify:* full sweep.

**Step 13 — State-surface kit.** Per-surface skeletons (offer card, dashboard metric, timeline row, schedule table) on shadcn Skeleton; standardized error Alert + retry wired to `{detail}` with translated fallback.
*Verify:* full sweep.

## Phase 4 — Pages (one route per step; redesigned UI, v2 behavior parity)

**Step 14 — Landing `/`.** Hero, honesty strip, how-it-works, persona shortcuts, CTA → `/journey`. *Acceptance:* both locales, both themes, reduced-motion honored, 375px clean.
**Step 15 — `/journey`.** Consent gate + persona selector + request form (shadcn controls, inline validation). *Acceptance:* submit runs `runJourney` → navigates to analysis; double-submit prevented.
**Step 16 — `/journey/analysis`.** Live SSE agent timeline (staggered entrance, `aria-live`) → financial dashboard (gauges, count-ups); stage rail active. *Acceptance:* ahmed_borderline streams live then shows dashboard; killing the API mid-stream shows error + retry. *Verify:* full sweep + `npx playwright test -g "analysis"`.
**Step 17 — `/journey/offers`.** Offer cards (UnverifiedRateBadge where `rate_verified:false`), status/structure/sort filters, compare ≤3 (sheet/table), what-if simulator (SimulationBadge; results only from the simulate API). *Acceptance:* khalid_rejected shows explained rejection + simulator flip; compare max 3 enforced. *Verify:* + `-g "offers"`.
**Step 18 — `/journey/decision`.** Recommendation panel, simulated application tracker (stepper + SimulationBadge, draft/submit/advance via API), advisor chat (SSE streaming; fallback variant on `guardrail_fallback:true`; 503 → translated LLM-not-configured guidance). *Acceptance:* ahmed full flow works; fallback mapping unit-tested. *Verify:* + `-g "decision"`.
**Step 19 — Remaining routes.** `/journeys/[journeyId]/offers/[offerId]` (detail + full payment schedule table, mono digits, source link), `/debt-payment` (coming-soon), `/docs`, `/status` (4 parallel fetches, per-card skeleton/error, degrades gracefully when backend down). *Acceptance:* deep links work in both locales.

Each page step verifies with the full sweep.

## Phase 5 — Testing hardening

**Step 20 — RTL audit test.** Vitest test scanning `src/**/*.{ts,tsx,css}` for banned physical-direction patterns with an allowlist file (target: empty).
**Step 21 — i18n unit sweep.** `renderWithIntl(ui, {locale})` helper; key components rendered in **both** locales; ≥ v2's 19 tests (expect ~30+). Money values asserted from fixtures only, never from message files.
**Step 22 — Playwright persona suite.** Against live backend + mock bank: ahmed_borderline full flow (ar), sara_strong headroom (ar), khalid_rejected rejection + simulator flip (ar), sara_strong (en), theme-toggle assertions in one spec; **honesty assertions in every spec** (unverified badge, محاكاة labels). *Acceptance:* green twice consecutively. *Verify:* `npm run e2e`.

## Phase 6 — Docs and swap

**Step 23 — Docs.** `frontend-v3/README.md` (run on 3002, env vars, message-editing guide, component conventions); root `README.md` gets a short "v3 preview" note without changing existing instructions.
**Step 24 — [OWNER] Swap v3 → live.** Only after owner approval + a human demo rehearsal of the three personas on :3002 in both locales:
(a) `git tag frontend-v2-final` on current HEAD; (b) delete `frontend/` and `git mv frontend-v3 frontend` in one commit (v2 stays recoverable via tag — same pattern as the v1 retirement); (c) revert port to 3000 (scripts + Playwright baseURL/webServer); (d) confirm `.github/workflows/ci.yml` frontend job still matches (working-directory, cache path, lint/typecheck/test/build) — confirm, don't assume; (e) `.gitignore` cleanup; (f) root README instructions; (g) repo-wide grep for stale `frontend-v3` / `3002` refs — zero live hits.
*Verify:* full frontend sweep + `npm run e2e` on :3000 + backend `python -m pytest core/tests -q` (or `tests/` if already moved) — all green.

## Risks

| Risk | Mitigation |
|---|---|
| next-intl middleware intercepts `/backend/*` and breaks the SSE proxy | Matcher exclusion in Step 4; streaming e2e in Steps 16/22 catch regressions |
| shadcn CLI / React 19 / Tailwind v4 peer-dep drift | Components are vendored source — pin versions at Step 3 and move on |
| Locale switch mid-journey loses state | Store is locale-free (D5); switcher preserves path (Step 7); e2e asserts state survival |
| en.json mistranslates Islamic-finance terms | Transliteration rule in Step 5; owner review before merge; parity test prevents drift |
| ar-SA numerals differ between Node (tests) and browsers | Assert against `Intl` outputs computed in-test, not hardcoded literals |
| Swap misses a stale reference | Step 24(g) mandatory grep checklist |

## Files-to-create map — `frontend-v3/`

```
src/
  middleware.ts                     # next-intl, /backend excluded
  global.d.ts                       # IntlMessages augmentation
  i18n/{routing.ts, request.ts, navigation.ts}
  app/
    globals.css                     # shadcn tokens ← ATHAR palette, light+dark
    providers.tsx                   # DirectionProvider + theme + Toaster
    [locale]/
      layout.tsx page.tsx error.tsx not-found.tsx loading.tsx
      journey/{page.tsx, analysis/page.tsx, offers/page.tsx, decision/page.tsx}
      journeys/[journeyId]/offers/[offerId]/page.tsx
      debt-payment/page.tsx docs/page.tsx status/page.tsx
  components/
    ui/                             # shadcn-generated
    custom/{gauge, chat-bubble, stepper, metric-count-up, section-heading,
            empty-state, error-state, unverified-rate-badge, simulation-badge}
    site/{header, footer, locale-switcher, theme-toggle, stage-rail}
    journey/{page-level panels per Steps 15–18}
    skeletons/{offer-card, dashboard, timeline, schedule}
  lib/{api.ts, schemas.ts, sse.ts, format.ts, data.ts, utils.ts}
  stores/journey.ts
  test/{setup.ts, render-with-intl.tsx}
messages/{ar.json, en.json}
tests/e2e/{ahmed-borderline, sara-strong, khalid-rejected, english-locale}.spec.ts
```

## Verification (end-to-end)

1. Per step: `npm run lint && npm run typecheck && npm run test && npm run build` (fail = fix before proceeding).
2. Pages: run mock OB (`uvicorn mock_open_banking.main:app --port 8100`) + API (`uvicorn api.main:app --port 8000`) + `npm run dev` (:3002); walk the three personas manually in ar, sara in en.
3. Final: `npm run e2e` green twice; RTL audit test empty allowlist; message-parity test green; both themes on every route; the current `frontend/` on :3000 still runs untouched until Step 24.
