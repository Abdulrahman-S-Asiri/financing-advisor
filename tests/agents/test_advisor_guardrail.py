import json

from agents import advisor, llm_client
from core.models import (
    Category,
    CostBreakdown,
    DbrDecision,
    EmploymentType,
    FinancialProfile,
    MatchResult,
    MatchStatus,
    Offer,
    Structure,
)


def _profile() -> FinancialProfile:
    return FinancialProfile(
        persona_id="test",
        gross_salary=10_000,
        employment_type=EmploymentType.PRIVATE,
        age=30,
        salary_bank="Bank A",
    )


def _match() -> MatchResult:
    offer = Offer(
        id="o1",
        institution="Bank A",
        product_name="Personal Finance",
        category=Category.PERSONAL,
        structure=Structure.TAWARRUQ,
        flat_rate_annual=0.05,
        admin_fee_pct=0.01,
        admin_fee_cap_sar=5_000,
        min_amount=10_000,
        max_amount=200_000,
        min_tenor_months=12,
        max_tenor_months=60,
        min_gross_salary=4_000,
        salary_transfer_required=True,
        eligible_employment=["private"],
        nationality="both",
        max_age_at_maturity=60,
        rate_verified=False,
    )
    cost = CostBreakdown(
        principal=50_000,
        tenor_months=36,
        flat_rate_annual=0.05,
        monthly_installment=1_597.22,
        total_profit=7_500,
        admin_fee=500,
        total_amount_payable=58_000,
        apr_effective=0.102,
    )
    return MatchResult(offer=offer, status=MatchStatus.ELIGIBLE, cost=cost)


def _completion(
    text: str,
    input_tokens: int = 10,
    output_tokens: int = 5,
    tool_results: list[llm_client.LLMToolResult] | None = None,
):
    return llm_client.LLMCompletion(
        text=text,
        usage=llm_client.LLMUsage(
            provider="anthropic",
            model="test-model",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        ),
        tool_results=tool_results or [],
    )


def _match_with_dbr() -> MatchResult:
    match = _match()
    match.dbr = DbrDecision(
        passes=True,
        tier="<=15k",
        salary_linked_ratio=0.18,
        non_real_estate_ratio=0.18,
        total_ratio=0.18,
        salary_linked_cap=1 / 3,
        non_real_estate_cap=0.45,
        total_cap=0.55,
    )
    return match


def test_guardrail_accepts_percent_form_of_context_decimals():
    # Context carries apr_effective=0.102 as a decimal; stating it as a
    # percentage must not trip the guardrail.
    context = advisor.build_context(_profile(), [_match()], 2_000)

    assert advisor.unsupported_numbers("النسبة السنوية الفعلية هي 10.2%", context) == []
    assert advisor.unsupported_numbers("The effective APR is 10.2%.", context) == []


def test_guardrail_accepts_two_decimal_percent_of_long_ratio():
    # salary_linked_cap is 1/3 = 0.3333333... in the DBR tool result; the
    # natural two-decimal phrasing is 33.33%.
    context = advisor.build_context(_profile(), [_match_with_dbr()], 2_000)
    context += advisor._tool_results_context([
        llm_client.LLMToolResult(
            tool_use_id="toolu_1",
            name="evaluate_dbr",
            input={"new_installment": 1_000},
            result={"salary_linked_cap": 1 / 3, "total_cap": 0.55},
            round_number=1,
        )
    ])

    assert advisor.unsupported_numbers("الحد الأقصى هو 33.33%", context) == []
    assert advisor.unsupported_numbers("The total cap is 55%.", context) == []


def test_guardrail_still_blocks_percent_numbers_absent_from_context():
    context = advisor.build_context(_profile(), [_match_with_dbr()], 2_000)

    # 10.5% has no 0.105 in context; 9.4% is a model-side rounding of 0.102
    # territory; 33.4% is outside the tolerance around 1/3. All must block.
    assert advisor.unsupported_numbers("The APR is 10.5%.", context) == ["10.5%"]
    assert advisor.unsupported_numbers("Roughly 9.4% per year.", context) == ["9.4%"]
    assert advisor.unsupported_numbers("The cap is 33.4%.", context) == ["33.4%"]


def test_guardrail_percent_equivalence_needs_the_percent_sign():
    # A bare "10.2" (no % marker) still requires a verbatim context match —
    # the ratio equivalence never loosens unmarked numbers.
    context = advisor.build_context(_profile(), [_match()], 2_000)

    assert advisor.unsupported_numbers("القيمة هي 10.2", context) == ["10.2"]


def test_advisor_does_not_retry_for_percent_phrasing(monkeypatch):
    calls = {"count": 0}

    def fake_complete(_system, _user, _tools, _handlers):
        calls["count"] += 1
        return _completion("النسبة السنوية الفعلية هي 10.2% والقسط 1,597.22.")

    monkeypatch.setattr(advisor.llm_client, "complete_with_tools", fake_complete)

    result = advisor.chat_with_trace(_profile(), [_match()], 2_000, "ما هي النسبة؟")

    assert calls["count"] == 1
    assert result.guardrail_retries == 0
    assert "10.2%" in result.reply


def test_advisor_retries_when_reply_contains_unsupported_number(monkeypatch):
    replies = iter([
        "القسط هو 1,597.22 والرقم 999 غير مدعوم.",
        "القسط هو 1,597.22 حسب نتائج المحرك.",
    ])
    monkeypatch.setattr(
        advisor.llm_client,
        "complete_with_tools",
        lambda _system, _user, _tools, _handlers: _completion(next(replies)),
    )

    reply = advisor.chat(_profile(), [_match()], 2_000, "ما هو القسط؟")

    assert reply == "القسط هو 1,597.22 حسب نتائج المحرك."


def test_advisor_context_excludes_full_payment_schedule():
    context = json.loads(advisor.build_context(_profile(), [_match()], 2_000))
    match = context["matches"][0]

    assert "payment_schedule" not in match
    assert "cost" not in match
    assert match["payment_schedule_months"] == 36
    assert match["monthly_installment"] == 1_597.22


def test_advisor_returns_fallback_when_retry_still_contains_unsupported_number(
    monkeypatch,
):
    replies = iter([
        "القسط هو 1,597.22 والرقم 999 غير مدعوم.",
        "الرقم 888 غير مدعوم أيضاً.",
    ])
    monkeypatch.setattr(
        advisor.llm_client,
        "complete_with_tools",
        lambda _system, _user, _tools, _handlers: _completion(next(replies)),
    )

    result = advisor.chat_with_trace(_profile(), [_match()], 2_000, "ما هو القسط؟")

    assert "أرقام غير موجودة" in result.reply
    assert result.guardrail_fallback is True


def test_guardrail_fallback_flag_is_false_on_clean_and_retried_replies(monkeypatch):
    replies = iter([
        "القسط هو 1,597.22 والرقم 999 غير مدعوم.",
        "القسط هو 1,597.22 حسب نتائج المحرك.",
    ])
    monkeypatch.setattr(
        advisor.llm_client,
        "complete_with_tools",
        lambda _system, _user, _tools, _handlers: _completion(next(replies)),
    )

    result = advisor.chat_with_trace(_profile(), [_match()], 2_000, "ما هو القسط؟")

    assert result.guardrail_retries == 1
    assert result.guardrail_fallback is False


def test_advisor_trace_accumulates_usage_after_retry(monkeypatch):
    replies = iter([
        _completion("القسط هو 1,597.22 والرقم 999 غير مدعوم.", 20, 7),
        _completion("القسط هو 1,597.22 حسب نتائج المحرك.", 25, 6),
    ])
    monkeypatch.setattr(
        advisor.llm_client,
        "complete_with_tools",
        lambda _system, _user, _tools, _handlers: next(replies),
    )

    result = advisor.chat_with_trace(_profile(), [_match()], 2_000, "ما هو القسط؟")

    assert result.reply == "القسط هو 1,597.22 حسب نتائج المحرك."
    assert result.guardrail_retries == 1
    assert result.unsupported_numbers == ["999"]
    assert result.usage["provider"] == "anthropic"
    assert result.usage["model"] == "test-model"
    assert result.usage["input_tokens"] == 45
    assert result.usage["output_tokens"] == 13
    assert result.usage["total_tokens"] == 58
    assert result.usage["model_calls"] == 2


def test_advisor_allows_numbers_returned_by_deterministic_tools(monkeypatch):
    def fake_complete(_system, _user, _tools, handlers):
        tool_result = handlers["simulate_scenario"]({
            "requested_amount": 60_000,
            "requested_tenor_months": 36,
        })
        installment = tool_result["matches"][0]["monthly_installment"]
        return _completion(
            f"القسط في المحاكاة هو {installment}.",
            tool_results=[
                llm_client.LLMToolResult(
                    tool_use_id="toolu_1",
                    name="simulate_scenario",
                    input={
                        "requested_amount": 60_000,
                        "requested_tenor_months": 36,
                    },
                    result=tool_result,
                    round_number=1,
                )
            ],
        )

    monkeypatch.setattr(advisor.llm_client, "complete_with_tools", fake_complete)

    result = advisor.chat_with_trace(
        _profile(),
        [_match()],
        2_000,
        "احسب محاكاة 60000 ريال.",
    )

    assert result.guardrail_retries == 0
    assert result.tool_results == [
        {"tool": "simulate_scenario", "round": 1, "is_error": False}
    ]
    assert "القسط في المحاكاة" in result.reply
