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

from agents import llm_client
from core import cost
from core.models import FinancialProfile, MatchResult

SYSTEM = """You are a Saudi consumer-financing advisor inside a licensed-style \
finance aggregation platform.

Hard rules:
1. NEVER invent, estimate, or recompute any number. Every figure you state \
(installment, APR, ratio, cap, headroom) must appear verbatim in the CONTEXT \
JSON. If a number is missing, say the engine has not computed it.
2. Eligibility outcomes come only from the engine. You may explain WHY using \
the provided reasons/conditions, and what could change the outcome.
3. Explain Islamic finance structures (tawarruq, murabaha, ijarah) plainly \
when asked. Compare offers on total amount payable and APR.
4. Reply in the user's language (Arabic or English). Be concise and concrete.
5. You are not the lender. Final approval always rests with the institution.
"""

_DIGIT_TRANSLATION = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_NUMBER_RE = re.compile(r"(?<![\w])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?")


@dataclass(frozen=True)
class AdvisorChatResult:
    reply: str
    usage: dict
    guardrail_retries: int = 0
    unsupported_numbers: list[str] | None = None


def build_context(profile: FinancialProfile, matches: list[MatchResult],
                  max_affordable: float) -> str:
    payload = {
        "profile": asdict(profile),
        "total_monthly_income_after_16b_haircut": profile.total_monthly_income,
        "max_affordable_new_installment": max_affordable,
        "matches": [
            {
                "institution": m.offer.institution,
                "product": m.offer.product_name,
                "structure": m.offer.structure.value,
                "status": m.status.value,
                "reasons": m.reasons,
                "conditions": m.conditions,
                "cost": asdict(m.cost) if m.cost else None,
                "payment_schedule": [
                    row.__dict__
                    for row in (
                        cost.payment_schedule(
                            m.offer,
                            m.cost.principal,
                            m.cost.tenor_months,
                        )
                        if m.cost
                        else []
                    )
                ],
                "dbr": asdict(m.dbr) if m.dbr else None,
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


def _number_tokens(text: str) -> list[str]:
    normalized = text.translate(_DIGIT_TRANSLATION)
    return _NUMBER_RE.findall(normalized)


def _number_value(token: str) -> float | None:
    normalized = token.replace(",", "").rstrip("%")
    try:
        return round(float(normalized), 6)
    except ValueError:
        return None


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
        if value is None or value in allowed or value in seen:
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
        "model_calls": len(completions),
    }


def chat_with_trace(
    profile: FinancialProfile,
    matches: list[MatchResult],
    max_affordable: float,
    user_message: str,
) -> AdvisorChatResult:
    context = build_context(profile, matches, max_affordable)
    user = f"CONTEXT:\n{context}\n\nUSER QUESTION:\n{user_message}"
    completions: list[llm_client.LLMCompletion] = []
    completion = llm_client.complete_with_usage(SYSTEM, user)
    completions.append(completion)
    reply = completion.text
    blocked = unsupported_numbers(reply, context)
    if not blocked:
        return AdvisorChatResult(reply=reply, usage=_usage_payload(completions))

    retry_user = (
        f"{user}\n\nNUMBER FIDELITY CHECK FAILED:\n"
        f"The previous reply included unsupported numbers: {', '.join(blocked)}.\n"
        "Rewrite the answer without any number that is absent from CONTEXT."
    )
    retry_completion = llm_client.complete_with_usage(SYSTEM, retry_user)
    completions.append(retry_completion)
    retry_blocked = unsupported_numbers(retry_completion.text, context)
    if retry_blocked:
        return AdvisorChatResult(
            reply=_fallback_reply(user_message),
            usage=_usage_payload(completions),
            guardrail_retries=1,
            unsupported_numbers=blocked + retry_blocked,
        )
    return AdvisorChatResult(
        reply=retry_completion.text,
        usage=_usage_payload(completions),
        guardrail_retries=1,
        unsupported_numbers=blocked,
    )


def chat(profile: FinancialProfile, matches: list[MatchResult],
         max_affordable: float, user_message: str) -> str:
    return chat_with_trace(profile, matches, max_affordable, user_message).reply
