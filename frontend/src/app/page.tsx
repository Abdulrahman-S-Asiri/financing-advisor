"use client";

import dynamic from "next/dynamic";
import { useDeferredValue, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { applicationStatuses, personas, stages } from "../features/journey/data";
import {
  formatSar,
  sortableValue,
  statusCounts,
} from "../features/journey/format";
import { parseSseEvent } from "../features/journey/sse";
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
} from "../features/journey/types";
import type { DefineStageProps } from "../features/journey/stages/DefineStage";
import type { DeliverStageProps } from "../features/journey/stages/DeliverStage";
import type { DevelopStageProps } from "../features/journey/stages/DevelopStage";
import type { DiscoverStageProps } from "../features/journey/stages/DiscoverStage";

const DiscoverStage = dynamic<DiscoverStageProps>(
  () => import("../features/journey/stages/DiscoverStage"),
  { loading: StageLoading, ssr: false },
);
const DefineStage = dynamic<DefineStageProps>(
  () => import("../features/journey/stages/DefineStage"),
  { loading: StageLoading, ssr: false },
);
const DevelopStage = dynamic<DevelopStageProps>(
  () => import("../features/journey/stages/DevelopStage"),
  { loading: StageLoading, ssr: false },
);
const DeliverStage = dynamic<DeliverStageProps>(
  () => import("../features/journey/stages/DeliverStage"),
  { loading: StageLoading, ssr: false },
);

function StageLoading() {
  return (
    <section className="emptyState">
      <h3>جاري تحميل الواجهة</h3>
    </section>
  );
}

export default function Home() {
  const [activeStage, setActiveStage] = useState<StageKey>("discover");
  const [selectedPersona, setSelectedPersona] = useState<Persona>(personas[0]);
  const [requestedAmount, setRequestedAmount] = useState(personas[0].amount);
  const [requestedTenor, setRequestedTenor] = useState(personas[0].tenor);
  const [age, setAge] = useState(personas[0].age);
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
  const [simulatorAmount, setSimulatorAmount] = useState(personas[0].amount);
  const [simulatorTenor, setSimulatorTenor] = useState(personas[0].tenor);
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

  function applyPersona(persona: Persona) {
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
  }

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
        streamedEvents.push(agentEvent);
        setLiveEvents([...streamedEvents]);

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
        }
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

    const replaceEmptyAdvisorReply = (reply: string) => {
      setChatMessages((messages) => {
        const nextMessages = [...messages];
        const lastMessage = nextMessages[nextMessages.length - 1];
        if (lastMessage?.role === "advisor" && !lastMessage.text) {
          nextMessages[nextMessages.length - 1] = { ...lastMessage, text: reply };
        }
        return nextMessages;
      });
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
          const parsed = parseSseEvent<ChatStreamPayload>(rawEvent);
          if (parsed?.event === "delta" && parsed.data.delta) {
            appendAdvisorDelta(parsed.data.delta);
          }
          if (parsed?.event === "done" && parsed.data.reply) {
            replaceEmptyAdvisorReply(parsed.data.reply);
          }
        }
      }

      if (buffer.trim()) {
        const parsed = parseSseEvent<ChatStreamPayload>(buffer);
        if (parsed?.event === "delta" && parsed.data.delta) {
          appendAdvisorDelta(parsed.data.delta);
        }
        if (parsed?.event === "done" && parsed.data.reply) {
          replaceEmptyAdvisorReply(parsed.data.reply);
        }
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "المستشار غير متاح حالياً.");
    } finally {
      setIsChatLoading(false);
    }
  }

  function updateSimulatorAmount(value: number) {
    setSimulatorAmount(value);
    setSimulatedMatches(null);
    setSimulatorError("");
  }

  function updateSimulatorTenor(value: number) {
    setSimulatorTenor(value);
    setSimulatedMatches(null);
    setSimulatorError("");
  }

  function updateSimulatorSalaryTransfer(value: boolean) {
    setSimulatorSalaryTransfer(value);
    setSimulatedMatches(null);
    setSimulatorError("");
  }

  function resetSimulation() {
    setSimulatorAmount(requestedAmount);
    setSimulatorTenor(requestedTenor);
    setSimulatorSalaryTransfer(false);
    setSimulatedMatches(null);
    setSimulatorError("");
  }

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

  function toggleCompareOffer(offerId: string) {
    setCompareOfferIds((current) => {
      if (current.includes(offerId)) {
        return current.filter((id) => id !== offerId);
      }
      if (current.length >= 3) {
        return current;
      }
      return [...current, offerId];
    });
  }

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
