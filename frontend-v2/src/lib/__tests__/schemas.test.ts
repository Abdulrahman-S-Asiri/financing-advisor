import { describe, expect, it } from "vitest";

import journeyFixture from "@/lib/__fixtures__/journey.json";
import {
  journeyResponseSchema,
  paymentScheduleResponseSchema,
  simulationResponseSchema,
} from "@/lib/schemas";

describe("backend response schemas", () => {
  it("accepts a recorded journey response from the backend", () => {
    const parsed = journeyResponseSchema.parse(journeyFixture);

    expect(parsed.profile.persona_id).toBe("ahmed_borderline");
    expect(parsed.matches).toHaveLength(8);
    expect(parsed.events.length).toBeGreaterThan(0);
    expect(parsed.matches.every((match) => match.rate_verified === false)).toBe(true);
  });

  it("rejects a journey payload missing required contract keys", () => {
    const mutated: Record<string, unknown> = { ...journeyFixture };
    delete mutated.matches;

    expect(() => journeyResponseSchema.parse(mutated)).toThrow();
  });

  it("rejects near-miss rows missing required nullable fields", () => {
    const parsed = journeyResponseSchema.parse(journeyFixture);
    const matchWithNearMiss = parsed.matches.find(
      (match) => match.near_miss_suggestions.length > 0,
    );
    expect(matchWithNearMiss).toBeDefined();

    const mutated = structuredClone(journeyFixture);
    const firstNearMiss = (
      mutated.matches.find((match) => match.near_miss_suggestions.length > 0)
        ?.near_miss_suggestions[0]
    ) as Record<string, unknown> | undefined;
    expect(firstNearMiss).toBeDefined();
    delete firstNearMiss!.status;

    expect(() => journeyResponseSchema.parse(mutated)).toThrow();
  });

  it("accepts simulation metadata while enforcing match shape", () => {
    const simulationPayload = {
      requested_amount: 80000,
      requested_tenor_months: 48,
      salary_transfer: false,
      max_affordable_new_installment: 1766.66,
      matches: journeyFixture.matches,
      journey_id: journeyFixture.journey_id,
      tool: "simulate",
      event: "tool_result",
    };

    expect(simulationResponseSchema.parse(simulationPayload).matches).toHaveLength(8);
  });

  it("validates payment schedule rows explicitly", () => {
    const parsed = paymentScheduleResponseSchema.parse({
      journey_id: journeyFixture.journey_id,
      offer_id: "riyad-auto-murabaha",
      payment_schedule: [
        {
          month: 1,
          installment: 1920,
          principal_component: 1666.67,
          profit_component: 253.33,
          remaining_principal: 78333.33,
        },
      ],
    });

    expect(parsed.payment_schedule[0].month).toBe(1);
  });
});
