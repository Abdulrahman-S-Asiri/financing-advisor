# Fresh Frontend Rebuild

The former `frontend/` and `frontend-v3/` trees were intentionally removed
after an explicit deletion audit and owner approval. The replacement now lives
only in `frontend/` on port 3000.

## Completed steps

1. Audited and deleted both previous frontend trees.
2. Scaffolded Next.js 16, TypeScript, Tailwind v4, ESLint, Vitest, and Playwright.
3. Added Arabic-default RTL routing with English under `/en/*`.
4. Added ATHAR theme tokens, dark mode, shell, stage rail, and honesty badges.
5. Restored zod contracts, SSE parsing, formatters, and Zustand session state.
6. Built landing, journey, analysis, offers, decision, offer detail, docs,
   status, debt-payment, loading, error, and not-found surfaces.
7. Added message-parity, schema, SSE, formatter, honesty, and RTL audit tests.

## Required gates

```bash
cd frontend
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

Backend payload shapes remain frozen and are pinned by
`tests/fixtures/frontend_contract_keys.json`. Financial calculations remain in
`core/`; the browser only validates, stores, formats, and renders engine output.

## Remaining external verification

- Verify lender rates and retain `rate_verified:false` until sourced.
- Recheck SAMA wording against the current Arabic rulebook.
- Configure a live advisor provider only through environment variables.
