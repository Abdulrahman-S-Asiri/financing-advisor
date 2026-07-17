import json
from pathlib import Path

import pytest

from agents import categorizer
from agents import llm_client
from core.profile import (
    BNPL_KEYWORDS,
    FINANCE_KEYWORDS,
    MORTGAGE_KEYWORDS,
    SALARY_KEYWORDS,
    VALID_CATEGORIES,
)


LABEL_PATH = Path(__file__).resolve().parents[2] / "db" / "categorizer_labels.json"


def _completion(text: str) -> llm_client.LLMCompletion:
    return llm_client.LLMCompletion(
        text=text,
        usage=llm_client.LLMUsage(provider="fake", model="fake-categorizer"),
    )


def _label_rows() -> list[dict]:
    data = json.loads(LABEL_PATH.read_text(encoding="utf-8"))
    return data["labels"]


def _heuristic_category(description: str, credit: bool) -> str:
    desc = description.upper()
    if credit and any(keyword in desc for keyword in SALARY_KEYWORDS):
        return "salary"
    if credit and any(keyword in desc for keyword in ("RENT", "ايجار", "DIVIDEND")):
        return "other_income"
    if not credit and any(keyword in desc for keyword in MORTGAGE_KEYWORDS):
        return "real_estate_obligation"
    if not credit and any(keyword in desc for keyword in FINANCE_KEYWORDS):
        return "salary_linked_obligation"
    if not credit and any(keyword in desc for keyword in BNPL_KEYWORDS):
        return "other_obligation"
    return "ignore"


def _accuracy(actual: dict[tuple[str, bool], str], rows: list[dict]) -> float:
    correct = 0
    for row in rows:
        key = (row["description"].upper(), row["credit"])
        if actual.get(key) == row["category"]:
            correct += 1
    return correct / len(rows)


def test_categorizer_parses_strict_labels_and_sends_no_amount_fields():
    calls = []

    def complete(system: str, user: str) -> llm_client.LLMCompletion:
        calls.append((system, user))
        return _completion(
            json.dumps(
                {
                    "labels": [
                        {"id": "t1", "category": "other_income"},
                        {"id": "t2", "category": "other_obligation"},
                    ]
                }
            )
        )

    batch = categorizer.categorize(
        [
            categorizer.CategorizationCandidate("unit 4b", credit=True),
            categorizer.CategorizationCandidate("mystery plan", credit=False),
        ],
        complete=complete,
    )

    assert batch.error == ""
    assert batch.attempted_count == 2
    assert batch.labels == {
        ("UNIT 4B", True): "other_income",
        ("MYSTERY PLAN", False): "other_obligation",
    }
    assert batch.usage["provider"] == "fake"

    payload = json.loads(calls[0][1])
    assert payload == {
        "transactions": [
            {"id": "t1", "description": "UNIT 4B", "direction": "credit"},
            {"id": "t2", "description": "MYSTERY PLAN", "direction": "debit"},
        ]
    }
    assert "amount" not in calls[0][1].lower()
    assert "bank" not in calls[0][1].lower()
    assert "date" not in calls[0][1].lower()


def test_categorizer_returns_no_labels_on_invalid_json():
    batch = categorizer.categorize(
        [categorizer.CategorizationCandidate("unit 4b", credit=True)],
        complete=lambda _system, _user: _completion("not json"),
    )

    assert batch.labels == {}
    assert batch.attempted_count == 1
    assert batch.error == "JSONDecodeError"


def test_categorizer_returns_no_labels_on_unsupported_category():
    batch = categorizer.categorize(
        [categorizer.CategorizationCandidate("mystery plan", credit=False)],
        complete=lambda _system, _user: _completion(
            json.dumps({"labels": [{"id": "t1", "category": "credit_card"}]})
        ),
    )

    assert batch.labels == {}
    assert batch.error == "ValueError"


def test_categorizer_callback_normalizes_description_lookup():
    callback = categorizer.callback_from_labels(
        {("MYSTERY PLAN", False): "other_obligation"}
    )

    assert callback(" mystery   plan ", False) == "other_obligation"
    assert callback("mystery plan", True) is None


def test_categorizer_label_dataset_uses_fixed_categories_and_no_amount_fields():
    data = json.loads(LABEL_PATH.read_text(encoding="utf-8"))

    assert set(data["categories"]) == VALID_CATEGORIES
    assert data["labels"]
    for label in data["labels"]:
        assert set(label) == {
            "description",
            "credit",
            "category",
            "source_personas",
        }
        assert label["category"] in VALID_CATEGORIES
        assert isinstance(label["description"], str)
        assert isinstance(label["credit"], bool)
        assert isinstance(label["source_personas"], list)


def test_live_categorizer_accuracy_against_seed_labels():
    try:
        llm_client.resolve_provider()
    except llm_client.LLMNotConfigured:
        pytest.skip("LLM provider is not configured.")

    rows = _label_rows()
    candidates = [
        categorizer.CategorizationCandidate(
            row["description"],
            credit=row["credit"],
        )
        for row in rows
    ]
    batch = categorizer.categorize(candidates)

    assert batch.error == ""
    assert batch.attempted_count == len(rows)
    assert _accuracy(batch.labels, rows) >= 0.80

    heuristic_labels = {
        (row["description"].upper(), row["credit"]): _heuristic_category(
            row["description"],
            row["credit"],
        )
        for row in rows
    }
    assert _accuracy(batch.labels, rows) >= _accuracy(heuristic_labels, rows)
