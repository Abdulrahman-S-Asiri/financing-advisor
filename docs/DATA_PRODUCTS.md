# Data Products

The moat phase starts with aggregate, consented outcome data. No data product
should expose raw transactions, raw persona IDs, or lender payloads.

## Implemented API Surface

`GET /analytics/overview` returns:

- Journey counts and path-forward rate.
- Match status counts.
- Top rejection reasons.
- Near-miss suggestion categories.
- Product gap counts by financing category.
- Application status counts.
- The first data products and their readiness status.

The current response is based on the API hot cache. Production analytics should
query a warehouse or read model built from persisted journey, trace, consent,
and application tables.

## Product 1: Offer Gap Insights

Question: Which lender or product constraints block otherwise viable
applicants?

Inputs:

- Match status counts.
- Rejection reasons.
- Near-miss suggestions.
- Offer category and institution.

Initial output:

- Top rejection reasons.
- Product gap by category.
- Actionable matches by institution.

## Product 2: Lender Conversion Funnel

Question: What happens after a customer selects an offer?

Inputs:

- Selected offer.
- Application status history.
- Lender or simulated final decision.

Initial output:

- Application counts by status.
- Simulated versus real submission counts.
- Per-lender conversion once real lender integrations exist.

## Product 3: Approval Likelihood Training Set

Question: Which profiles are likely to be approved by each lender?

Status: requires real outcomes.

Inputs:

- Consented, minimized profile features.
- Engine match trace.
- Actual lender decision.

Rules:

- Do not train on raw transactions.
- Keep feature definitions deterministic and versioned.
- Separate model training data from operational journey records.
- Track consent and deletion obligations for every record.
