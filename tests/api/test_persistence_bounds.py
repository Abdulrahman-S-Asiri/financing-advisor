"""LRU bounds on the in-memory stores (no Postgres in these tests, so an
evicted entry is genuinely gone — the behavior the caps must guarantee)."""
from agents import application as application_agent
from agents.orchestrator import JourneyResult
from api.persistence import ApplicationStore, JourneyStore
from core.models import FinancialProfile


def _journey(index: int, persona: str | None = None) -> JourneyResult:
    return JourneyResult(
        journey_id=f"journey-{index}",
        profile=FinancialProfile(
            persona_id=persona or f"persona-{index}", gross_salary=10_000
        ),
        matches=[],
        max_affordable=1_000.0,
        events=[],
    )


def _application(index: int) -> application_agent.ApplicationRecord:
    return application_agent.ApplicationRecord(
        application_id=f"app-{index}",
        journey_id=f"journey-{index}",
        offer_id="offer-x",
        status="draft",
        summary={},
        history=[],
        simulation=True,
        created_at="2026-07-05T00:00:00+00:00",
        updated_at="2026-07-05T00:00:00+00:00",
    )


def test_journey_store_evicts_oldest_past_cap():
    store = JourneyStore(offers=[], max_entries=3)
    for i in range(5):
        store.save(_journey(i), 80_000, 48)

    assert store.get_by_journey("journey-0") is None
    assert store.get_by_journey("journey-1") is None
    assert store.get_by_journey("journey-4") is not None
    assert len(store.all_sessions()) == 3


def test_journey_store_recency_protects_touched_entries():
    store = JourneyStore(offers=[], max_entries=2)
    store.save(_journey(0), 80_000, 48)
    store.save(_journey(1), 80_000, 48)

    assert store.get_by_journey("journey-0") is not None  # touch -> MRU
    store.save(_journey(2), 80_000, 48)                   # evicts journey-1

    assert store.get_by_journey("journey-0") is not None
    assert store.get_by_journey("journey-1") is None


def test_persona_index_is_bounded_too():
    store = JourneyStore(offers=[], max_entries=3)
    for i in range(5):
        store.save(_journey(i), 80_000, 48)

    assert store.get_by_persona("persona-0") is None
    assert store.get_by_persona("persona-4") is not None


def test_persona_reruns_do_not_grow_the_store():
    store = JourneyStore(offers=[], max_entries=3)
    for i in range(5):
        store.save(_journey(i, persona="same-persona"), 80_000, 48)

    # One persona key; journeys map holds the 3 most recent runs.
    assert store.get_by_persona("same-persona")["journey_id"] == "journey-4"
    assert len(store.all_sessions()) == 3


def test_application_store_evicts_oldest_past_cap():
    store = ApplicationStore(max_entries=2)
    for i in range(4):
        store.save(_application(i))

    assert store.get("app-0") is None
    assert store.get("app-1") is None
    assert store.get("app-3") is not None
    assert len(store.all_applications()) == 2


def test_default_cap_comes_from_env(monkeypatch):
    monkeypatch.setenv("JOURNEY_STORE_MAX", "2")
    store = JourneyStore(offers=[])
    for i in range(4):
        store.save(_journey(i), 80_000, 48)
    assert len(store.all_sessions()) == 2
