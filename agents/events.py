"""Structured agent events for the journey UI and audit trace."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class AgentName(str, Enum):
    FINANCIAL_PROFILE = "financial_profile"
    MATCHING = "matching"
    COST = "cost"
    ADVISOR = "advisor"
    APPLICATION = "application"


class AgentEventType(str, Enum):
    AGENT_STARTED = "agent_started"
    TOOL_CALLED = "tool_called"
    FINDING = "finding"
    AGENT_COMPLETED = "agent_completed"
    ERROR = "error"
    JOURNEY_COMPLETED = "journey_completed"


@dataclass
class AgentEvent:
    journey_id: str
    sequence: int
    type: AgentEventType
    agent: AgentName | None
    message_ar: str
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "journey_id": self.journey_id,
            "sequence": self.sequence,
            "type": self.type.value,
            "agent": self.agent.value if self.agent else None,
            "message_ar": self.message_ar,
            "payload": self.payload,
            "created_at": self.created_at,
        }


class EventRecorder:
    def __init__(self, journey_id: str):
        self.journey_id = journey_id
        self._sequence = 0
        self.events: list[AgentEvent] = []

    def emit(
        self,
        event_type: AgentEventType,
        agent: AgentName | None,
        message_ar: str,
        payload: dict[str, Any] | None = None,
    ) -> AgentEvent:
        self._sequence += 1
        event = AgentEvent(
            journey_id=self.journey_id,
            sequence=self._sequence,
            type=event_type,
            agent=agent,
            message_ar=message_ar,
            payload=payload or {},
        )
        self.events.append(event)
        return event
