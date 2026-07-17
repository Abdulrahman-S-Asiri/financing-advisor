"""Transaction categorizer agent with deterministic safe fallback."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable

from agents import llm_client
from core.profile import VALID_CATEGORIES


SYSTEM = """Classify transaction descriptions into this fixed category enum:
salary, other_income, salary_linked_obligation, other_obligation,
real_estate_obligation, ignore.

Rules:
1. Use only the provided description and direction.
2. Never infer, invent, or return amounts, dates, banks, or eligibility decisions.
3. Return strict JSON only, with this exact shape:
{"labels":[{"id":"t1","category":"salary"}]}
4. Return one label for every id. Use "ignore" when unsure.
"""


CompleteFn = Callable[[str, str], llm_client.LLMCompletion]


@dataclass(frozen=True)
class CategorizationCandidate:
    description: str
    credit: bool


@dataclass(frozen=True)
class CategorizationBatch:
    labels: dict[tuple[str, bool], str]
    attempted_count: int
    usage: dict | None = None
    error: str = ""


def _normalized_description(description: str) -> str:
    return " ".join(description.strip().upper().split())


def _candidate_key(candidate: CategorizationCandidate) -> tuple[str, bool]:
    return (_normalized_description(candidate.description), candidate.credit)


def _request_payload(candidates: list[CategorizationCandidate]) -> str:
    return json.dumps(
        {
            "transactions": [
                {
                    "id": f"t{index}",
                    "description": _normalized_description(candidate.description),
                    "direction": "credit" if candidate.credit else "debit",
                }
                for index, candidate in enumerate(candidates, start=1)
            ]
        },
        ensure_ascii=False,
    )


def _parse_labels(
    text: str,
    candidates: list[CategorizationCandidate],
) -> dict[tuple[str, bool], str]:
    payload = json.loads(text)
    if not isinstance(payload, dict) or set(payload) != {"labels"}:
        raise ValueError("Categorizer response must contain only labels.")
    labels = payload["labels"]
    if not isinstance(labels, list):
        raise ValueError("Categorizer labels must be a list.")

    expected_ids = {f"t{index}" for index in range(1, len(candidates) + 1)}
    candidates_by_id = {
        f"t{index}": candidate for index, candidate in enumerate(candidates, start=1)
    }
    seen: set[str] = set()
    parsed: dict[tuple[str, bool], str] = {}
    for item in labels:
        if not isinstance(item, dict) or set(item) != {"id", "category"}:
            raise ValueError("Each categorizer label must contain id and category.")
        item_id = item["id"]
        category = item["category"]
        if item_id not in expected_ids or item_id in seen:
            raise ValueError("Categorizer returned an unknown or duplicate id.")
        if category not in VALID_CATEGORIES:
            raise ValueError("Categorizer returned an unsupported category.")
        seen.add(item_id)
        parsed[_candidate_key(candidates_by_id[item_id])] = category

    if seen != expected_ids:
        raise ValueError("Categorizer must return one label per candidate.")
    return parsed


def categorize(
    candidates: list[CategorizationCandidate],
    *,
    complete: CompleteFn | None = None,
) -> CategorizationBatch:
    """Return category labels, or no labels if the categorizer is unavailable."""
    unique_candidates = list(dict.fromkeys(candidates))
    if not unique_candidates:
        return CategorizationBatch(labels={}, attempted_count=0)

    complete_fn = complete or llm_client.complete_with_usage
    try:
        completion = complete_fn(SYSTEM, _request_payload(unique_candidates))
        labels = _parse_labels(completion.text, unique_candidates)
    except Exception as exc:
        return CategorizationBatch(
            labels={},
            attempted_count=len(unique_candidates),
            error=exc.__class__.__name__,
        )
    return CategorizationBatch(
        labels=labels,
        attempted_count=len(unique_candidates),
        usage=completion.usage.to_dict(),
    )


def category_for(
    labels: dict[tuple[str, bool], str],
    description: str,
    credit: bool,
) -> str | None:
    return labels.get((_normalized_description(description), credit))


def callback_from_labels(
    labels: dict[tuple[str, bool], str],
) -> Callable[[str, bool], str | None]:
    return lambda description, credit: category_for(labels, description, credit)
