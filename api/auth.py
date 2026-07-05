"""Interim authentication contracts.

The production path is Nafath or a licensed identity provider. This module
keeps the API contract usable locally with a simulated phone OTP flow while
making the simulation explicit in every response.
"""
from __future__ import annotations

import hashlib
import re
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


SAUDI_MOBILE_RE = re.compile(r"^(?:\+9665|05)\d{8}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat()


def normalize_saudi_mobile(phone_number: str) -> str:
    phone = phone_number.strip().replace(" ", "").replace("-", "")
    if not SAUDI_MOBILE_RE.match(phone):
        raise ValueError("Phone number must be a Saudi mobile number.")
    if phone.startswith("05"):
        return "+966" + phone[1:]
    return phone


def _hash_otp(challenge_id: str, phone_number: str, otp: str) -> str:
    material = f"{challenge_id}:{phone_number}:{otp}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


@dataclass
class OtpChallenge:
    challenge_id: str
    phone_number: str
    otp_hash: str
    expires_at: datetime
    attempts_remaining: int = 5
    verified: bool = False
    created_at: datetime = field(default_factory=_now)

    def to_public_dict(self, *, demo_otp: str | None = None) -> dict:
        payload = {
            "challenge_id": self.challenge_id,
            "phone_number": self.phone_number,
            "expires_at": _iso(self.expires_at),
            "attempts_remaining": self.attempts_remaining,
            "simulation": True,
            "delivery_channel": "demo_response",
        }
        if demo_otp is not None:
            payload["demo_otp"] = demo_otp
        return payload


@dataclass
class AuthSession:
    session_token: str
    phone_number: str
    auth_method: str
    assurance_level: str
    expires_at: datetime
    simulation: bool = True
    created_at: datetime = field(default_factory=_now)

    def to_public_dict(self) -> dict:
        return {
            "session_token": self.session_token,
            "phone_number": self.phone_number,
            "auth_method": self.auth_method,
            "assurance_level": self.assurance_level,
            "expires_at": _iso(self.expires_at),
            "simulation": self.simulation,
            "created_at": _iso(self.created_at),
        }


class OtpAuthStore:
    def __init__(
        self,
        *,
        challenge_ttl_minutes: int = 5,
        session_ttl_hours: int = 24,
    ):
        self.challenge_ttl = timedelta(minutes=challenge_ttl_minutes)
        self.session_ttl = timedelta(hours=session_ttl_hours)
        self._challenges: dict[str, OtpChallenge] = {}
        self._sessions: dict[str, AuthSession] = {}

    def start(self, phone_number: str) -> dict:
        self._purge_expired()
        normalized_phone = normalize_saudi_mobile(phone_number)
        challenge_id = str(uuid.uuid4())
        otp = f"{secrets.randbelow(1_000_000):06d}"
        challenge = OtpChallenge(
            challenge_id=challenge_id,
            phone_number=normalized_phone,
            otp_hash=_hash_otp(challenge_id, normalized_phone, otp),
            expires_at=_now() + self.challenge_ttl,
        )
        self._challenges[challenge_id] = challenge
        return challenge.to_public_dict(demo_otp=otp)

    def verify(self, challenge_id: str, otp: str) -> dict:
        self._purge_expired()
        challenge = self._challenges.get(challenge_id)
        if challenge is None:
            raise ValueError("Unknown or expired OTP challenge.")
        if challenge.verified:
            raise ValueError("OTP challenge has already been used.")
        if challenge.attempts_remaining <= 0:
            raise ValueError("OTP challenge has no attempts remaining.")

        expected_hash = challenge.otp_hash
        submitted_hash = _hash_otp(challenge_id, challenge.phone_number, otp.strip())
        if not secrets.compare_digest(expected_hash, submitted_hash):
            challenge.attempts_remaining -= 1
            raise ValueError("Invalid OTP code.")

        challenge.verified = True
        session = AuthSession(
            session_token=secrets.token_urlsafe(32),
            phone_number=challenge.phone_number,
            auth_method="phone_otp",
            assurance_level="interim_demo",
            expires_at=_now() + self.session_ttl,
        )
        self._sessions[session.session_token] = session
        return session.to_public_dict()

    def get_session(self, session_token: str) -> AuthSession | None:
        self._purge_expired()
        return self._sessions.get(session_token)

    def _purge_expired(self) -> None:
        now = _now()
        expired_challenges = [
            challenge_id
            for challenge_id, challenge in self._challenges.items()
            if challenge.expires_at <= now
        ]
        for challenge_id in expired_challenges:
            self._challenges.pop(challenge_id, None)

        expired_sessions = [
            token
            for token, session in self._sessions.items()
            if session.expires_at <= now
        ]
        for token in expired_sessions:
            self._sessions.pop(token, None)
