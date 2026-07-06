import { describe, expect, it } from "vitest";

import { formatCap, formatNearMiss, formatPercent, formatSar, gaugePercent, statusCounts } from "@/lib/format";
import type { OfferMatch } from "@/lib/schemas";

describe("format helpers", () => {
  it("uses clear unavailable labels", () => {
    expect(formatSar(null)).toBe("غير متاح");
    expect(formatPercent(undefined)).toBe("غير متاح");
    expect(formatCap(null)).toBe("سياسة الممول");
  });

  it("keeps gauge percentages bounded", () => {
    expect(gaugePercent(0.2, 0.4)).toBe(50);
    expect(gaugePercent(0.5, 0.4)).toBe(100);
    expect(gaugePercent(-0.1, 0.4)).toBe(0);
  });

  it("formats near-miss suggestions with status context", () => {
    expect(
      formatNearMiss({
        kind: "lower_amount",
        message: "fallback",
        requested_amount: 71000,
        requested_tenor_months: 48,
        monthly_installment: 1745.42,
        status: "eligible",
      }),
    ).toContain("مؤهل");
  });

  it("counts offer statuses", () => {
    const matches = [
      { status: "eligible" },
      { status: "eligible" },
      { status: "ineligible" },
    ] as OfferMatch[];

    expect(statusCounts(matches)).toEqual({
      eligible: 2,
      conditional: 0,
      ineligible: 1,
      policy_review: 0,
    });
  });
});
