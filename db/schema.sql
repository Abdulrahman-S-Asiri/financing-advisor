-- Financing Advisor schema (Postgres 16).
-- The hackathon path is JSON-first (see api/main.py OffersRepo). This schema
-- is the drop-in persistence layer when you need history, multi-user
-- sessions, or the forward-evaluation log. docker-compose.yml provides the DB.

CREATE TABLE IF NOT EXISTS offers (
    id                       TEXT PRIMARY KEY,
    institution              TEXT NOT NULL,
    product_name             TEXT NOT NULL,
    category                 TEXT NOT NULL CHECK (category IN ('personal','auto','real_estate')),
    structure                TEXT NOT NULL CHECK (structure IN ('tawarruq','murabaha','ijarah')),
    flat_rate_annual         NUMERIC(6,4) NOT NULL,
    admin_fee_pct            NUMERIC(6,4) NOT NULL,
    admin_fee_cap_sar        NUMERIC(12,2) NOT NULL,
    min_amount               NUMERIC(12,2) NOT NULL,
    max_amount               NUMERIC(12,2) NOT NULL,
    min_tenor_months         INT NOT NULL,
    max_tenor_months         INT NOT NULL,
    min_gross_salary         NUMERIC(12,2) NOT NULL,
    salary_transfer_required BOOLEAN NOT NULL,
    eligible_employment      TEXT[] NOT NULL,
    nationality              TEXT NOT NULL,
    max_age_at_maturity      INT NOT NULL,
    rate_verified            BOOLEAN NOT NULL DEFAULT FALSE,
    source_url               TEXT,
    retrieved_at             TIMESTAMPTZ,          -- when the rate was verified
    notes                    TEXT
);

CREATE TABLE IF NOT EXISTS consents (
    consent_id   UUID PRIMARY KEY,
    persona_id   TEXT NOT NULL,
    status       TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journeys (
    journey_id                       UUID PRIMARY KEY,
    persona_id                       TEXT NOT NULL,
    requested_amount                 NUMERIC(12,2) NOT NULL,
    requested_tenor_months           INT NOT NULL,
    profile                          JSONB NOT NULL,
    matches                          JSONB NOT NULL,
    max_affordable_new_installment   NUMERIC(12,2) NOT NULL,
    suggested_questions              JSONB NOT NULL DEFAULT '[]',
    created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_events (
    journey_id   UUID NOT NULL REFERENCES journeys(journey_id) ON DELETE CASCADE,
    sequence     INT NOT NULL,
    type         TEXT NOT NULL,
    agent        TEXT,
    message_ar   TEXT NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (journey_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_journeys_persona_updated
    ON journeys(persona_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_journey_sequence
    ON agent_events(journey_id, sequence);

CREATE TABLE IF NOT EXISTS applications (
    application_id UUID PRIMARY KEY,
    journey_id     UUID NOT NULL REFERENCES journeys(journey_id) ON DELETE CASCADE,
    offer_id       TEXT NOT NULL,
    status         TEXT NOT NULL CHECK (
        status IN ('draft','submitted','under_review','approved','declined')
    ),
    summary        JSONB NOT NULL,
    history        JSONB NOT NULL DEFAULT '[]',
    simulation     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL,
    updated_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_journey
    ON applications(journey_id);
CREATE INDEX IF NOT EXISTS idx_applications_status
    ON applications(status);

CREATE TABLE IF NOT EXISTS profiles (
    id                          BIGSERIAL PRIMARY KEY,
    persona_id                  TEXT NOT NULL,
    gross_salary                NUMERIC(12,2) NOT NULL,
    other_monthly_income_avg    NUMERIC(12,2) NOT NULL DEFAULT 0,
    employment_type             TEXT NOT NULL,
    is_retiree                  BOOLEAN NOT NULL DEFAULT FALSE,
    salary_linked_obligations   NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_obligations           NUMERIC(12,2) NOT NULL DEFAULT 0,
    real_estate_obligations     NUMERIC(12,2) NOT NULL DEFAULT 0,
    salary_bank                 TEXT,
    months_observed             INT NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every match decision is logged: this is the audit trail / explainability
-- story, and later the forward-evaluation dataset (did approved users take
-- the top-ranked offer?).
CREATE TABLE IF NOT EXISTS match_decisions (
    id                     BIGSERIAL PRIMARY KEY,
    profile_id             BIGINT NOT NULL REFERENCES profiles(id),
    offer_id               TEXT NOT NULL REFERENCES offers(id),
    requested_amount       NUMERIC(12,2) NOT NULL,
    requested_tenor_months INT NOT NULL,
    status                 TEXT NOT NULL,
    monthly_installment    NUMERIC(12,2),
    apr_effective          NUMERIC(7,4),
    total_amount_payable   NUMERIC(14,2),
    reasons                JSONB NOT NULL DEFAULT '[]',
    conditions             JSONB NOT NULL DEFAULT '[]',
    dbr                    JSONB,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_profile ON match_decisions(profile_id);
CREATE INDEX IF NOT EXISTS idx_offers_category ON offers(category);
