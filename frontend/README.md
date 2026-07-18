# ATHAR Frontend

Bilingual Next.js frontend for the ATHAR financing-advisor demo. Arabic is the
default RTL experience; English routes use `/en/*`. Financial values and
eligibility decisions are validated from API responses and never calculated in
the browser.

## Run

```bash
npm install
npm run dev
```

The frontend runs on <http://127.0.0.1:3000> and proxies `/backend/*` to
`BACKEND_URL` (default `http://127.0.0.1:8000`). Start the mock Open Banking
service on port 8100 and the platform API on port 8000 for complete journeys.

## Verify

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

Playwright uses the production server. Set `PLAYWRIGHT_PORT` when port 3000 is
occupied and `BACKEND_URL` when testing against an alternate API port.

## Conventions

- Keep `messages/ar.json` and `messages/en.json` key-compatible.
- Use logical CSS direction properties so components work in RTL and LTR.
- Preserve unverified-rate, simulation, and guardrail-fallback labels.
- Update zod schemas and `tests/fixtures/frontend_contract_keys.json` together
  when an approved backend contract changes.
