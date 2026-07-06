import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JourneyAnalysisPage } from "@/components/journey/JourneyAnalysisPage";
import journeyFixture from "@/lib/__fixtures__/journey.json";
import { journeyResponseSchema } from "@/lib/schemas";
import { strings } from "@/lib/strings";
import { useJourneyStore, type JourneyRequest } from "@/stores/journey";

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/journey/analysis",
  useRouter: () => ({
    replace: routerReplace,
  }),
}));

const journey = journeyResponseSchema.parse(journeyFixture);
const request: JourneyRequest = {
  personaId: "ahmed_borderline",
  amount: 80000,
  tenor: 48,
  age: 28,
};
const originalRunJourney = useJourneyStore.getState().runJourney;

function setJourneyState(state: Partial<ReturnType<typeof useJourneyStore.getState>>) {
  act(() => {
    useJourneyStore.setState(state);
  });
}

afterEach(async () => {
  routerReplace.mockReset();
  await act(async () => {
    useJourneyStore.getState().resetAll();
    useJourneyStore.setState({ runJourney: originalRunJourney });
  });
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("JourneyAnalysisPage", () => {
  it("renders the completed financial dashboard with an aria-live timeline", () => {
    setJourneyState({ journey, liveEvents: journey.events });

    render(<JourneyAnalysisPage />);

    expect(
      screen.getByRole("heading", { name: strings.analysis.pageTitle, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(strings.analysis.metricsTitle)).toBeInTheDocument();
    expect(screen.getByText(strings.analysis.salary)).toBeInTheDocument();
    expect(screen.getByText(strings.analysis.headroom)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: strings.analysis.continueToOffers }),
    ).toHaveAttribute("href", "/journey/offers");
    expect(document.querySelector('ol[aria-live="polite"]')).toBeInTheDocument();
  });

  it("shows live stream events while the journey is running", () => {
    setJourneyState({
      journey: null,
      request,
      running: true,
      liveEvents: [journey.events[0]],
    });

    render(<JourneyAnalysisPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      strings.analysis.liveConnecting,
    );
    expect(screen.getByText(journey.events[0].message_ar)).toBeInTheDocument();
    expect(document.querySelector('ol[aria-live="polite"]')).toBeInTheDocument();
  });

  it("shows stream interruption details and retries with the saved request", () => {
    const runJourney = vi
      .fn<(savedRequest: JourneyRequest) => Promise<boolean>>()
      .mockResolvedValue(true);
    setJourneyState({
      journey: null,
      request,
      running: false,
      journeyError: "انقطع الاتصال أثناء التحليل.",
      runJourney,
    });

    render(<JourneyAnalysisPage />);

    expect(
      screen.getByRole("heading", { name: strings.analysis.interruptedTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "انقطع الاتصال أثناء التحليل.",
    );
    fireEvent.click(screen.getByRole("button", { name: strings.common.retry }));

    expect(runJourney).toHaveBeenCalledWith(request);
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("renders khalid breach messages clearly", () => {
    const breach = "إجمالي الالتزامات يتجاوز الحد المسموح لهذه الشريحة.";
    const khalidJourney = journeyResponseSchema.parse({
      ...journeyFixture,
      profile: {
        ...journeyFixture.profile,
        persona_id: "khalid_rejected",
      },
      financial_health: {
        ...journeyFixture.financial_health,
        total_ratio: 0.72,
        total_cap: 0.55,
        breaches: [breach],
      },
    });
    setJourneyState({ journey: khalidJourney, liveEvents: khalidJourney.events });

    render(<JourneyAnalysisPage />);

    expect(screen.getByText(breach)).toBeInTheDocument();
  });

  it("redirects empty deep visits back to the journey start", async () => {
    render(<JourneyAnalysisPage />);

    expect(screen.getByText(strings.journey.guardStart)).toBeInTheDocument();
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/journey");
    });
  });
});
