"""Mock Open Banking AIS service (runs on :8100).

Purpose: give the platform a REAL service boundary. The main API talks to
this over HTTP exactly as it would talk to a licensed TPP/aggregator later.
Swapping in a real provider is then a base-URL + auth change, not a rewrite
— that is the sentence you say to the judges.

Envelope follows the common Open Banking style (Data/Links/Meta) that the
SAMA framework's AIS APIs are built in the spirit of. TEAM TODO during
enrichment: pull the official SAMA AIS swagger from the Open Banking Lab
and align field names 1:1. Keep changes inside personas.py + Txn.from_ais.

The consent endpoints simulate the SCA/authorisation dance so the demo can
show a consent screen — the moment the audience understands "this is Open
Banking", even with synthetic data behind it.
"""
from __future__ import annotations

import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from mock_open_banking import personas

app = FastAPI(title="Mock SAMA AIS", version="0.1.0")

_consents: dict[str, dict] = {}


class ConsentRequest(BaseModel):
    persona_id: str
    permissions: list[str] = ["ReadAccountsBasic", "ReadBalances", "ReadTransactionsDetail"]


def _envelope(data: dict) -> dict:
    return {"Data": data, "Links": {"self": "mock"}, "Meta": {"TotalPages": 1}}


@app.post("/consents")
def create_consent(req: ConsentRequest):
    if req.persona_id not in personas.PERSONAS:
        raise HTTPException(404, f"Unknown persona '{req.persona_id}'")
    consent_id = str(uuid.uuid4())
    _consents[consent_id] = {"persona_id": req.persona_id, "status": "AwaitingAuthorisation"}
    return _envelope({"ConsentId": consent_id, "Status": "AwaitingAuthorisation",
                      "Permissions": req.permissions})


@app.post("/consents/{consent_id}/authorize")
def authorize_consent(consent_id: str):
    """Simulated SCA step (in production: redirect to the bank + Absher-backed auth)."""
    consent = _consents.get(consent_id)
    if not consent:
        raise HTTPException(404, "Unknown consent")
    consent["status"] = "Authorised"
    return _envelope({"ConsentId": consent_id, "Status": "Authorised"})


def _persona_from_consent(consent_id: str) -> str:
    consent = _consents.get(consent_id)
    if not consent:
        raise HTTPException(404, "Unknown consent")
    if consent["status"] != "Authorised":
        raise HTTPException(403, "Consent not authorised")
    return consent["persona_id"]


@app.get("/accounts")
def get_accounts(consent_id: str):
    pid = _persona_from_consent(consent_id)
    return _envelope({"Account": [personas.account_for(pid)]})


@app.get("/accounts/{account_id}/balances")
def get_balances(account_id: str, consent_id: str):
    pid = _persona_from_consent(consent_id)
    return _envelope({"Balance": [personas.balance_for(pid)]})


@app.get("/accounts/{account_id}/transactions")
def get_transactions(account_id: str, consent_id: str):
    pid = _persona_from_consent(consent_id)
    return _envelope({"Transaction": personas.generate_transactions(pid)})
