import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OfferDetailPage } from "@/components/journey/OfferDetailPage";
import journeyFixture from "@/lib/__fixtures__/journey.json";
import { api } from "@/lib/api";
import {
  offerDetailResponseSchema,
  paymentScheduleResponseSchema,
} from "@/lib/schemas";
import { strings } from "@/lib/strings";

const baseOffer = journeyFixture.matches[0];
const detail = offerDetailResponseSchema.parse({
  journey_id: journeyFixture.journey_id,
  offer: {
    ...baseOffer,
    source_url: "https://example.com/offer",
    retrieved_at: "2026-07-06T10:00:00.000Z",
    cost_breakdown: {
      principal: 80000,
      tenor_months: 48,
      flat_rate_annual: 0.04,
      monthly_installment: 1920,
      total_profit: 12000,
      admin_fee: 960,
      total_amount_payable: 92960,
      apr_effective: 0.0791,
    },
  },
  dbr: {
    passes: true,
    tier: "<=15k",
    salary_linked_ratio: 0.32,
    non_real_estate_ratio: 0.4,
    total_ratio: 0.42,
    salary_linked_cap: 0.3333333333333333,
    non_real_estate_cap: 0.45,
    total_cap: 0.55,
    breaches: [],
    policy_review: false,
  },
});

const schedule = paymentScheduleResponseSchema.parse({
  journey_id: journeyFixture.journey_id,
  offer_id: baseOffer.offer_id,
  payment_schedule: [
    {
      month: 1,
      installment: 1920,
      principal_component: 1600,
      profit_component: 320,
      remaining_principal: 78400,
    },
    {
      month: 2,
      installment: 1920,
      principal_component: 1606,
      profit_component: 314,
      remaining_principal: 76794,
    },
  ],
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OfferDetailPage", () => {
  it("fetches direct URL detail and renders cost, DBR, source, and schedule", async () => {
    const detailSpy = vi.spyOn(api, "offerDetail").mockResolvedValue(detail);
    const scheduleSpy = vi.spyOn(api, "paymentSchedule").mockResolvedValue(schedule);

    render(<OfferDetailPage journeyId="journey-1" offerId="offer-1" />);

    expect(screen.getByRole("status")).toHaveTextContent(strings.detail.loading);
    expect(await screen.findByRole("heading", { name: baseOffer.institution })).toBeInTheDocument();

    expect(detailSpy).toHaveBeenCalledWith("journey-1", "offer-1");
    expect(scheduleSpy).toHaveBeenCalledWith("journey-1", "offer-1");
    expect(screen.getByText(strings.common.unverifiedRate)).toBeInTheDocument();
    expect(screen.getByText(strings.detail.costTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.detail.dbrTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.detail.scheduleTitle)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: strings.detail.back })).toHaveAttribute(
      "href",
      "/journey/offers",
    );
    expect(screen.getByRole("link", { name: strings.detail.sourceLink })).toHaveAttribute(
      "href",
      "https://example.com/offer",
    );
  });

  it("shows detail load errors with a back link", async () => {
    vi.spyOn(api, "offerDetail").mockRejectedValue(new Error("تعذر تحميل العرض."));
    vi.spyOn(api, "paymentSchedule").mockResolvedValue(schedule);

    render(<OfferDetailPage journeyId="journey-1" offerId="offer-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذر تحميل العرض.");
    expect(screen.getByRole("link", { name: strings.detail.back })).toHaveAttribute(
      "href",
      "/journey/offers",
    );
  });

  it("keeps the offer visible when only the schedule request fails", async () => {
    vi.spyOn(api, "offerDetail").mockResolvedValue(detail);
    vi.spyOn(api, "paymentSchedule").mockRejectedValue(
      new Error("تعذر تحميل جدول السداد."),
    );

    render(<OfferDetailPage journeyId="journey-1" offerId="offer-1" />);

    expect(await screen.findByRole("heading", { name: baseOffer.institution })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("تعذر تحميل جدول السداد.");
    });
  });
});
