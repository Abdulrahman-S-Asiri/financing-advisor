"""Main platform API (runs on :8000). The demo spine is one endpoint:

POST /journey/connect
  simulated consent -> fetch AIS transactions from the mock OB service ->
  extract FinancialProfile -> match + price every offer -> ranked, explained
  results. This is the Day-1 target: if this works end-to-end (ugly), the
  hackathon is on rails.

POST /advisor/chat
  advisor agent over the last journey result for that persona (in-memory
  session; a table in db/schema.sql is the persistence path if needed).

POST /auth/otp/start + POST /auth/otp/verify
  interim simulated phone OTP flow for local product wiring. Production auth
  remains Nafath or an approved identity provider.

Offers load from db/seed_offers.json through OffersRepo. Why JSON-first:
a 72-hour build should not spend day 1 on database plumbing; the repo
interface lets you swap in Postgres (schema provided) without touching
the matching code.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from agents import (
    advisor,
    advisor_tools,
    application as application_agent,
    llm_client,
    orchestrator,
)
from agents.events import AgentEvent, AgentEventType, AgentName
from api.analytics import build_outcome_analytics
from api.auth import OtpAuthStore
from api.open_banking import OpenBankingGateway, OpenBankingProviderError
from api.persistence import ApplicationStore, JourneyStore
from core.offers_catalog import parse_offers_catalog
from core.offer_verification import (
    build_review_checklist,
    review_checklist_csv,
    verify_offers,
)
from core.profile import Txn

MOCK_OB_BASE_URL = os.environ.get("MOCK_OB_BASE_URL", "http://127.0.0.1:8100")
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
OFFERS_PATH = Path(__file__).resolve().parent.parent / "db" / "seed_offers.json"

app = FastAPI(title="Financing Advisor API", version="0.1.0")
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=6)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except ValueError:
        return default


class OffersRepo:
    """JSON-backed for the hackathon; implement a Postgres variant against
    db/schema.sql if persistence becomes worth the time.

    The catalog is validated at load time (core.offers_catalog): a malformed
    hand-edited file fails startup listing every problem, instead of surfacing
    as a TypeError mid-request."""

    def __init__(self, path: Path):
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.offers = parse_offers_catalog(raw)


repo = OffersRepo(OFFERS_PATH)
journey_store = JourneyStore(repo.offers, DATABASE_URL or None)
application_store = ApplicationStore(DATABASE_URL or None)
auth_store = OtpAuthStore(
    challenge_ttl_minutes=_env_int("AUTH_OTP_TTL_MINUTES", 5),
    session_ttl_hours=_env_int("AUTH_SESSION_TTL_HOURS", 24),
)


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


class OtpStartRequest(BaseModel):
    phone_number: str = Field(examples=["+966501234567"])


class OtpVerifyRequest(BaseModel):
    challenge_id: str
    otp: str = Field(min_length=4, max_length=8)


@app.post("/auth/otp/start")
def auth_otp_start(req: OtpStartRequest):
    try:
        return auth_store.start(req.phone_number)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/auth/otp/verify")
def auth_otp_verify(req: OtpVerifyRequest):
    try:
        return auth_store.verify(req.challenge_id, req.otp)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/auth/session/{session_token}")
def auth_session(session_token: str):
    session = auth_store.get_session(session_token)
    if not session:
        raise HTTPException(404, "Unknown or expired auth session.")
    return session.to_public_dict()


@app.get("/healthz")
def healthz():
    """Liveness and config summary for the status page and deploy probes.

    Booleans and counts only — never configuration values. No upstream calls
    (mock-OB reachability has its own endpoint below)."""
    try:
        llm_client.resolve_provider()
        llm_configured = True
    except llm_client.LLMNotConfigured:
        llm_configured = False
    return {
        "status": "ok",
        "version": app.version,
        "offers_loaded": len(repo.offers),
        # Startup fails on an invalid catalog, so a reachable API implies a
        # valid one; the key documents that invariant for the status page.
        "catalog_valid": True,
        "postgres_enabled": journey_store.postgres_enabled,
        "llm_configured": llm_configured,
        "open_banking_provider": os.environ.get("OPEN_BANKING_PROVIDER", "mock"),
    }


@app.get("/integrations/open-banking/status")
def open_banking_status():
    return {
        "provider": os.environ.get("OPEN_BANKING_PROVIDER", "mock"),
        "base_url": MOCK_OB_BASE_URL,
        "mock_mode": os.environ.get("OPEN_BANKING_PROVIDER", "mock") == "mock",
        "adapter": "api.open_banking.OpenBankingGateway",
    }


@app.get("/offers")
def list_offers():
    return {"count": len(repo.offers), "offers": [o.__dict__ for o in repo.offers]}


@app.get("/offers/verification")
def offers_verification():
    return verify_offers(repo.offers).to_dict()


@app.get("/offers/review-checklist")
def offers_review_checklist():
    return build_review_checklist(repo.offers).to_dict()


@app.get("/offers/review-checklist.csv")
def offers_review_checklist_csv():
    checklist = build_review_checklist(repo.offers)
    return Response(
        content=review_checklist_csv(checklist),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="offer-review-checklist.csv"'
        },
    )


def _open_banking_transactions(req: ConnectRequest) -> tuple[str, list[dict]]:
    factory = getattr(app.state, "ob_client_factory", None)
    gateway = OpenBankingGateway(
        base_url=MOCK_OB_BASE_URL,
        client_factory=factory,
    )
    try:
        return gateway.fetch_transactions(req.persona_id)
    except OpenBankingProviderError as exc:
        detail = exc.message
        if exc.status_code == 503:
            detail = (
                f"{detail} Start it: "
                "uvicorn mock_open_banking.main:app --port 8100"
            )
        raise HTTPException(
            exc.status_code,
            detail,
        ) from exc


def _store_journey(
    result: orchestrator.JourneyResult,
    requested_amount: float,
    requested_tenor_months: int,
) -> None:
    journey_store.save(result, requested_amount, requested_tenor_months)


def _run_connected_journey(req: ConnectRequest) -> orchestrator.JourneyResult:
    bank, raw_txns = _open_banking_transactions(req)
    try:
        txns = [Txn.from_ais(t, bank=bank) for t in raw_txns]
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(502, f"Invalid Open Banking transaction payload: {exc}") from exc
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


def _sse_frame(
    event: str,
    data: dict,
    *,
    event_id: str | int | None = None,
    retry_ms: int | None = 3000,
) -> str:
    lines: list[str] = []
    if event_id is not None:
        lines.append(f"id: {event_id}")
    if retry_ms is not None:
        lines.append(f"retry: {retry_ms}")
    lines.extend(
        [
            f"event: {event}",
            f"data: {json.dumps(data, ensure_ascii=False, default=str)}",
        ]
    )
    return "\n".join(lines) + "\n\n"


def _sse(event: AgentEvent, data: dict | None = None) -> str:
    return _sse_frame(
        event.type.value,
        data or event.to_dict(),
        event_id=event.sequence,
    )


def _journey_sse_events(result: orchestrator.JourneyResult):
    final_payload = result.response_payload(include_events=False)
    for event in result.events:
        data = event.to_dict()
        if event.type == AgentEventType.JOURNEY_COMPLETED:
            data["payload"] = final_payload
        yield _sse(event, data)


def _chat_chunks(reply: str, chunk_size: int = 40, *, guardrail_fallback: bool = False):
    chunk_number = 0
    for index in range(0, len(reply), chunk_size):
        chunk_number += 1
        yield _sse_frame(
            "delta",
            {"delta": reply[index:index + chunk_size]},
            event_id=f"delta-{chunk_number}",
        )
    yield _sse_frame(
        "done",
        {"reply": reply, "guardrail_fallback": guardrail_fallback},
        event_id="done",
    )


@app.post("/journey/connect")
def journey_connect(req: ConnectRequest):
    result = _run_connected_journey(req)
    return result.response_payload()


@app.post("/journey/connect/stream")
def journey_connect_stream(req: ConnectRequest):
    result = _run_connected_journey(req)
    return StreamingResponse(
        _journey_sse_events(result),
        media_type="text/event-stream",
    )


def _chat_session(req: ChatRequest) -> dict:
    session = journey_store.get_by_journey(req.journey_id) if req.journey_id else None
    if session is None and req.persona_id:
        session = journey_store.get_by_persona(req.persona_id)
    if not session:
        raise HTTPException(400, "Run /journey/connect for this persona first.")
    return session


def _advisor_reply(req: ChatRequest) -> advisor.AdvisorChatResult:
    session = _chat_session(req)
    try:
        result = advisor.chat_with_trace(
            session["profile"], session["matches"], session["max_affordable"],
            req.message,
        )
    except llm_client.LLMNotConfigured as exc:
        raise HTTPException(503, str(exc)) from exc
    _record_advisor_tool_traces(session, result.tool_results or [])
    _record_advisor_chat(session, result, req.message)
    return result


@app.post("/advisor/chat")
def advisor_chat(req: ChatRequest):
    result = _advisor_reply(req)
    return {
        "reply": result.reply,
        "guardrail_fallback": result.guardrail_fallback,
        "guardrail_retries": result.guardrail_retries,
    }


@app.post("/advisor/chat/stream")
def advisor_chat_stream(req: ChatRequest):
    result = _advisor_reply(req)
    return StreamingResponse(
        _chat_chunks(result.reply, guardrail_fallback=result.guardrail_fallback),
        media_type="text/event-stream",
    )


@app.get("/analytics/overview")
def analytics_overview():
    return build_outcome_analytics(
        journey_store.all_sessions(),
        application_store.all_applications(),
    )


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


def _record_advisor_tool_traces(session: dict, tool_results: list[dict]) -> None:
    messages = {
        "simulate_scenario": "استدعاء أداة محاكاة السيناريو داخل المحادثة.",
        "get_offer_detail": "استدعاء أداة تفاصيل العرض داخل المحادثة.",
        "get_payment_schedule": "استدعاء أداة جدول السداد داخل المحادثة.",
        "evaluate_dbr": "استدعاء أداة تقييم نسبة الاستقطاع داخل المحادثة.",
    }
    for item in tool_results:
        tool = item.get("tool", "advisor_tool")
        event = AgentEvent(
            journey_id=session["journey_id"],
            sequence=len(session["events"]) + 1,
            type=AgentEventType.TOOL_CALLED,
            agent=AgentName.ADVISOR,
            message_ar=messages.get(tool, "استدعاء أداة المستشار داخل المحادثة."),
            payload={
                "tool": tool,
                "round": item.get("round"),
                "is_error": bool(item.get("is_error", False)),
            },
        )
        journey_store.append_event(session, event)


def _record_advisor_chat(
    session: dict,
    result: advisor.AdvisorChatResult,
    user_message: str,
) -> AgentEvent:
    event = AgentEvent(
        journey_id=session["journey_id"],
        sequence=len(session["events"]) + 1,
        type=AgentEventType.TOOL_CALLED,
        agent=AgentName.ADVISOR,
        message_ar="استدعاء نموذج المستشار مع تسجيل استخدام الرموز.",
        payload={
            "tool": "advisor.chat",
            "usage": result.usage,
            "guardrail_retries": result.guardrail_retries,
            "guardrail_fallback": result.guardrail_fallback,
            "unsupported_number_count": len(result.unsupported_numbers or []),
            "tool_call_count": len(result.tool_results or []),
            "message_length": len(user_message),
            "reply_length": len(result.reply),
        },
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
