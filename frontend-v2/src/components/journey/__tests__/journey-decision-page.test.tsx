import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JourneyDecisionPage } from "@/components/journey/JourneyDecisionPage";
import journeyFixture from "@/lib/__fixtures__/journey.json";
import {
  applicationRecordSchema,
  journeyResponseSchema,
  type ApplicationRecord,
  type JourneyResponse,
} from "@/lib/schemas";
import { strings } from "@/lib/strings";
import { useJourneyStore, type JourneyRequest } from "@/stores/journey";

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/journey/decision",
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
const originalCreateDraft = useJourneyStore.getState().createDraft;
const originalApplicationAction = useJourneyStore.getState().applicationAction;
const originalSendChat = useJourneyStore.getState().sendChat;

function setJourneyState(state: Partial<ReturnType<typeof useJourneyStore.getState>>) {
  act(() => {
    useJourneyStore.setState(state);
  });
}

function ineligibleJourney(): JourneyResponse {
  return journeyResponseSchema.parse({
    ...journeyFixture,
    matches: journeyFixture.matches.map((match) => ({
      ...match,
      status: "ineligible",
      reasons: ["لا يوجد مسار قابل للتنفيذ حالياً."],
      conditions: [],
      near_miss_suggestions: [],
    })),
  });
}

function application(status: string): ApplicationRecord {
  return applicationRecordSchema.parse({
    application_id: "app_1",
    journey_id: journey.journey_id,
    offer_id: journey.matches[0].offer_id,
    status,
    summary: {
      institution: journey.matches[0].institution,
      product: journey.matches[0].product,
      monthly_installment: journey.matches[0].monthly_installment,
      total_amount_payable: journey.matches[0].total_amount_payable,
      simulation_notice_ar: "طلب تجريبي لا يرسل إلى أي جهة تمويلية.",
    },
    history: [
      {
        status,
        message_ar: "تم تحديث الطلب التجريبي.",
        created_at: "2026-07-06T10:00:00.000Z",
      },
    ],
    simulation: true,
  });
}

afterEach(async () => {
  routerReplace.mockReset();
  await act(async () => {
    useJourneyStore.getState().resetAll();
    useJourneyStore.setState({
      createDraft: originalCreateDraft,
      applicationAction: originalApplicationAction,
      sendChat: originalSendChat,
    });
  });
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("JourneyDecisionPage", () => {
  it("renders the recommended offer, next steps, and status link", () => {
    setJourneyState({ journey, request });

    render(<JourneyDecisionPage />);

    expect(
      screen.getByRole("heading", { name: strings.decision.metaTitle, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText(strings.decision.recommendedTitle)).toBeInTheDocument();
    expect(screen.getAllByText(journey.matches[0].institution).length).toBeGreaterThan(0);
    expect(screen.getAllByText(strings.common.unverifiedRate).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: strings.decision.nextStep1Link }),
    ).toHaveAttribute("href", "/status");
  });

  it("shows a clear no-recommendation state when all offers are blocked", () => {
    setJourneyState({ journey: ineligibleJourney(), request });

    render(<JourneyDecisionPage />);

    expect(screen.getByText(strings.decision.noRecommendation)).toBeInTheDocument();
    expect(screen.getByText(strings.decision.noCandidates)).toBeInTheDocument();
  });

  it("chooses an offer and prepares a simulated draft application", async () => {
    const createDraft = vi.fn<(offerId: string) => Promise<void>>().mockResolvedValue();
    setJourneyState({ journey, request, createDraft });

    render(<JourneyDecisionPage />);

    const chooser = screen.getByRole("group", { name: strings.decision.chooseOfferAria });
    fireEvent.click(within(chooser).getByText(journey.matches[0].institution));
    fireEvent.click(screen.getByRole("button", { name: strings.decision.prepareDraft }));

    await waitFor(() => {
      expect(createDraft).toHaveBeenCalledWith(journey.matches[0].offer_id);
    });
  });

  it("submits and advances the simulated application tracker", async () => {
    const applicationAction = vi
      .fn<(action: "submit" | "advance") => Promise<void>>()
      .mockResolvedValue();
    setJourneyState({
      journey,
      request,
      application: application("draft"),
      applicationAction,
    });

    const { rerender } = render(<JourneyDecisionPage />);

    fireEvent.click(screen.getByRole("button", { name: strings.decision.submitApplication }));
    await waitFor(() => {
      expect(applicationAction).toHaveBeenCalledWith("submit");
    });

    act(() => {
      useJourneyStore.setState({ application: application("submitted") });
    });
    rerender(<JourneyDecisionPage />);

    fireEvent.click(screen.getByRole("button", { name: strings.decision.advanceApplication }));
    await waitFor(() => {
      expect(applicationAction).toHaveBeenCalledWith("advance");
    });
  });

  it("sends advisor questions from suggested chips and renders fallback bubbles", async () => {
    const sendChat = vi.fn<(question: string) => Promise<void>>().mockResolvedValue();
    setJourneyState({
      journey,
      request,
      sendChat,
      chatMessages: [{ role: "advisor", text: "إجابة محمية", fallback: true }],
    });

    render(<JourneyDecisionPage />);

    expect(screen.getByText(strings.decision.fallbackBadge)).toBeInTheDocument();
    expect(screen.getByLabelText(strings.decision.chatInputLabel)).toHaveAttribute(
      "placeholder",
      strings.decision.chatPlaceholder,
    );
    fireEvent.click(screen.getByText(journey.suggested_questions[0]));
    fireEvent.click(screen.getByRole("button", { name: strings.decision.chatSend }));

    await waitFor(() => {
      expect(sendChat).toHaveBeenCalledWith(journey.suggested_questions[0]);
    });
  });

  it("redirects empty deep visits back to the journey start", async () => {
    render(<JourneyDecisionPage />);

    expect(screen.getByText(strings.journey.guardStart)).toBeInTheDocument();
    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/journey");
    });
  });
});
