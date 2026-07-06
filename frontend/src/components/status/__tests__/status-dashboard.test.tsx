import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatusDashboard } from "@/components/status/StatusDashboard";
import { personas } from "@/lib/data";
import { api } from "@/lib/api";
import {
  analyticsOverviewSchema,
  healthzSchema,
  offerVerificationSchema,
  openBankingStatusSchema,
} from "@/lib/schemas";
import { strings } from "@/lib/strings";

const health = healthzSchema.parse({
  status: "ok",
  ok: true,
  catalog_valid: true,
  offers_loaded: 8,
  postgres_enabled: false,
  llm_configured: false,
  open_banking_provider: "mock",
  version: "test",
});

const verification = offerVerificationSchema.parse({
  total_offers: 8,
  verified_count: 0,
  unverified_count: 8,
  missing_source_count: 8,
  stale_verified_count: 0,
  target_min_offers: 5,
  ready_for_public_demo: false,
  issues: [
    {
      offer_id: "offer-1",
      institution: "مصرف تجريبي",
      severity: "warning",
      code: "unverified_rate",
      message: "سعر غير مؤكد",
    },
  ],
});

const openBanking = openBankingStatusSchema.parse({
  provider: "mock",
  mock_mode: true,
});

const analytics = analyticsOverviewSchema.parse({
  journeys: {
    total: 2,
    with_path_forward: 1,
  },
  applications: {
    total: 1,
    status_counts: {
      draft: 1,
    },
  },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StatusDashboard", () => {
  it("loads all status cards independently and refreshes manually", async () => {
    const healthSpy = vi.spyOn(api, "healthz").mockResolvedValue(health);
    const verificationSpy = vi.spyOn(api, "offerVerification").mockResolvedValue(verification);
    const openBankingSpy = vi.spyOn(api, "openBankingStatus").mockResolvedValue(openBanking);
    const analyticsSpy = vi.spyOn(api, "analyticsOverview").mockResolvedValue(analytics);

    render(<StatusDashboard />);

    expect(await screen.findByText("0 / 8")).toBeInTheDocument();
    expect(screen.getByText("test")).toBeInTheDocument();
    expect(screen.getByText("mock")).toBeInTheDocument();
    expect(screen.getByText("unverified_rate × 1")).toBeInTheDocument();
    personas.forEach((persona) => {
      expect(screen.getByRole("link", { name: new RegExp(persona.name) })).toHaveAttribute(
        "href",
        `/journey?persona=${persona.id}`,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: strings.status.refresh }));
    await waitFor(() => {
      expect(healthSpy).toHaveBeenCalledTimes(2);
      expect(verificationSpy).toHaveBeenCalledTimes(2);
      expect(openBankingSpy).toHaveBeenCalledTimes(2);
      expect(analyticsSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("shows exact backend recovery guidance when the API is down", async () => {
    vi.spyOn(api, "healthz").mockRejectedValue(new Error("down"));
    vi.spyOn(api, "offerVerification").mockRejectedValue(new Error("down"));
    vi.spyOn(api, "openBankingStatus").mockRejectedValue(new Error("down"));
    vi.spyOn(api, "analyticsOverview").mockRejectedValue(new Error("down"));

    render(<StatusDashboard />);

    expect(await screen.findByText(strings.status.serviceDown)).toBeInTheDocument();
    expect(screen.getByText(strings.status.serviceCommand)).toBeInTheDocument();
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
  });
});
