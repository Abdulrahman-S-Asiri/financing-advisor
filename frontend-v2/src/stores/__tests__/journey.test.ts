import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import journeyFixture from "@/lib/__fixtures__/journey.json";
import { api } from "@/lib/api";
import {
  applicationRecordSchema,
  journeyResponseSchema,
  simulationResponseSchema,
  type AgentEvent,
  type JourneyResponse,
  type SimulationResponse,
} from "@/lib/schemas";
import { strings } from "@/lib/strings";
import { useJourneyStore, type JourneyRequest } from "@/stores/journey";

const journey = journeyResponseSchema.parse(journeyFixture);
const request: JourneyRequest = {
  personaId: "ahmed_borderline",
  amount: 80000,
  tenor: 48,
  age: 28,
};

const simulation = simulationResponseSchema.parse({
  requested_amount: 76000,
  requested_tenor_months: 48,
  salary_transfer: true,
  max_affordable_new_installment: journey.max_affordable_new_installment,
  matches: journey.matches.slice(0, 2),
});

const application = applicationRecordSchema.parse({
  application_id: "app_1",
  journey_id: journey.journey_id,
  offer_id: journey.matches[0].offer_id,
  status: "draft",
  summary: {
    institution: journey.matches[0].institution,
    product: journey.matches[0].product,
    monthly_installment: journey.matches[0].monthly_installment,
    total_amount_payable: journey.matches[0].total_amount_payable,
    simulation_notice_ar: "طلب تجريبي.",
  },
  history: [
    {
      status: "draft",
      message_ar: "تم تجهيز الطلب التجريبي.",
      created_at: "2026-07-06T10:00:00.000Z",
    },
  ],
  simulation: true,
});

function encodedSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        frames.forEach((frame) => controller.enqueue(encoder.encode(frame)));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

function storedState(): Record<string, unknown> {
  const raw = sessionStorage.getItem("athar-journey");
  expect(raw).toBeTruthy();
  return JSON.parse(raw!).state as Record<string, unknown>;
}

function completionFrame(data: JourneyResponse): string {
  const payload = { ...data };
  delete (payload as Partial<JourneyResponse>).events;
  const event: AgentEvent = {
    ...data.events[data.events.length - 1],
    type: "journey_completed",
    payload,
  };
  return `event: journey_completed\ndata: ${JSON.stringify(event)}\n\n`;
}

function eventFrame(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

beforeEach(() => {
  useJourneyStore.getState().resetAll();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  useJourneyStore.getState().resetAll();
  sessionStorage.clear();
});

describe("journey store persistence", () => {
  it("persists journey, filters, simulation, application, and chat state only", () => {
    useJourneyStore.setState({
      journey,
      request,
      liveEvents: journey.events,
      running: true,
      journeyError: "temporary",
      simulation,
      simulating: true,
      simulationError: "temporary",
      statusFilter: "eligible",
      structureFilter: "murabaha",
      sortMode: "apr",
      compareIds: [journey.matches[0].offer_id],
      application,
      applicationBusy: true,
      applicationError: "temporary",
      selectedOfferId: journey.matches[0].offer_id,
      chatMessages: [
        { role: "user", text: "سؤال" },
        { role: "advisor", text: "إجابة", fallback: true },
      ],
      chatBusy: true,
      chatError: "temporary",
    });

    const persisted = storedState();

    expect(persisted.journey).toMatchObject({ journey_id: journey.journey_id });
    expect(persisted.request).toEqual(request);
    expect(persisted.simulation).toMatchObject({ requested_amount: 76000 });
    expect(persisted.statusFilter).toBe("eligible");
    expect(persisted.structureFilter).toBe("murabaha");
    expect(persisted.sortMode).toBe("apr");
    expect(persisted.compareIds).toEqual([journey.matches[0].offer_id]);
    expect(persisted.application).toMatchObject({ application_id: "app_1" });
    expect(persisted.selectedOfferId).toBe(journey.matches[0].offer_id);
    expect(persisted.chatMessages).toHaveLength(2);

    expect(persisted.liveEvents).toBeUndefined();
    expect(persisted.running).toBeUndefined();
    expect(persisted.journeyError).toBeUndefined();
    expect(persisted.simulating).toBeUndefined();
    expect(persisted.simulationError).toBeUndefined();
    expect(persisted.applicationBusy).toBeUndefined();
    expect(persisted.applicationError).toBeUndefined();
    expect(persisted.chatBusy).toBeUndefined();
    expect(persisted.chatError).toBeUndefined();
  });

  it("rehydrates persisted values while keeping transient flags at defaults", async () => {
    sessionStorage.setItem(
      "athar-journey",
      JSON.stringify({
        state: {
          journey,
          request,
          simulation,
          statusFilter: "conditional",
          structureFilter: "tawarruq",
          sortMode: "total",
          compareIds: [journey.matches[1].offer_id],
          application,
          selectedOfferId: journey.matches[1].offer_id,
          chatMessages: [{ role: "user", text: "هل السعر مؤكد؟" }],
        },
        version: 0,
      }),
    );

    await useJourneyStore.persist.rehydrate();
    const state = useJourneyStore.getState();

    expect(state.journey?.journey_id).toBe(journey.journey_id);
    expect(state.request).toEqual(request);
    expect(state.simulation?.requested_amount).toBe(76000);
    expect(state.statusFilter).toBe("conditional");
    expect(state.structureFilter).toBe("tawarruq");
    expect(state.sortMode).toBe("total");
    expect(state.application?.application_id).toBe("app_1");
    expect(state.chatMessages).toHaveLength(1);

    expect(state.liveEvents).toEqual([]);
    expect(state.running).toBe(false);
    expect(state.simulating).toBe(false);
    expect(state.applicationBusy).toBe(false);
    expect(state.chatBusy).toBe(false);
  });
});

describe("journey store actions", () => {
  it("runs the streamed journey and persists the completed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      encodedSseResponse([eventFrame(journey.events[0]), completionFrame(journey)]),
    );
    globalThis.fetch = fetchMock;

    await expect(useJourneyStore.getState().runJourney(request)).resolves.toBe(true);

    const state = useJourneyStore.getState();
    expect(state.journey?.journey_id).toBe(journey.journey_id);
    expect(state.journey?.events).toEqual([journey.events[0]]);
    expect(state.liveEvents).toEqual([journey.events[0]]);
    expect(state.running).toBe(false);
    expect(storedState().journey).toMatchObject({ journey_id: journey.journey_id });
    expect(fetchMock).toHaveBeenCalledWith(
      "/backend/journey/connect/stream",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          persona_id: request.personaId,
          requested_amount: request.amount,
          requested_tenor_months: request.tenor,
          age: request.age,
          nationality: "saudi",
        }),
      }),
    );
  });

  it("keeps an incomplete stream out of persisted journey state", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(encodedSseResponse([eventFrame(journey.events[0])]));

    await expect(useJourneyStore.getState().runJourney(request)).resolves.toBe(false);

    const state = useJourneyStore.getState();
    expect(state.journey).toBeNull();
    expect(state.running).toBe(false);
    expect(state.journeyError).toBe(strings.journey.streamIncomplete);
    expect(storedState().journey).toBeNull();
  });

  it("stores simulations and clears compare selections", async () => {
    useJourneyStore.setState({
      journey,
      compareIds: [journey.matches[0].offer_id, journey.matches[1].offer_id],
    });
    vi.spyOn(api, "simulate").mockResolvedValue(simulation as SimulationResponse);

    await useJourneyStore.getState().simulate(76000, 48, true);

    const state = useJourneyStore.getState();
    expect(state.simulation?.requested_amount).toBe(76000);
    expect(state.compareIds).toEqual([]);
    expect(state.simulating).toBe(false);
    expect(storedState().simulation).toMatchObject({ requested_amount: 76000 });
  });

  it("limits comparison selections to three offers and toggles existing selections", () => {
    const [first, second, third, fourth] = journey.matches.map((match) => match.offer_id);

    useJourneyStore.getState().toggleCompare(first);
    useJourneyStore.getState().toggleCompare(second);
    useJourneyStore.getState().toggleCompare(third);
    useJourneyStore.getState().toggleCompare(fourth);

    expect(useJourneyStore.getState().compareIds).toEqual([first, second, third]);

    useJourneyStore.getState().toggleCompare(second);

    expect(useJourneyStore.getState().compareIds).toEqual([first, third]);
  });

  it("streams chat with persona context and persists the final transcript", async () => {
    useJourneyStore.setState({ journey });
    const fetchMock = vi.fn().mockResolvedValue(
      encodedSseResponse([
        'event: delta\ndata: {"delta":"مرح"}\n\n',
        'event: delta\ndata: {"delta":"با"}\n\n',
        'event: done\ndata: {"reply":"مرحبا","guardrail_fallback":true}\n\n',
      ]),
    );
    globalThis.fetch = fetchMock;

    await useJourneyStore.getState().sendChat(" ما أفضل خيار؟ ");

    const state = useJourneyStore.getState();
    expect(state.chatBusy).toBe(false);
    expect(state.chatMessages).toEqual([
      { role: "user", text: "ما أفضل خيار؟" },
      { role: "advisor", text: "مرحبا", fallback: true },
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      persona_id: journey.profile.persona_id,
      journey_id: journey.journey_id,
      message: "ما أفضل خيار؟",
    });
    expect(storedState().chatMessages).toHaveLength(2);
  });
});
