"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { applicationStatuses, personas, stages } from "./data";
import {
  formatSar,
  sortableValue,
  statusCounts,
} from "./format";
import { parseSseEvent } from "./sse";
import type {
  AgentEvent,
  ApplicationRecord,
  ChatMessage,
  ChatStreamPayload,
  JourneyResponse,
  MatchStatus,
  OfferMatch,
  Persona,
  SimulationResponse,
  SortMode,
  StageKey,
} from "./types";
import type { DefineStageProps } from "./stages/DefineStage";
import type { DeliverStageProps } from "./stages/DeliverStage";
import type { DevelopStageProps } from "./stages/DevelopStage";
import DiscoverStage from "./stages/DiscoverStage";

const DefineStage = dynamic<DefineStageProps>(
  () => import("./stages/DefineStage"),
  { loading: StageLoading },
);
const DevelopStage = dynamic<DevelopStageProps>(
  () => import("./stages/DevelopStage"),
  { loading: StageLoading },
);
const DeliverStage = dynamic<DeliverStageProps>(
  () => import("./stages/DeliverStage"),
  { loading: StageLoading },
);

function StageLoading() {
  return (
    <section className="emptyState">
      <h3>جاري تحميل الواجهة</h3>
    </section>
  );
}

export default function JourneyApp({
  initialPersonaId,
}: {
  initialPersonaId?: string;
}) {
  // Resolved once before the hooks so /journey?persona=<id> can seed the
  // form; unknown ids quietly fall back to the first persona.
  const initialPersona =
    personas.find((persona) => persona.id === initialPersonaId) ?? personas[0];

  const [activeStage, setActiveStage] = useState<StageKey>("discover");
  const [selectedPersona, setSelectedPersona] = useState<Persona>(initialPersona);
  const [requestedAmount, setRequestedAmount] = useState(initialPersona.amount);
  const [requestedTenor, setRequestedTenor] = useState(initialPersona.tenor);
  const [age, setAge] = useState(initialPersona.age);
  const [consent, setConsent] = useState(true);
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [liveEvents, setLiveEvents] = useState<AgentEvent[]>([]);
  const [journeyError, setJourneyError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | MatchStatus>("all");
  const [structureFilter, setStructureFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("ranked");
  const [chatInput, setChatInput] = useState("ما أفضل خيار متاح ولماذا؟");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [applicationError, setApplicationError] = useState("");
  const [isApplicationLoading, setIsApplicationLoading] = useState(false);
  const [selectedApplicationOfferId, setSelectedApplicationOfferId] = useState("");
  const [simulatorAmount, setSimulatorAmount] = useState(initialPersona.amount);
  const [simulatorTenor, setSimulatorTenor] = useState(initialPersona.tenor);
  const [simulatorSalaryTransfer, setSimulatorSalaryTransfer] = useState(false);
  const [simulatedMatches, setSimulatedMatches] = useState<OfferMatch[] | null>(null);
  const [simulatorError, setSimulatorError] = useState("");
  const [isSimulatorLoading, setIsSimulatorLoading] = useState(false);
  const [compareOfferIds, setCompareOfferIds] = useState<string[]>([]);

  const activeMatches = useMemo(
    () => simulatedMatches ?? journey?.matches ?? [],
    [journey, simulatedMatches],
  );
  const deferredActiveMatches = useDeferredValue(activeMatches);

  const counts = useMemo(() => statusCounts(deferredActiveMatches), [deferredActiveMatches]);

  const visibleMatches = useMemo(() => {
    if (!journey) {
      return [];
    }
    let matches = deferredActiveMatches;
    if (filter !== "all") {
      matches = matches.filter((match) => match.status === filter);
    }
    if (structureFilter !== "all") {
      matches = matches.filter((match) => match.structure === structureFilter);
    }
    if (sortMode === "ranked") {
      return matches;
    }
    return [...matches].sort(
      (a, b) => sortableValue(a, sortMode) - sortableValue(b, sortMode),
    );
  }, [journey, deferredActiveMatches, filter, structureFilter, sortMode]);

  const compareMatches = useMemo(
    () =>
      compareOfferIds
        .map((offerId) => deferredActiveMatches.find((match) => match.offer_id === offerId))
        .filter((match): match is OfferMatch => Boolean(match)),
    [deferredActiveMatches, compareOfferIds],
  );

  const recommendedMatch = useMemo(() => {
    if (!journey) {
      return null;
    }
    return (
      journey.matches.find((match) => match.status === "eligible") ??
      journey.matches.find((match) => match.status === "conditional") ??
      null
    );
  }, [journey]);

  const applicationCandidates = useMemo(() => {
    if (!journey) {
      return [];
    }
    return journey.matches.filter((match) => applicationStatuses.includes(match.status));
  }, [journey]);

  const selectedApplicationMatch = useMemo(
    () =>
      applicationCandidates.find(
        (match) => match.offer_id === selectedApplicationOfferId,
      ) ??
      recommendedMatch ??
      applicationCandidates[0] ??
      null,
    [applicationCandidates, recommendedMatch, selectedApplicationOfferId],
  );

  const applyPersona = useCallback(function applyPersona(persona: Persona) {
    setSelectedPersona(persona);
    setRequestedAmount(persona.amount);
    setRequestedTenor(persona.tenor);
    setAge(persona.age);
    setSimulatorAmount(persona.amount);
    setSimulatorTenor(persona.tenor);
    setSimulatorSalaryTransfer(false);
    setSimulatedMatches(null);
    setCompareOfferIds([]);
    setSelectedApplicationOfferId("");
    setFilter("all");
    setStructureFilter("all");
    setSortMode("ranked");
  }, []);

  async function submitJourney(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setJourneyError("");
    setJourney(null);
    setLiveEvents([]);
    setFilter("all");
    setStructureFilter("all");
    setSortMode("ranked");
    setChatMessages([]);
    setChatError("");
    setApplication(null);
    setApplicationError("");
    setSelectedApplicationOfferId("");
    setSimulatorAmount(requestedAmount);
    setSimulatorTenor(requestedTenor);
    setSimulatorSalaryTransfer(false);
    setSimulatedMatches(null);
    setSimulatorError("");
    setCompareOfferIds([]);
    setActiveStage("define");

    try {
      const response = await fetch("/backend/journey/connect/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: selectedPersona.id,
          requested_amount: requestedAmount,
          requested_tenor_months: requestedTenor,
          age,
          nationality: "saudi",
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "تعذر تشغيل رحلة التمويل.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("تعذر قراءة بث رحلة التمويل.");
      }

      const streamedEvents: AgentEvent[] = [];
      const decoder = new TextDecoder();
      let buffer = "";
      let completedJourney: JourneyResponse | null = null;

      const handleFrame = (rawEvent: string) => {
        const parsed = parseSseEvent<AgentEvent>(rawEvent);
        if (!parsed) {
          return;
        }

        const agentEvent = parsed.data;
        if (parsed.event === "journey_completed") {
          const payload = agentEvent.payload as unknown as Omit<
            JourneyResponse,
            "events"
          >;
          completedJourney = {
            ...payload,
            events: [...streamedEvents],
          };
          setJourney(completedJourney);
          return;
        }

        streamedEvents.push(agentEvent);
        setLiveEvents([...streamedEvents]);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          handleFrame(rawEvent);
        }
      }

      if (buffer.trim()) {
        handleFrame(buffer);
      }

      if (!completedJourney) {
        throw new Error("لم يكتمل بث رحلة التمويل.");
      }
    } catch (error) {
      setActiveStage("discover");
      setJourneyError(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!journey || !chatInput.trim()) {
      return;
    }

    const nextQuestion = chatInput.trim();
    setChatInput("");
    setChatError("");
    setIsChatLoading(true);
    setChatMessages((messages) => [...messages, { role: "user", text: nextQuestion }]);

    const appendAdvisorDelta = (delta: string) => {
      setChatMessages((messages) => {
        const nextMessages = [...messages];
        const lastMessage = nextMessages[nextMessages.length - 1];
        if (lastMessage?.role === "advisor") {
          nextMessages[nextMessages.length - 1] = {
            ...lastMessage,
            text: `${lastMessage.text}${delta}`,
          };
          return nextMessages;
        }
        return [...nextMessages, { role: "advisor", text: delta }];
      });
    };

    // The done frame carries the full reply plus the guardrail flag; text is
    // only replaced when streaming delivered nothing, but the flag is always
    // applied so fallback replies render visibly marked.
    const finalizeAdvisorReply = (reply: string, fallback: boolean) => {
      setChatMessages((messages) => {
        const nextMessages = [...messages];
        const lastMessage = nextMessages[nextMessages.length - 1];
        if (lastMessage?.role === "advisor") {
          nextMessages[nextMessages.length - 1] = {
            ...lastMessage,
            text: lastMessage.text || reply,
            fallback,
          };
        }
        return nextMessages;
      });
    };

    const handleChatFrame = (rawEvent: string) => {
      const parsed = parseSseEvent<ChatStreamPayload>(rawEvent);
      if (parsed?.event === "delta" && parsed.data.delta) {
        appendAdvisorDelta(parsed.data.delta);
      }
      if (parsed?.event === "done" && parsed.data.reply) {
        finalizeAdvisorReply(
          parsed.data.reply,
          parsed.data.guardrail_fallback === true,
        );
      }
    };

    try {
      const response = await fetch("/backend/advisor/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: journey.profile.persona_id,
          journey_id: journey.journey_id,
          message: nextQuestion,
        }),
      });

      if (!response.ok) {
        // 503 = LLM provider not configured; keep the demo message friendly
        // and actionable instead of surfacing the raw English detail.
        if (response.status === 503) {
          throw new Error(
            "المستشار يحتاج مفتاح مزود لغوي. أضف ANTHROPIC_API_KEY في ملف .env ثم أعد تشغيل الخادم — بقية الرحلة تعمل بدونه.",
          );
        }
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "تعذر تشغيل المستشار.");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("تعذر قراءة بث المستشار.");
      }

      setChatMessages((messages) => [...messages, { role: "advisor", text: "" }]);

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          handleChatFrame(rawEvent);
        }
      }

      if (buffer.trim()) {
        handleChatFrame(buffer);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "المستشار غير متاح حالياً.");
    } finally {
      setIsChatLoading(false);
    }
  }

  const updateSimulatorAmount = useCallback(function updateSimulatorAmount(value: number) {
    setSimulatorAmount(value);
    setSimulatedMatches(null);
    setSimulatorError("");
  }, []);

  const updateSimulatorTenor = useCallback(function updateSimulatorTenor(value: number) {
    setSimulatorTenor(value);
    setSimulatedMatches(null);
    setSimulatorError("");
  }, []);

  const updateSimulatorSalaryTransfer = useCallback(function updateSimulatorSalaryTransfer(
    value: boolean,
  ) {
    setSimulatorSalaryTransfer(value);
    setSimulatedMatches(null);
    setSimulatorError("");
  }, []);

  const resetSimulation = useCallback(function resetSimulation() {
    setSimulatorAmount(requestedAmount);
    setSimulatorTenor(requestedTenor);
    setSimulatorSalaryTransfer(false);
    setSimulatedMatches(null);
    setSimulatorError("");
  }, [requestedAmount, requestedTenor]);

  async function runSimulation() {
    if (!journey) {
      return;
    }
    setIsSimulatorLoading(true);
    setSimulatorError("");
    try {
      const response = await fetch("/backend/advisor/tools/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journey_id: journey.journey_id,
          requested_amount: simulatorAmount,
          requested_tenor_months: simulatorTenor,
          salary_transfer: simulatorSalaryTransfer,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "تعذر تشغيل المحاكاة.");
      }

      const body = (await response.json()) as SimulationResponse;
      setSimulatedMatches(body.matches);
    } catch (error) {
      setSimulatorError(error instanceof Error ? error.message : "تعذر تشغيل المحاكاة.");
    } finally {
      setIsSimulatorLoading(false);
    }
  }

  const toggleCompareOffer = useCallback(function toggleCompareOffer(offerId: string) {
    setCompareOfferIds((current) => {
      if (current.includes(offerId)) {
        return current.filter((id) => id !== offerId);
      }
      if (current.length >= 3) {
        return current;
      }
      return [...current, offerId];
    });
  }, []);

  async function createApplication(offerId: string) {
    if (!journey) {
      return;
    }
    setIsApplicationLoading(true);
    setApplicationError("");
    try {
      const response = await fetch("/backend/applications/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journey_id: journey.journey_id,
          offer_id: offerId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "تعذر تجهيز الطلب التجريبي.");
      }
      setApplication((await response.json()) as ApplicationRecord);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : "تعذر تجهيز الطلب التجريبي.");
    } finally {
      setIsApplicationLoading(false);
    }
  }

  async function updateApplication(action: "submit" | "advance") {
    if (!application) {
      return;
    }
    setIsApplicationLoading(true);
    setApplicationError("");
    try {
      const response = await fetch(`/backend/applications/${application.application_id}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "تعذر تحديث حالة الطلب.");
      }
      setApplication((await response.json()) as ApplicationRecord);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : "تعذر تحديث حالة الطلب.");
    } finally {
      setIsApplicationLoading(false);
    }
  }

  return (
    <main className="appShell">
      <aside className="stageRail" aria-label="مراحل Double Diamond">
        <div className="brandBlock">
          <span className="brandMark">FA</span>
          <div>
            <p className="eyebrow">Double Diamond</p>
            <h1>مستشار التمويل</h1>
          </div>
        </div>

        <nav className="stageList">
          {stages.map((stage, index) => {
            const isLocked = stage.key !== "discover" && !journey;
            return (
              <button
                key={stage.key}
                className={`stageButton ${activeStage === stage.key ? "stageActive" : ""}`}
                type="button"
                disabled={isLocked}
                onClick={() => setActiveStage(stage.key)}
              >
                <span className="stageDiamond" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  <strong>{stage.label}</strong>
                  <small>{stage.title}</small>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="railSummary">
          <span>العروض المؤهلة</span>
          <strong>{counts.eligible + counts.conditional}</strong>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">رحلة قرار التمويل</p>
            <h2>{stages.find((stage) => stage.key === activeStage)?.title}</h2>
          </div>
          <div className="topbarStats" aria-label="ملخص الرحلة">
            <span>{selectedPersona.name}</span>
            <span>{formatSar(requestedAmount)}</span>
            <span>{requestedTenor} شهر</span>
          </div>
        </header>

        <section className="diamondMap" aria-label="خريطة Double Diamond">
          {stages.map((stage) => (
            <button
              key={stage.key}
              type="button"
              className={`diamondStep ${activeStage === stage.key ? "diamondStepActive" : ""}`}
              disabled={stage.key !== "discover" && !journey}
              onClick={() => setActiveStage(stage.key)}
            >
              <span>{stage.label}</span>
              <strong>{stage.metric}</strong>
            </button>
          ))}
        </section>

        {activeStage === "discover" && (
          <DiscoverStage
            age={age}
            consent={consent}
            isLoading={isLoading}
            journeyError={journeyError}
            requestedAmount={requestedAmount}
            requestedTenor={requestedTenor}
            selectedPersona={selectedPersona}
            onAgeChange={setAge}
            onAmountChange={setRequestedAmount}
            onConsentChange={setConsent}
            onPersonaChange={applyPersona}
            onSubmit={submitJourney}
            onTenorChange={setRequestedTenor}
          />
        )}

        {activeStage === "define" && (
          <DefineStage
            isLoading={isLoading}
            journey={journey}
            liveEvents={liveEvents}
            onBack={() => setActiveStage("discover")}
          />
        )}

        {activeStage === "develop" && (
          <DevelopStage
            compareMatches={compareMatches}
            compareOfferIds={compareOfferIds}
            filter={filter}
            hasSimulation={simulatedMatches !== null}
            isSimulatorLoading={isSimulatorLoading}
            journey={journey}
            simulatorAmount={simulatorAmount}
            simulatorError={simulatorError}
            simulatorSalaryTransfer={simulatorSalaryTransfer}
            simulatorTenor={simulatorTenor}
            sortMode={sortMode}
            structureFilter={structureFilter}
            visibleMatches={visibleMatches}
            onFilterChange={setFilter}
            onSortModeChange={setSortMode}
            onStructureFilterChange={setStructureFilter}
            onSimulatorAmountChange={updateSimulatorAmount}
            onSimulatorReset={resetSimulation}
            onSimulatorRun={runSimulation}
            onSimulatorSalaryTransferChange={updateSimulatorSalaryTransfer}
            onSimulatorTenorChange={updateSimulatorTenor}
            onToggleCompare={toggleCompareOffer}
            onFiltersReset={() => {
              setFilter("all");
              setStructureFilter("all");
            }}
          />
        )}

        {activeStage === "deliver" && (
          <DeliverStage
            chatError={chatError}
            chatInput={chatInput}
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            application={application}
            applicationCandidates={applicationCandidates}
            applicationError={applicationError}
            isApplicationLoading={isApplicationLoading}
            journey={journey}
            recommendedMatch={recommendedMatch}
            selectedApplicationMatch={selectedApplicationMatch}
            onApplicationAdvance={() => updateApplication("advance")}
            onApplicationCreate={(offerId) => createApplication(offerId)}
            onApplicationOfferSelect={setSelectedApplicationOfferId}
            onApplicationSubmit={() => updateApplication("submit")}
            onChatInputChange={setChatInput}
            onChatSubmit={submitChat}
          />
        )}
      </section>
    </main>
  );
}
