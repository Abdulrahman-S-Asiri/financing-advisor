import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JourneyOffersPage } from "@/components/journey/JourneyOffersPage";
import journeyFixture from "@/lib/__fixtures__/journey.json";
import {
  journeyResponseSchema,
  simulationResponseSchema,
  type JourneyResponse,
} from "@/lib/schemas";
import { strings } from "@/lib/strings";
import { useJourneyStore, type JourneyRequest } from "@/stores/journey";

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/journey/offers",
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
const originalSimulate = useJourneyStore.getState().simulate;

function setJourneyState(state: Partial<ReturnType<typeof useJourneyStore.getState>>) {
  act(() => {
    useJourneyStore.setState(state);
  });
}

function khalidRejectedJourney(): JourneyResponse {
  return journeyResponseSchema.parse({
    ...journeyFixture,
    profile: {
      ...journeyFixture.profile,
      persona_id: "khalid_rejected",
    },
    matches: journeyFixture.matches.map((match) => ({
      ...match,
      status: "ineligible",
      reasons: ["إجمالي الالتزامات يتجاوز الحد المسموح لهذه الشريحة."],
      near_miss_suggestions: [],
    })),
  });
}

afterEach(async () => {
  routerReplace.mockReset();
  await act(async () => {
    useJourneyStore.getState().resetAll();
    useJourneyStore.setState({ simulate: originalSimulate });
  });
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("JourneyOffersPage", () => {
  it("renders ranked offers with detail links and unverified-rate labels", () => {
    setJourneyState({ journey, request });

    render(<JourneyOffersPage />);

    expect(
      screen.getByRole("heading", { name: strings.offers.title, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Riyad Bank")).toBeInTheDocument();
    expect(screen.getAllByText(strings.common.unverifiedRate).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: strings.offers.detailsLink })[0]).toHaveAttribute(
      "href",
      `/journeys/${journey.journey_id}/offers/${journey.matches[0].offer_id}`,
    );
    expect(
      screen.getByRole("link", { name: strings.offers.continueToDecision }),
    ).toHaveAttribute("href", "/journey/decision");
  });

  it("filters to an empty state and resets filters", async () => {
    setJourneyState({ journey, request, statusFilter: "policy_review" });

    render(<JourneyOffersPage />);

    expect(screen.getByText(strings.offers.emptyFiltered)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: strings.offers.showAll }));

    await waitFor(() => {
      expect(screen.getByText("Riyad Bank")).toBeInTheDocument();
    });
  });

  it("shows selected compare offers with Arabic structure labels", () => {
    setJourneyState({
      journey,
      request,
      compareIds: [
        journey.matches[0].offer_id,
        journey.matches[1].offer_id,
        journey.matches[3].offer_id,
      ],
    });

    render(<JourneyOffersPage />);

    expect(screen.getAllByText("مرابحة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("تورق").length).toBeGreaterThan(0);
    expect(screen.getAllByText("إجارة").length).toBeGreaterThan(0);
  });

  it("runs the simulator from the panel inputs", async () => {
    const simulate = vi.fn<(amount: number, tenor: number, salaryTransfer: boolean) => Promise<void>>();
    simulate.mockResolvedValue();
    setJourneyState({ journey, request, simulate });

    render(<JourneyOffersPage />);

    fireEvent.change(screen.getByLabelText(strings.journey.amountLabel), {
      target: { value: "70000" },
    });
    fireEvent.change(screen.getByLabelText(strings.journey.tenorLabel), {
      target: { value: "36" },
    });
    fireEvent.click(screen.getByLabelText(strings.offers.salaryTransferLabel));
    fireEvent.click(screen.getByRole("button", { name: strings.offers.runSimulation }));

    await waitFor(() => {
      expect(simulate).toHaveBeenCalledWith(70000, 36, true);
    });
  });

  it("shows skeletons while simulating", () => {
    setJourneyState({ journey, request, simulating: true });

    render(<JourneyOffersPage />);

    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it("shows changed khalid statuses after a lower-amount simulation", () => {
    const khalidJourney = khalidRejectedJourney();
    const simulation = simulationResponseSchema.parse({
      requested_amount: 30000,
      requested_tenor_months: 36,
      salary_transfer: true,
      max_affordable_new_installment: khalidJourney.max_affordable_new_installment,
      matches: [
        { ...khalidJourney.matches[0], status: "eligible", reasons: [] },
        ...khalidJourney.matches.slice(1),
      ],
    });

    setJourneyState({
      journey: khalidJourney,
      request: { personaId: "khalid_rejected", amount: 50000, tenor: 36, age: 35 },
      statusFilter: "eligible",
    });

    render(<JourneyOffersPage />);

    expect(screen.getByText(strings.offers.emptyFiltered)).toBeInTheDocument();

    act(() => {
      useJourneyStore.setState({ simulation });
    });

    expect(screen.getByText(khalidJourney.matches[0].institution)).toBeInTheDocument();
    expect(screen.getByText(strings.offers.sourceSimulation)).toBeInTheDocument();
  });

  it("redirects empty deep visits back to the journey start", async () => {
    render(<JourneyOffersPage />);

    expect(screen.getByText(strings.journey.guardStart)).toBeInTheDocument();
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/journey");
    });
  });
});
