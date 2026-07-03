"""Main platform API (runs on :8000). The demo spine is one endpoint:

POST /journey/connect
  simulated consent -> fetch AIS transactions from the mock OB service ->
  extract FinancialProfile -> match + price every offer -> ranked, explained
  results. This is the Day-1 target: if this works end-to-end (ugly), the
  hackathon is on rails.

POST /advisor/chat
  advisor agent over the last journey result for that persona (in-memory
  session; a table in db/schema.sql is the persistence path if needed).

Offers load from db/seed_offers.json through OffersRepo. Why JSON-first:
a 72-hour build should not spend day 1 on database plumbing; the repo
interface lets you swap in Postgres (schema provided) without touching
the matching code.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents import advisor, llm_client, orchestrator
from agents.events import AgentEvent
from core.models import Category, Offer, Structure
from core.profile import Txn

MOCK_OB_BASE_URL = os.environ.get("MOCK_OB_BASE_URL", "http://127.0.0.1:8100")
OFFERS_PATH = Path(__file__).resolve().parent.parent / "db" / "seed_offers.json"

app = FastAPI(title="Financing Advisor API", version="0.1.0")

_sessions: dict[str, dict] = {}   # persona_id -> last journey result (demo-grade)
_journeys: dict[str, dict] = {}    # journey_id -> journey result (demo-grade)


class OffersRepo:
    """JSON-backed for the hackathon; implement a Postgres variant against
    db/schema.sql if persistence becomes worth the time."""

    def __init__(self, path: Path):
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.offers = [
            Offer(**{**o, "category": Category(o["category"]),
                     "structure": Structure(o["structure"])})
            for o in raw["offers"]
        ]


repo = OffersRepo(OFFERS_PATH)


class ConnectRequest(BaseModel):
    persona_id: str = Field(examples=["ahmed_borderline"])
    requested_amount: float = Field(gt=0, examples=[80_000])
    requested_tenor_months: int = Field(gt=0, examples=[48])
    age: int = 30
    nationality: str = "saudi"


class ChatRequest(BaseModel):
    persona_id: str | None = None
    journey_id: str | None = None
    message: str


def _ob_client() -> httpx.Client:
    # Tests inject a factory returning TestClient(mock_ob_app) so the whole
    # pipeline runs in-process with zero network (see test_end_to_end.py).
    factory = getattr(app.state, "ob_client_factory", None)
    if factory is not None:
        return factory()
    return httpx.Client(base_url=MOCK_OB_BASE_URL, timeout=10)


@app.get("/offers")
def list_offers():
    return {"count": len(repo.offers), "offers": [o.__dict__ for o in repo.offers]}


def _open_banking_transactions(req: ConnectRequest) -> tuple[str, list[dict]]:
    try:
        with _ob_client() as client:
            consent = client.post("/consents", json={"persona_id": req.persona_id})
            if consent.status_code == 404:
                raise HTTPException(404, f"Unknown persona '{req.persona_id}'")
            consent.raise_for_status()
            consent_id = consent.json()["Data"]["ConsentId"]
            client.post(f"/consents/{consent_id}/authorize").raise_for_status()

            accounts = client.get("/accounts", params={"consent_id": consent_id})
            accounts.raise_for_status()
            account = accounts.json()["Data"]["Account"][0]

            txns_resp = client.get(
                f"/accounts/{account['accountId']}/transactions",
                params={"consent_id": consent_id},
            )
            txns_resp.raise_for_status()
            raw_txns = txns_resp.json()["Data"]["Transaction"]
            bank = account["servicer"]["name"]
    except httpx.ConnectError as exc:
        raise HTTPException(
            503,
            f"Mock Open Banking service unreachable at {MOCK_OB_BASE_URL}. "
            f"Start it: uvicorn mock_open_banking.main:app --port 8100",
        ) from exc
    return bank, raw_txns


def _store_journey(result: orchestrator.JourneyResult) -> None:
    session = {
        "profile": result.profile,
        "matches": result.matches,
        "max_affordable": result.max_affordable,
        "events": result.events,
        "journey_id": result.journey_id,
    }
    _sessions[result.profile.persona_id] = session
    _journeys[result.journey_id] = session


def _run_connected_journey(req: ConnectRequest) -> orchestrator.JourneyResult:
    bank, raw_txns = _open_banking_transactions(req)
    txns = [Txn.from_ais(t, bank=bank) for t in raw_txns]
    result = orchestrator.run_journey(
        persona_id=req.persona_id,
        txns=txns,
        offers=repo.offers,
        requested_amount=req.requested_amount,
        requested_tenor_months=req.requested_tenor_months,
        age=req.age,
        nationality=req.nationality,
    )
    _store_journey(result)
    return result


def _sse(event: AgentEvent) -> str:
    return (
        f"event: {event.type.value}\n"
        f"data: {json.dumps(event.to_dict(), ensure_ascii=False, default=str)}\n\n"
    )


@app.post("/journey/connect")
def journey_connect(req: ConnectRequest):
    result = _run_connected_journey(req)
    return result.response_payload()


@app.post("/journey/connect/stream")
def journey_connect_stream(req: ConnectRequest):
    result = _run_connected_journey(req)
    return StreamingResponse(
        (_sse(event) for event in result.events),
        media_type="text/event-stream",
    )


@app.post("/advisor/chat")
def advisor_chat(req: ChatRequest):
    session = _journeys.get(req.journey_id) if req.journey_id else None
    if session is None and req.persona_id:
        session = _sessions.get(req.persona_id)
    if not session:
        raise HTTPException(400, "Run /journey/connect for this persona first.")
    try:
        reply = advisor.chat(
            session["profile"], session["matches"], session["max_affordable"],
            req.message,
        )
    except llm_client.LLMNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    return {"reply": reply}
