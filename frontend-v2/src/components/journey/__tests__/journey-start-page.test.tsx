import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JourneyStartPage } from "@/components/journey/JourneyStartPage";
import { strings } from "@/lib/strings";
import { useJourneyStore, type JourneyRequest } from "@/stores/journey";

const routerPush = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/journey",
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
  }),
}));

const originalRunJourney = useJourneyStore.getState().runJourney;

afterEach(async () => {
  routerPush.mockReset();
  routerReplace.mockReset();
  await act(async () => {
    useJourneyStore.getState().resetAll();
    useJourneyStore.setState({ runJourney: originalRunJourney });
  });
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("JourneyStartPage", () => {
  it("preselects a valid persona from the route query", () => {
    render(<JourneyStartPage initialPersonaId="sara_strong" />);

    expect(screen.getByRole("button", { name: /سارة/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(strings.journey.amountLabel)).toHaveValue(60000);
    expect(screen.getByLabelText(strings.journey.tenorLabel)).toHaveValue(36);
    expect(screen.getByLabelText(strings.journey.ageLabel)).toHaveValue(31);
  });

  it("blocks invalid input with inline Arabic messages", async () => {
    const runJourney = vi.fn();
    useJourneyStore.setState({ runJourney });
    render(<JourneyStartPage initialPersonaId="ahmed_borderline" />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText(strings.journey.amountLabel), {
        target: { value: "4000" },
      });
      fireEvent.change(screen.getByLabelText(strings.journey.tenorLabel), {
        target: { value: "7" },
      });
      fireEvent.change(screen.getByLabelText(strings.journey.ageLabel), {
        target: { value: "17" },
      });
      fireEvent.click(screen.getByRole("button", { name: strings.journey.submit }));
    });

    expect(await screen.findByText(strings.journey.amountInvalid)).toBeInTheDocument();
    expect(screen.getByText(strings.journey.tenorInvalid)).toBeInTheDocument();
    expect(screen.getByText(strings.journey.ageInvalid)).toBeInTheDocument();
    expect(screen.getByText(strings.journey.consentRequired)).toBeInTheDocument();
    expect(runJourney).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("runs a valid journey and navigates to analysis", async () => {
    const runJourney = vi
      .fn<(request: JourneyRequest) => Promise<boolean>>()
      .mockResolvedValue(true);
    useJourneyStore.setState({ runJourney });
    render(<JourneyStartPage initialPersonaId="khalid_rejected" />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(strings.journey.consentLabel));
      fireEvent.click(screen.getByRole("button", { name: strings.journey.submit }));
    });

    await waitFor(() => {
      expect(runJourney).toHaveBeenCalledWith({
        personaId: "khalid_rejected",
        amount: 50000,
        tenor: 36,
        age: 35,
      });
    });
    expect(routerPush).toHaveBeenCalledWith("/journey/analysis");
  });

  it("prevents double submit while a journey run is pending", async () => {
    let resolveRun!: (value: boolean) => void;
    const runJourney = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRun = resolve;
        }),
    );
    useJourneyStore.setState({
      runJourney: runJourney as (request: JourneyRequest) => Promise<boolean>,
    });
    render(<JourneyStartPage initialPersonaId="ahmed_borderline" />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(strings.journey.consentLabel));
    });
    const submit = screen.getByRole("button", { name: strings.journey.submit });
    await act(async () => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });

    expect(runJourney).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(submit).toBeDisabled());

    await act(async () => {
      resolveRun(true);
    });
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/journey/analysis"));
  });
});
