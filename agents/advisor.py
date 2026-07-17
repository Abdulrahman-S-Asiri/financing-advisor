"""Advisor agent: the conversational layer over the deterministic engine.

Architecture rule enforced here, and worth saying out loud in the pitch:
LLMs ORCHESTRATE AND EXPLAIN; CODE CALCULATES. The advisor receives the
engine's already-computed numbers as context and is instructed to never
produce a number that is not in that context. A bank's judging panel will
probe exactly this.

Extension path (port your stock_agents orchestrator here):
  ProfileAgent   -> LLM categorization of ambiguous transaction descriptions
  MatchingAgent  -> tool-calls core.eligibility per offer
  AdvisorAgent   -> this file
  ApplicationAgent -> roadmap slide only for the hackathon
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from typing import Any

from agents import advisor_tools, llm_client
from core import dbr
from core.models import FinancialProfile, MatchResult

SYSTEM = """You are a Saudi consumer-financing advisor inside a licensed-style \
finance aggregation platform.

Hard rules:
1. NEVER invent, estimate, or recompute any number. Every figure you state \
(installment, APR, ratio, cap, headroom) must appear verbatim in the CONTEXT \
JSON or a TOOL RESULT. If a number is missing, call the relevant tool or say \
the engine has not computed it.
2. Eligibility outcomes come only from the engine. You may explain WHY using \
the provided reasons/conditions, and what could change the outcome.
3. Explain Islamic finance structures (tawarruq, murabaha, ijarah) plainly \
when asked. Compare offers on total amount payable and APR.
4. Use tools for what-if simulations, full offer detail, payment schedules, \
or DBR evaluations that are not already in CONTEXT.
5. Reply in the user's language (Arabic or English). Be concise and concrete.
6. You are not the lender. Final approval always rests with the institution.
"""

_DIGIT_TRANSLATION = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_NUMBER_RE = re.compile(r"(?<![\w])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?")


@dataclass(frozen=True)
class AdvisorChatResult:
    reply: str
    usage: dict
    guardrail_retries: int = 0
    unsupported_numbers: list[str] | None = None
    # True only when the reply is the deterministic safe fallback (both model
    # attempts contained unsupported numbers). The API forwards this so the UI
    # can mark the message honestly instead of string-matching the prose.
    guardrail_fallback: bool = False
    tool_results: list[dict] | None = None


ADVISOR_TOOL_DEFINITIONS = [
    {
        "name": "simulate_scenario",
        "description": (
            "Run deterministic matching and pricing for a requested amount, "
            "tenor, and optional salary-transfer scenario."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "requested_amount": {"type": "number"},
                "requested_tenor_months": {"type": "integer"},
                "salary_transfer": {"type": "boolean"},
            },
            "required": ["requested_amount", "requested_tenor_months"],
        },
    },
    {
        "name": "get_offer_detail",
        "description": (
            "Return deterministic full detail for one offer in the current journey."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"offer_id": {"type": "string"}},
            "required": ["offer_id"],
        },
    },
    {
        "name": "get_payment_schedule",
        "description": (
            "Return the deterministic month-by-month payment schedule for one offer."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"offer_id": {"type": "string"}},
            "required": ["offer_id"],
        },
    },
    {
        "name": "evaluate_dbr",
        "description": (
            "Evaluate SAMA debt-burden ratios for a proposed new installment."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "new_installment": {"type": "number"},
                "new_is_salary_linked": {"type": "boolean"},
                "new_is_real_estate": {"type": "boolean"},
            },
            "required": ["new_installment"],
        },
    },
]


def build_context(profile: FinancialProfile, matches: list[MatchResult],
                  max_affordable: float) -> str:
    payload = {
        "profile": {
            "persona_id": profile.persona_id,
            "gross_salary": profile.gross_salary,
            "other_monthly_income_avg": profile.other_monthly_income_avg,
            "total_monthly_income": profile.total_monthly_income,
            "employment_type": profile.employment_type.value,
            "is_retiree": profile.is_retiree,
            "age": profile.age,
            "nationality": profile.nationality,
            "salary_linked_obligations": profile.salary_linked_obligations,
            "other_obligations": profile.other_obligations,
            "real_estate_obligations": profile.real_estate_obligations,
            "salary_bank": profile.salary_bank,
            "salary_stability_score": profile.salary_stability_score,
            "obligation_trend": profile.obligation_trend,
            "confidence_level": profile.confidence_level,
        },
        "total_monthly_income_after_16b_haircut": profile.total_monthly_income,
        "max_affordable_new_installment": max_affordable,
        "matches": [
            {
                "offer_id": m.offer.id,
                "institution": m.offer.institution,
                "product": m.offer.product_name,
                "structure": m.offer.structure.value,
                "status": m.status.value,
                "monthly_installment": (
                    m.cost.monthly_installment if m.cost else None
                ),
                "apr_effective": m.cost.apr_effective if m.cost else None,
                "total_amount_payable": (
                    m.cost.total_amount_payable if m.cost else None
                ),
                "payment_schedule_months": m.cost.tenor_months if m.cost else 0,
                "reasons": m.reasons[:2],
                "conditions": m.conditions[:2],
                "rate_verified": m.offer.rate_verified,
                "source_url": m.offer.source_url,
                "retrieved_at": m.offer.retrieved_at,
                "near_miss_suggestions": [
                    asdict(suggestion) for suggestion in m.near_miss_suggestions
                ],
            }
            for m in matches
        ],
    }
    return json.dumps(payload, ensure_ascii=False, default=str)


def _tool_results_for_trace(
    results: list[llm_client.LLMToolResult],
) -> list[dict]:
    return [
        {
            "tool": result.name,
            "round": result.round_number,
            "is_error": result.is_error,
        }
        for result in results
    ]


def _tool_results_context(results: list[llm_client.LLMToolResult]) -> str:
    if not results:
        return ""
    payload = [
        {
            "tool": result.name,
            "round": result.round_number,
            "result": result.result,
        }
        for result in results
    ]
    return "\n\nTOOL RESULTS:\n" + json.dumps(payload, ensure_ascii=False, default=str)


def _require_number(payload: dict[str, Any], key: str) -> float:
    value = payload.get(key)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise advisor_tools.AdvisorToolError(f"{key} must be a number.")
    return float(value)


def _require_int(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise advisor_tools.AdvisorToolError(f"{key} must be an integer.")
    return value


def _require_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise advisor_tools.AdvisorToolError(f"{key} must be a non-empty string.")
    return value.strip()


def _bool_value(payload: dict[str, Any], key: str, default: bool) -> bool:
    value = payload.get(key, default)
    if not isinstance(value, bool):
        raise advisor_tools.AdvisorToolError(f"{key} must be a boolean.")
    return value


def _unique_offers(matches: list[MatchResult]):
    offers = []
    seen: set[str] = set()
    for match in matches:
        if match.offer.id in seen:
            continue
        offers.append(match.offer)
        seen.add(match.offer.id)
    return offers


def _advisor_tool_handlers(
    profile: FinancialProfile,
    matches: list[MatchResult],
) -> dict[str, llm_client.ToolHandler]:
    offers = _unique_offers(matches)

    def simulate_scenario(payload: dict[str, Any]) -> dict:
        return advisor_tools.simulate(
            profile,
            offers,
            _require_number(payload, "requested_amount"),
            _require_int(payload, "requested_tenor_months"),
            salary_transfer=_bool_value(payload, "salary_transfer", False),
        )

    def get_offer_detail(payload: dict[str, Any]) -> dict:
        return advisor_tools.get_offer_detail(
            matches,
            _require_string(payload, "offer_id"),
        )

    def get_payment_schedule(payload: dict[str, Any]) -> dict:
        offer_id = _require_string(payload, "offer_id")
        return {
            "offer_id": offer_id,
            "payment_schedule": advisor_tools.get_payment_schedule(matches, offer_id),
        }

    def evaluate_dbr(payload: dict[str, Any]) -> dict:
        decision = dbr.evaluate(
            profile,
            new_installment=_require_number(payload, "new_installment"),
            new_is_salary_linked=_bool_value(
                payload, "new_is_salary_linked", True
            ),
            new_is_real_estate=_bool_value(payload, "new_is_real_estate", False),
        )
        return asdict(decision)

    return {
        "simulate_scenario": simulate_scenario,
        "get_offer_detail": get_offer_detail,
        "get_payment_schedule": get_payment_schedule,
        "evaluate_dbr": evaluate_dbr,
    }


def _number_tokens(text: str) -> list[str]:
    normalized = text.translate(_DIGIT_TRANSLATION)
    return _NUMBER_RE.findall(normalized)


def _number_value(token: str) -> float | None:
    normalized = token.replace(",", "").rstrip("%")
    try:
        return round(float(normalized), 6)
    except ValueError:
        return None


# Half of 0.01 percentage points: wide enough that a two-decimal percentage
# (33.33%) matches its long-decimal context ratio (0.3333333...), narrow
# enough that a model-rounded figure (9.4% for 0.0937) stays blocked.
_PERCENT_RATIO_TOLERANCE = 5e-5


def _supported(token: str, value: float, allowed: set[float]) -> bool:
    """The engine stores rates as decimals (apr_effective: 0.102) while the
    advisor naturally states them as percentages (10.2%). A percent-marked
    token is therefore also supported when its /100 ratio appears in the
    context; unmarked numbers still require a verbatim match."""
    if value in allowed:
        return True
    if token.endswith("%"):
        ratio = value / 100.0
        return any(abs(ratio - candidate) <= _PERCENT_RATIO_TOLERANCE for candidate in allowed)
    return False


def unsupported_numbers(reply: str, context: str) -> list[str]:
    allowed = {
        value
        for token in _number_tokens(context)
        if (value := _number_value(token)) is not None
    }
    blocked: list[str] = []
    seen: set[float] = set()
    for token in _number_tokens(reply):
        value = _number_value(token)
        if value is None or value in seen or _supported(token, value, allowed):
            continue
        blocked.append(token)
        seen.add(value)
    return blocked


def _fallback_reply(user_message: str) -> str:
    if re.search(r"[\u0600-\u06ff]", user_message):
        return (
            "لا أستطيع إصدار إجابة آمنة الآن لأن الرد احتوى على أرقام غير موجودة "
            "في نتائج المحرك. أعد السؤال بصيغة أضيق أو شغل المحاكاة أولاً."
        )
    return (
        "I cannot safely answer that because the generated reply included "
        "numbers that were not present in the engine results. Re-run the "
        "simulation first or ask a narrower question."
    )


def _usage_payload(completions: list[llm_client.LLMCompletion]) -> dict:
    if not completions:
        return {
            "provider": "none",
            "model": "none",
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "total_tokens": 0,
            "model_calls": 0,
        }

    provider = completions[-1].usage.provider
    model = completions[-1].usage.model
    if any(item.usage.provider != provider for item in completions):
        provider = "mixed"
    if any(item.usage.model != model for item in completions):
        model = "mixed"

    input_tokens = sum(item.usage.input_tokens for item in completions)
    output_tokens = sum(item.usage.output_tokens for item in completions)
    cache_creation = sum(
        item.usage.cache_creation_input_tokens for item in completions
    )
    cache_read = sum(item.usage.cache_read_input_tokens for item in completions)
    return {
        "provider": provider,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_creation_input_tokens": cache_creation,
        "cache_read_input_tokens": cache_read,
        "total_tokens": input_tokens + output_tokens,
        "model_calls": sum(item.model_calls for item in completions),
    }


def _complete_advisor(
    context: str,
    user_message: str,
    profile: FinancialProfile,
    matches: list[MatchResult],
) -> llm_client.LLMCompletion:
    user = f"CONTEXT:\n{context}\n\nUSER QUESTION:\n{user_message}"
    return llm_client.complete_with_tools(
        SYSTEM,
        user,
        ADVISOR_TOOL_DEFINITIONS,
        _advisor_tool_handlers(profile, matches),
    )


def chat_with_trace(
    profile: FinancialProfile,
    matches: list[MatchResult],
    max_affordable: float,
    user_message: str,
) -> AdvisorChatResult:
    context = build_context(profile, matches, max_affordable)
    completions: list[llm_client.LLMCompletion] = []
    completion = _complete_advisor(context, user_message, profile, matches)
    completions.append(completion)
    reply = completion.text
    tool_results = list(completion.tool_results)
    guardrail_context = context + _tool_results_context(tool_results)
    blocked = unsupported_numbers(reply, guardrail_context)
    if not blocked:
        return AdvisorChatResult(
            reply=reply,
            usage=_usage_payload(completions),
            tool_results=_tool_results_for_trace(tool_results),
        )

    retry_user = (
        f"{user_message}\n\nNUMBER FIDELITY CHECK FAILED:\n"
        f"The previous reply included unsupported numbers: {', '.join(blocked)}.\n"
        "Rewrite the answer without any number that is absent from CONTEXT."
    )
    retry_context = guardrail_context
    retry_completion = _complete_advisor(retry_context, retry_user, profile, matches)
    completions.append(retry_completion)
    tool_results.extend(retry_completion.tool_results)
    retry_guardrail_context = context + _tool_results_context(tool_results)
    retry_blocked = unsupported_numbers(retry_completion.text, retry_guardrail_context)
    if retry_blocked:
        return AdvisorChatResult(
            reply=_fallback_reply(user_message),
            usage=_usage_payload(completions),
            guardrail_retries=1,
            unsupported_numbers=blocked + retry_blocked,
            guardrail_fallback=True,
            tool_results=_tool_results_for_trace(tool_results),
        )
    return AdvisorChatResult(
        reply=retry_completion.text,
        usage=_usage_payload(completions),
        guardrail_retries=1,
        unsupported_numbers=blocked,
        tool_results=_tool_results_for_trace(tool_results),
    )


def chat(profile: FinancialProfile, matches: list[MatchResult],
         max_affordable: float, user_message: str) -> str:
    return chat_with_trace(profile, matches, max_affordable, user_message).reply
