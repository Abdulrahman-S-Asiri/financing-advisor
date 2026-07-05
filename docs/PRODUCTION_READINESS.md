# Production Readiness

This document records the non-demo work needed before Financing Advisor can
handle real customers, real Open Banking data, or real lender submissions.

## Current Local Groundwork

- API auth contract exists through the simulated phone OTP endpoints:
  `POST /auth/otp/start`, `POST /auth/otp/verify`, and
  `GET /auth/session/{session_token}`.
- Open Banking access is isolated behind `api.open_banking.OpenBankingGateway`.
  The current provider remains the mock AIS service.
- Integration status is exposed through `GET /integrations/open-banking/status`.
- Application submission remains explicitly simulated.
- Outcome analytics are aggregate-only and exclude raw persona IDs and raw
  transactions.

## Production Auth Path

Target: Nafath or another approved identity provider.

Implementation checklist:

1. Replace the demo OTP store with a provider-backed identity adapter.
2. Persist sessions in Postgres or a dedicated session store with rotation and
   revocation.
3. Add auth middleware and protect journey, advisor, application, and analytics
   endpoints as appropriate.
4. Bind Open Banking consent records to verified user identity.
5. Add audit events for login, consent creation, consent revocation, and lender
   application actions.

The demo OTP flow must not be treated as production SMS or national identity
verification.

## Open Banking Path

Target: licensed TPP or direct participation through the Saudi Open Banking
ecosystem.

The official Open Banking portal describes the framework as covering use cases,
business rules, technical standards, and a lab for testing and conformance:
https://openbanking.sa/

Implementation checklist:

1. Add provider configuration for base URL, OAuth/client credentials, signing
   material, and consent redirect URLs.
2. Keep provider-specific payload handling inside `api.open_banking` and
   `core.profile.Txn.from_ais`.
3. Add contract tests using the Open Banking Lab or provider sandbox payloads.
4. Store consent ID, scopes, status, expiry, and revocation state.
5. Implement consent revocation and data minimization controls before real user
   data enters the system.

## Lender Submission Path

Target: lender lead-generation or application APIs after commercial agreements.

Implementation checklist:

1. Replace the simulated application state machine with lender-specific
   submission adapters.
2. Keep a common application status model so the frontend does not depend on
   individual lender APIs.
3. Store lender request IDs and response status without logging sensitive
   payloads.
4. Keep the simulated flow available only in development/demo environments.

## Compliance Readiness

Before launch, get Saudi legal and compliance review for:

- SAMA authorization category and Open Banking participation route.
- PDPL obligations for transaction data, profiling, consent, retention, and
  deletion.
- LLM data boundary: what leaves the platform, why, and under which processor
  terms.
- Customer disclosures for recommendations, rate verification, and simulated
  versus real application steps.

This file is an engineering checklist, not legal advice.
