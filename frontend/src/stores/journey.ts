// The single journey store. Persisted to sessionStorage so navigating to the
// offer-detail route (or reloading) never loses the journey — the v1 defect
// this rebuild exists to fix. Busy flags and live-stream state are not
// persisted; only serializable results are.
"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { api, ApiError, postStream } from "@/lib/api";
import type { MatchStatus, PersonaId, SortMode } from "@/lib/data";
import {
  agentEventSchema,
  chatStreamPayloadSchema,
  journeyResponseSchema,
  type AgentEvent,
  type ApplicationRecord,
  type ChatMessage,
  type JourneyResponse,
  type SimulationResponse,
} from "@/lib/schemas";
import { consumeSseResponse, parseSseEvent } from "@/lib/sse";
import { strings } from "@/lib/strings";

export type JourneyRequest = {
  personaId: PersonaId;
  amount: number;
  tenor: number;
  age: number;
};

type JourneyStore = {
  journey: JourneyResponse | null;
  request: JourneyRequest | null;
  liveEvents: AgentEvent[];
  running: boolean;
  journeyError: string;

  simulation: SimulationResponse | null;
  simulating: boolean;
  simulationError: string;

  statusFilter: "all" | MatchStatus;
  structureFilter: string;
  sortMode: SortMode;
  compareIds: string[];

  application: ApplicationRecord | null;
  applicationBusy: boolean;
  applicationError: string;
  selectedOfferId: string;

  chatMessages: ChatMessage[];
  chatBusy: boolean;
  chatError: string;

  runJourney: (request: JourneyRequest) => Promise<boolean>;
  simulate: (amount: number, tenor: number, salaryTransfer: boolean) => Promise<void>;
  resetSimulation: () => void;
  setStatusFilter: (value: "all" | MatchStatus) => void;
  setStructureFilter: (value: string) => void;
  setSortMode: (value: SortMode) => void;
  resetFilters: () => void;
  toggleCompare: (offerId: string) => void;
  selectOffer: (offerId: string) => void;
  createDraft: (offerId: string) => Promise<void>;
  applicationAction: (action: "submit" | "advance") => Promise<void>;
  sendChat: (question: string) => Promise<void>;
  resetAll: () => void;
};

const initialResults = {
  journey: null,
  request: null,
  liveEvents: [] as AgentEvent[],
  running: false,
  journeyError: "",
  simulation: null,
  simulating: false,
  simulationError: "",
  statusFilter: "all" as const,
  structureFilter: "all",
  sortMode: "ranked" as const,
  compareIds: [] as string[],
  application: null,
  applicationBusy: false,
  applicationError: "",
  selectedOfferId: "",
  chatMessages: [] as ChatMessage[],
  chatBusy: false,
  chatError: "",
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export const useJourneyStore = create<JourneyStore>()(
  persist(
    (set, get) => ({
      ...initialResults,

      async runJourney(request) {
        // A new run replaces everything from the previous journey.
        set({ ...initialResults, request, running: true });

        try {
          const response = await postStream("/backend/journey/connect/stream", {
            persona_id: request.personaId,
            requested_amount: request.amount,
            requested_tenor_months: request.tenor,
            age: request.age,
            nationality: "saudi",
          });
          if (!response.ok) {
            const body = (await response.json().catch(() => null)) as {
              detail?: string;
            } | null;
            throw new Error(body?.detail ?? strings.journey.runError);
          }

          const streamed: AgentEvent[] = [];
          let completed: JourneyResponse | null = null;

          await consumeSseResponse(response, (rawEvent) => {
            const frame = parseSseEvent<unknown>(rawEvent);
            if (!frame) {
              return;
            }
            if (frame.event === "journey_completed") {
              // The completion frame's payload is the journey response
              // (without events); events were streamed individually.
              const payload = (frame.data as { payload?: unknown }).payload;
              completed = journeyResponseSchema.parse({
                ...(payload as Record<string, unknown>),
                events: streamed,
              });
              return;
            }
            const event = agentEventSchema.parse(frame.data);
            streamed.push(event);
            set({ liveEvents: [...streamed] });
          });

          if (!completed) {
            throw new Error(strings.journey.streamIncomplete);
          }
          set({ journey: completed, running: false });
          return true;
        } catch (error) {
          set({
            running: false,
            journeyError: errorMessage(error, strings.journey.runError),
          });
          return false;
        }
      },

      async simulate(amount, tenor, salaryTransfer) {
        const journey = get().journey;
        if (!journey) {
          return;
        }
        set({ simulating: true, simulationError: "" });
        try {
          const simulation = await api.simulate({
            journey_id: journey.journey_id,
            requested_amount: amount,
            requested_tenor_months: tenor,
            salary_transfer: salaryTransfer,
          });
          set({ simulation, simulating: false, compareIds: [] });
        } catch (error) {
          set({
            simulating: false,
            simulationError: errorMessage(error, strings.journey.simulateError),
          });
        }
      },

      resetSimulation() {
        set({ simulation: null, simulationError: "", compareIds: [] });
      },

      setStatusFilter(value) {
        set({ statusFilter: value });
      },
      setStructureFilter(value) {
        set({ structureFilter: value });
      },
      setSortMode(value) {
        set({ sortMode: value });
      },
      resetFilters() {
        set({ statusFilter: "all", structureFilter: "all" });
      },

      toggleCompare(offerId) {
        const current = get().compareIds;
        if (current.includes(offerId)) {
          set({ compareIds: current.filter((id) => id !== offerId) });
        } else if (current.length < 3) {
          set({ compareIds: [...current, offerId] });
        }
      },

      selectOffer(offerId) {
        set({ selectedOfferId: offerId });
      },

      async createDraft(offerId) {
        const journey = get().journey;
        if (!journey) {
          return;
        }
        set({ applicationBusy: true, applicationError: "" });
        try {
          const application = await api.applicationDraft({
            journey_id: journey.journey_id,
            offer_id: offerId,
          });
          set({ application, applicationBusy: false });
        } catch (error) {
          set({
            applicationBusy: false,
            applicationError: errorMessage(error, strings.journey.applicationError),
          });
        }
      },

      async applicationAction(action) {
        const application = get().application;
        if (!application) {
          return;
        }
        set({ applicationBusy: true, applicationError: "" });
        try {
          const updated = await api.applicationAction(application.application_id, action);
          set({ application: updated, applicationBusy: false });
        } catch (error) {
          set({
            applicationBusy: false,
            applicationError: errorMessage(error, strings.journey.applicationError),
          });
        }
      },

      async sendChat(question) {
        const journey = get().journey;
        const trimmed = question.trim();
        if (!journey || !trimmed || get().chatBusy) {
          return;
        }
        set({
          chatBusy: true,
          chatError: "",
          chatMessages: [...get().chatMessages, { role: "user", text: trimmed }],
        });

        const appendDelta = (delta: string) => {
          const messages = [...get().chatMessages];
          const last = messages[messages.length - 1];
          if (last?.role === "advisor") {
            messages[messages.length - 1] = { ...last, text: `${last.text}${delta}` };
          } else {
            messages.push({ role: "advisor", text: delta });
          }
          set({ chatMessages: messages });
        };

        // The done frame carries the full reply + guardrail flag; text is only
        // replaced when streaming delivered nothing, the flag always applies.
        const finalize = (reply: string, fallback: boolean) => {
          const messages = [...get().chatMessages];
          const last = messages[messages.length - 1];
          if (last?.role === "advisor") {
            messages[messages.length - 1] = {
              ...last,
              text: last.text || reply,
              fallback,
            };
          } else {
            messages.push({ role: "advisor", text: reply, fallback });
          }
          set({ chatMessages: messages });
        };

        try {
          const response = await postStream("/backend/advisor/chat/stream", {
            persona_id: journey.profile.persona_id,
            journey_id: journey.journey_id,
            message: trimmed,
          });
          if (!response.ok) {
            if (response.status === 503) {
              throw new Error(strings.journey.chatNoProvider);
            }
            const body = (await response.json().catch(() => null)) as {
              detail?: string;
            } | null;
            throw new Error(body?.detail ?? strings.journey.chatError);
          }

          await consumeSseResponse(response, (rawEvent) => {
            const frame = parseSseEvent<unknown>(rawEvent);
            if (!frame) {
              return;
            }
            if (frame.event === "done") {
              const payload = chatStreamPayloadSchema.parse(frame.data);
              finalize(payload.reply ?? "", payload.guardrail_fallback === true);
              return;
            }
            const delta = (frame.data as { delta?: string }).delta;
            if (typeof delta === "string") {
              appendDelta(delta);
            }
          });
          set({ chatBusy: false });
        } catch (error) {
          set({
            chatBusy: false,
            chatError: errorMessage(error, strings.journey.chatError),
          });
        }
      },

      resetAll() {
        set({ ...initialResults });
      },
    }),
    {
      name: "athar-journey",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        journey: state.journey,
        request: state.request,
        simulation: state.simulation,
        statusFilter: state.statusFilter,
        structureFilter: state.structureFilter,
        sortMode: state.sortMode,
        compareIds: state.compareIds,
        application: state.application,
        selectedOfferId: state.selectedOfferId,
        chatMessages: state.chatMessages,
      }),
    },
  ),
);
