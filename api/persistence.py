"""Journey persistence with an in-memory hot path and optional Postgres backing.

The in-memory maps are LRU-bounded (JOURNEY_STORE_MAX / APPLICATION_STORE_MAX,
default 500 each) so a long-running server cannot grow without limit. With
Postgres configured, evicted entries transparently reload on access; without
it, evicted entries are gone — acceptable for demo sessions. Consequence:
/analytics/overview aggregates only the retained (recent) entries.
"""
from __future__ import annotations

import logging
import os
from collections import OrderedDict
from decimal import Decimal
from typing import Any

from agents import application as application_agent
from agents.events import AgentEvent, AgentEventType, AgentName
from agents.orchestrator import JourneyResult
from core import dbr
from core.eligibility import match_offer, rank_matches
from core.models import EmploymentType, FinancialProfile, Offer

logger = logging.getLogger(__name__)

DEFAULT_STORE_MAX = 500


def _env_int(name: str, default: int) -> int:
    # Local copy of the api.main helper: this module must stay importable
    # without pulling in the FastAPI app.
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


def _touch(entries: OrderedDict, key: str) -> None:
    """Mark a key most-recently-used."""
    entries.move_to_end(key)


def _insert_bounded(entries: OrderedDict, key: str, value: Any, cap: int) -> None:
    """Insert as most-recently-used and evict the oldest entries past cap."""
    entries[key] = value
    entries.move_to_end(key)
    while len(entries) > cap:
        entries.popitem(last=False)


def _as_float(value: Any) -> float:
    if isinstance(value, Decimal):
        return float(value)
    return value


def _profile_from_payload(payload: dict[str, Any]) -> FinancialProfile:
    data = dict(payload)
    data.pop("total_monthly_income", None)
    data["employment_type"] = EmploymentType(data["employment_type"])
    return FinancialProfile(**data)


def _event_from_payload(payload: dict[str, Any]) -> AgentEvent:
    created_at = payload["created_at"]
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()
    agent = payload.get("agent")
    return AgentEvent(
        journey_id=str(payload["journey_id"]),
        sequence=int(payload["sequence"]),
        type=AgentEventType(payload["type"]),
        agent=AgentName(agent) if agent else None,
        message_ar=payload["message_ar"],
        payload=payload.get("payload") or {},
        created_at=created_at,
    )


def _datetime_value(value: Any) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _application_from_payload(payload: dict[str, Any]) -> application_agent.ApplicationRecord:
    return application_agent.ApplicationRecord(
        application_id=str(payload["application_id"]),
        journey_id=str(payload["journey_id"]),
        offer_id=payload["offer_id"],
        status=payload["status"],
        summary=payload["summary"],
        history=[
            application_agent.ApplicationHistoryItem(
                status=item["status"],
                message_ar=item["message_ar"],
                created_at=_datetime_value(item["created_at"]),
            )
            for item in payload["history"]
        ],
        simulation=payload["simulation"],
        created_at=_datetime_value(payload["created_at"]),
        updated_at=_datetime_value(payload["updated_at"]),
    )


class PostgresJourneyPersistence:
    def __init__(self, database_url: str):
        self.enabled = False
        try:
            from psycopg.rows import dict_row
            from psycopg_pool import ConnectionPool
        except ImportError:
            logger.warning(
                "DATABASE_URL is configured but psycopg is not installed; "
                "journeys will use in-memory storage only."
            )
            return

        max_size = int(os.environ.get("DATABASE_POOL_MAX", "5"))
        min_size = int(os.environ.get("DATABASE_POOL_MIN", "1"))
        self._pool = ConnectionPool(
            database_url,
            min_size=min_size,
            max_size=max_size,
            kwargs={"autocommit": True, "row_factory": dict_row},
            open=False,
        )
        self._pool.open(wait=False)
        self.enabled = True

    def save_journey(
        self,
        result: JourneyResult,
        requested_amount: float,
        requested_tenor_months: int,
    ) -> None:
        if not self.enabled:
            return

        from psycopg.types.json import Jsonb

        payload = result.response_payload(include_events=False)
        with self._pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO journeys (
                    journey_id,
                    persona_id,
                    requested_amount,
                    requested_tenor_months,
                    profile,
                    matches,
                    max_affordable_new_installment,
                    suggested_questions,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (journey_id) DO UPDATE SET
                    persona_id = EXCLUDED.persona_id,
                    requested_amount = EXCLUDED.requested_amount,
                    requested_tenor_months = EXCLUDED.requested_tenor_months,
                    profile = EXCLUDED.profile,
                    matches = EXCLUDED.matches,
                    max_affordable_new_installment =
                        EXCLUDED.max_affordable_new_installment,
                    suggested_questions = EXCLUDED.suggested_questions,
                    updated_at = now()
                """,
                (
                    result.journey_id,
                    result.profile.persona_id,
                    requested_amount,
                    requested_tenor_months,
                    Jsonb(payload["profile"]),
                    Jsonb(payload["matches"]),
                    result.max_affordable,
                    Jsonb(payload["suggested_questions"]),
                ),
            )
            for event in result.events:
                self.save_event(event, conn=conn)

    def save_event(self, event: AgentEvent, conn: Any | None = None) -> None:
        if not self.enabled:
            return

        from psycopg.types.json import Jsonb

        def execute(connection: Any) -> None:
            connection.execute(
                """
                INSERT INTO agent_events (
                    journey_id,
                    sequence,
                    type,
                    agent,
                    message_ar,
                    payload,
                    created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (journey_id, sequence) DO UPDATE SET
                    type = EXCLUDED.type,
                    agent = EXCLUDED.agent,
                    message_ar = EXCLUDED.message_ar,
                    payload = EXCLUDED.payload,
                    created_at = EXCLUDED.created_at
                """,
                (
                    event.journey_id,
                    event.sequence,
                    event.type.value,
                    event.agent.value if event.agent else None,
                    event.message_ar,
                    Jsonb(event.payload),
                    event.created_at,
                ),
            )

        if conn is not None:
            execute(conn)
            return

        with self._pool.connection() as pooled:
            execute(pooled)

    def load_journey(
        self,
        journey_id: str,
        offers: list[Offer],
    ) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        with self._pool.connection() as conn:
            row = conn.execute(
                """
                SELECT journey_id, persona_id, requested_amount,
                       requested_tenor_months, profile,
                       max_affordable_new_installment
                FROM journeys
                WHERE journey_id = %s
                """,
                (journey_id,),
            ).fetchone()
            if row is None:
                return None
            event_rows = conn.execute(
                """
                SELECT journey_id, sequence, type, agent, message_ar, payload,
                       created_at
                FROM agent_events
                WHERE journey_id = %s
                ORDER BY sequence ASC
                """,
                (journey_id,),
            ).fetchall()

        return _session_from_row(row, event_rows, offers)

    def load_latest_for_persona(
        self,
        persona_id: str,
        offers: list[Offer],
    ) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        with self._pool.connection() as conn:
            row = conn.execute(
                """
                SELECT journey_id
                FROM journeys
                WHERE persona_id = %s
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (persona_id,),
            ).fetchone()
        if row is None:
            return None
        return self.load_journey(str(row["journey_id"]), offers)


def _session_from_row(
    row: dict[str, Any],
    event_rows: list[dict[str, Any]],
    offers: list[Offer],
) -> dict[str, Any]:
    profile = _profile_from_payload(row["profile"])
    requested_amount = _as_float(row["requested_amount"])
    requested_tenor_months = int(row["requested_tenor_months"])
    matches = rank_matches(
        [
            match_offer(offer, profile, requested_amount, requested_tenor_months)
            for offer in offers
        ]
    )
    return {
        "profile": profile,
        "matches": matches,
        "max_affordable": _as_float(row["max_affordable_new_installment"])
        or dbr.max_affordable_installment(profile),
        "events": [_event_from_payload(event) for event in event_rows],
        "journey_id": str(row["journey_id"]),
        "requested_amount": requested_amount,
        "requested_tenor_months": requested_tenor_months,
    }


class JourneyStore:
    def __init__(
        self,
        offers: list[Offer],
        database_url: str | None = None,
        max_entries: int | None = None,
    ):
        self._offers = offers
        self._max_entries = (
            max_entries
            if max_entries is not None
            else _env_int("JOURNEY_STORE_MAX", DEFAULT_STORE_MAX)
        )
        self._sessions: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._journeys: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._postgres = (
            PostgresJourneyPersistence(database_url)
            if database_url
            else None
        )

    @property
    def postgres_enabled(self) -> bool:
        return bool(self._postgres and self._postgres.enabled)

    def save(
        self,
        result: JourneyResult,
        requested_amount: float,
        requested_tenor_months: int,
    ) -> None:
        session = {
            "profile": result.profile,
            "matches": result.matches,
            "max_affordable": result.max_affordable,
            "events": result.events,
            "journey_id": result.journey_id,
            "requested_amount": requested_amount,
            "requested_tenor_months": requested_tenor_months,
        }
        self._cache(session)
        if self._postgres:
            self._postgres.save_journey(result, requested_amount, requested_tenor_months)

    def get_by_persona(self, persona_id: str) -> dict[str, Any] | None:
        session = self._sessions.get(persona_id)
        if session is not None:
            _touch(self._sessions, persona_id)
            return session
        if self._postgres:
            session = self._postgres.load_latest_for_persona(persona_id, self._offers)
            if session is not None:
                self._cache(session)
        return session

    def get_by_journey(self, journey_id: str) -> dict[str, Any] | None:
        session = self._journeys.get(journey_id)
        if session is not None:
            _touch(self._journeys, journey_id)
            return session
        if self._postgres:
            session = self._postgres.load_journey(journey_id, self._offers)
            if session is not None:
                self._cache(session)
        return session

    def append_event(self, session: dict[str, Any], event: AgentEvent) -> None:
        session["events"].append(event)
        if self._postgres:
            self._postgres.save_event(event)

    def all_sessions(self) -> list[dict[str, Any]]:
        return list(self._journeys.values())

    def _cache(self, session: dict[str, Any]) -> None:
        _insert_bounded(
            self._journeys, session["journey_id"], session, self._max_entries
        )
        _insert_bounded(
            self._sessions, session["profile"].persona_id, session, self._max_entries
        )


class PostgresApplicationPersistence:
    def __init__(self, database_url: str):
        self.enabled = False
        try:
            from psycopg.rows import dict_row
            from psycopg_pool import ConnectionPool
        except ImportError:
            logger.warning(
                "DATABASE_URL is configured but psycopg is not installed; "
                "applications will use in-memory storage only."
            )
            return

        max_size = int(os.environ.get("DATABASE_POOL_MAX", "5"))
        min_size = int(os.environ.get("DATABASE_POOL_MIN", "1"))
        self._pool = ConnectionPool(
            database_url,
            min_size=min_size,
            max_size=max_size,
            kwargs={"autocommit": True, "row_factory": dict_row},
            open=False,
        )
        self._pool.open(wait=False)
        self.enabled = True

    def save(self, record: application_agent.ApplicationRecord) -> None:
        if not self.enabled:
            return

        from psycopg.types.json import Jsonb

        with self._pool.connection() as conn:
            conn.execute(
                """
                INSERT INTO applications (
                    application_id,
                    journey_id,
                    offer_id,
                    status,
                    summary,
                    history,
                    simulation,
                    created_at,
                    updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (application_id) DO UPDATE SET
                    offer_id = EXCLUDED.offer_id,
                    status = EXCLUDED.status,
                    summary = EXCLUDED.summary,
                    history = EXCLUDED.history,
                    simulation = EXCLUDED.simulation,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    record.application_id,
                    record.journey_id,
                    record.offer_id,
                    record.status,
                    Jsonb(record.summary),
                    Jsonb([item.__dict__ for item in record.history]),
                    record.simulation,
                    record.created_at,
                    record.updated_at,
                ),
            )

    def load(self, application_id: str) -> application_agent.ApplicationRecord | None:
        if not self.enabled:
            return None

        with self._pool.connection() as conn:
            row = conn.execute(
                """
                SELECT application_id, journey_id, offer_id, status, summary,
                       history, simulation, created_at, updated_at
                FROM applications
                WHERE application_id = %s
                """,
                (application_id,),
            ).fetchone()
        if row is None:
            return None
        return _application_from_payload(row)


class ApplicationStore:
    def __init__(
        self,
        database_url: str | None = None,
        max_entries: int | None = None,
    ):
        self._max_entries = (
            max_entries
            if max_entries is not None
            else _env_int("APPLICATION_STORE_MAX", DEFAULT_STORE_MAX)
        )
        self._applications: OrderedDict[str, application_agent.ApplicationRecord] = (
            OrderedDict()
        )
        self._postgres = (
            PostgresApplicationPersistence(database_url)
            if database_url
            else None
        )

    @property
    def postgres_enabled(self) -> bool:
        return bool(self._postgres and self._postgres.enabled)

    def save(self, record: application_agent.ApplicationRecord) -> None:
        _insert_bounded(
            self._applications, record.application_id, record, self._max_entries
        )
        if self._postgres:
            self._postgres.save(record)

    def get(self, application_id: str) -> application_agent.ApplicationRecord | None:
        record = self._applications.get(application_id)
        if record is not None:
            _touch(self._applications, application_id)
            return record
        if self._postgres:
            record = self._postgres.load(application_id)
            if record is not None:
                _insert_bounded(
                    self._applications, application_id, record, self._max_entries
                )
        return record

    def all_applications(self) -> list[application_agent.ApplicationRecord]:
        return list(self._applications.values())
