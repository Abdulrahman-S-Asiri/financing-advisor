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

from agents import (
    advisor,
    advisor_tools,
    application as application_agent,
    llm_client,
    orchestrator,
)
from agents.events import AgentEvent, AgentEventType, AgentName
from api.persistence import ApplicationStore, JourneyStore
from core.models import Category, Offer, Structure
from core.offer_verification import verify_offers
from core.profile import Txn

MOCK_OB_BASE_URL = os.environ.get("MOCK_OB_BASE_URL", "http://127.0.0.1:8100")
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
OFFERS_PATH = Path(__file__).resolve().parent.parent / "db" / "seed_offers.json"

app = FastAPI(title="Financing Advisor API", version="0.1.0")


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
journey_store = JourneyStore(repo.offers, DATABASE_URL or None)
application_store = ApplicationStore(DATABASE_URL or None)


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


class AdvisorSimulateRequest(BaseModel):
    journey_id: str
    requested_amount: float | None = Field(default=None, gt=0)
    requested_tenor_months: int | None = Field(default=None, gt=0)
    salary_transfer: bool = False


class ApplicationDraftRequest(BaseModel):
    journey_id: str
    offer_id: str


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


@app.get("/offers/verification")
def offers_verification():
    return verify_offers(repo.offers).to_dict()


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


def _store_journey(
    result: orchestrator.JourneyResult,
    requested_amount: float,
    requested_tenor_months: int,
) -> None:
    journey_store.save(result, requested_amount, requested_tenor_months)


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
    _store_journey(result, req.requested_amount, req.requested_tenor_months)
    return result


def _sse(event: AgentEvent) -> str:
    return (
        f"event: {event.type.value}\n"
        f"data: {json.dumps(event.to_dict(), ensure_ascii=False, default=str)}\n\n"
    )


def _sse_data(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _chat_chunks(reply: str, chunk_size: int = 40):
    for index in range(0, len(reply), chunk_size):
        yield _sse_data("delta", {"delta": reply[index:index + chunk_size]})
    yield _sse_data("done", {"reply": reply})


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


def _chat_session(req: ChatRequest) -> dict:
    session = journey_store.get_by_journey(req.journey_id) if req.journey_id else None
    if session is None and req.persona_id:
        session = journey_store.get_by_persona(req.persona_id)
    if not session:
        raise HTTPException(400, "Run /journey/connect for this persona first.")
    return session


def _advisor_reply(req: ChatRequest) -> str:
    session = _chat_session(req)
    try:
        return advisor.chat(
            session["profile"], session["matches"], session["max_affordable"],
            req.message,
        )
    except llm_client.LLMNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc


@app.post("/advisor/chat")
def advisor_chat(req: ChatRequest):
    reply = _advisor_reply(req)
    return {"reply": reply}


@app.post("/advisor/chat/stream")
def advisor_chat_stream(req: ChatRequest):
    reply = _advisor_reply(req)
    return StreamingResponse(_chat_chunks(reply), media_type="text/event-stream")


def _journey_session(journey_id: str) -> dict:
    session = journey_store.get_by_journey(journey_id)
    if not session:
        raise HTTPException(404, "Unknown journey_id.")
    return session


def _record_advisor_tool(session: dict, tool: str, payload: dict) -> AgentEvent:
    messages = {
        "simulate": "استدعاء أداة محاكاة السيناريو.",
        "get_offer_detail": "استدعاء أداة تفاصيل العرض.",
        "get_payment_schedule": "استدعاء أداة جدول السداد.",
    }
    event = AgentEvent(
        journey_id=session["journey_id"],
        sequence=len(session["events"]) + 1,
        type=AgentEventType.TOOL_CALLED,
        agent=AgentName.ADVISOR,
        message_ar=messages.get(tool, "استدعاء أداة المستشار."),
        payload={"tool": tool, **payload},
    )
    journey_store.append_event(session, event)
    return event


@app.post("/advisor/tools/simulate")
def advisor_tool_simulate(req: AdvisorSimulateRequest):
    session = _journey_session(req.journey_id)
    requested_amount = req.requested_amount or session["requested_amount"]
    requested_tenor_months = (
        req.requested_tenor_months or session["requested_tenor_months"]
    )
    try:
        payload = advisor_tools.simulate(
            session["profile"],
            repo.offers,
            requested_amount,
            requested_tenor_months,
            salary_transfer=req.salary_transfer,
        )
    except advisor_tools.AdvisorToolError as exc:
        raise HTTPException(400, str(exc)) from exc

    event = _record_advisor_tool(
        session,
        "simulate",
        {
            "requested_amount": requested_amount,
            "requested_tenor_months": requested_tenor_months,
            "salary_transfer": req.salary_transfer,
        },
    )
    return {
        "journey_id": req.journey_id,
        "tool": "simulate",
        "event": event.to_dict(),
        **payload,
    }


@app.get("/advisor/tools/{journey_id}/offers/{offer_id}")
def advisor_tool_offer_detail(journey_id: str, offer_id: str):
    session = _journey_session(journey_id)
    try:
        detail = advisor_tools.get_offer_detail(session["matches"], offer_id)
    except advisor_tools.AdvisorToolError as exc:
        raise HTTPException(404, str(exc)) from exc

    event = _record_advisor_tool(
        session,
        "get_offer_detail",
        {"offer_id": offer_id},
    )
    return {
        "journey_id": journey_id,
        "tool": "get_offer_detail",
        "event": event.to_dict(),
        "offer": detail,
    }


@app.get("/advisor/tools/{journey_id}/offers/{offer_id}/payment-schedule")
def advisor_tool_payment_schedule(journey_id: str, offer_id: str):
    session = _journey_session(journey_id)
    try:
        schedule = advisor_tools.get_payment_schedule(session["matches"], offer_id)
    except advisor_tools.AdvisorToolError as exc:
        raise HTTPException(404, str(exc)) from exc

    event = _record_advisor_tool(
        session,
        "get_payment_schedule",
        {"offer_id": offer_id, "row_count": len(schedule)},
    )
    return {
        "journey_id": journey_id,
        "tool": "get_payment_schedule",
        "event": event.to_dict(),
        "offer_id": offer_id,
        "payment_schedule": schedule,
    }


def _journey_match(journey_id: str, offer_id: str):
    session = _journey_session(journey_id)
    for match in session["matches"]:
        if match.offer.id == offer_id:
            return session, match
    raise HTTPException(404, "Offer not found in this journey.")


@app.post("/applications/draft")
def application_draft(req: ApplicationDraftRequest):
    session, match = _journey_match(req.journey_id, req.offer_id)
    try:
        record = application_agent.create_draft(
            req.journey_id,
            session["profile"],
            match,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    application_store.save(record)
    return record.to_dict()


@app.get("/applications/{application_id}")
def application_detail(application_id: str):
    record = application_store.get(application_id)
    if not record:
        raise HTTPException(404, "Unknown application_id.")
    return record.to_dict()


@app.post("/applications/{application_id}/submit")
def application_submit(application_id: str):
    record = application_store.get(application_id)
    if not record:
        raise HTTPException(404, "Unknown application_id.")
    application_agent.submit(record)
    application_store.save(record)
    return record.to_dict()


@app.post("/applications/{application_id}/advance")
def application_advance(application_id: str):
    record = application_store.get(application_id)
    if not record:
        raise HTTPException(404, "Unknown application_id.")
    session, match = _journey_match(record.journey_id, record.offer_id)
    final_status = application_agent.final_status_for(session["profile"], match)
    application_agent.advance(record, final_status)
    application_store.save(record)
    return record.to_dict()
