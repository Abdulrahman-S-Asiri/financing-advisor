"use client";

import { FormEvent, useMemo, useState } from "react";

type StageKey = "discover" | "define" | "develop" | "deliver";
type MatchStatus = "eligible" | "conditional" | "ineligible" | "policy_review";

type Persona = {
  id: string;
  name: string;
  label: string;
  summary: string;
  amount: number;
  tenor: number;
  age: number;
};

type FinancialProfile = {
  persona_id: string;
  gross_salary: number;
  other_monthly_income_avg: number;
  employment_type: string;
  is_retiree: boolean;
  age: number;
  nationality: string;
  salary_linked_obligations: number;
  other_obligations: number;
  real_estate_obligations: number;
  months_observed: number;
  salary_bank: string;
  salary_stability_score: number;
  obligation_trend: string;
  confidence_level: string;
  detection_notes: string[];
  total_monthly_income: number;
};

type AgentEvent = {
  journey_id: string;
  sequence: number;
  type: string;
  agent: string | null;
  message_ar: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type NearMissSuggestion = {
  kind: string;
  message: string;
  requested_amount: number | null;
  requested_tenor_months: number | null;
  monthly_installment: number | null;
  status: MatchStatus | null;
};

type PaymentScheduleRow = {
  month: number;
  installment: number;
  principal_component: number;
  profit_component: number;
  remaining_principal: number;
};

type OfferMatch = {
  offer_id: string;
  institution: string;
  product: string;
  structure: string;
  status: MatchStatus;
  monthly_installment: number | null;
  apr_effective: number | null;
  total_amount_payable: number | null;
  payment_schedule: PaymentScheduleRow[];
  reasons: string[];
  conditions: string[];
  rate_verified: boolean;
  source_url: string;
  retrieved_at: string;
  near_miss_suggestions: NearMissSuggestion[];
};

type JourneyResponse = {
  journey_id: string;
  profile: FinancialProfile;
  max_affordable_new_installment: number;
  matches: OfferMatch[];
  events: AgentEvent[];
  suggested_questions: string[];
};

type SimulationResponse = {
  requested_amount: number;
  requested_tenor_months: number;
  salary_transfer: boolean;
  max_affordable_new_installment: number;
  matches: OfferMatch[];
};

type ChatMessage = {
  role: "user" | "advisor";
  text: string;
};

type SseEvent<T> = {
  event: string;
  id?: string;
  retry?: string;
  data: T;
};

type ChatStreamPayload = {
  delta?: string;
  reply?: string;
  detail?: string;
};

type ApplicationHistoryItem = {
  status: string;
  message_ar: string;
  created_at: string;
};

type ApplicationRecord = {
  application_id: string;
  journey_id: string;
  offer_id: string;
  status: string;
  summary: {
    institution: string;
    product: string;
    monthly_installment: number | null;
    total_amount_payable: number | null;
    simulation_notice_ar: string;
  };
  history: ApplicationHistoryItem[];
  simulation: boolean;
};

const stages: Array<{ key: StageKey; label: string; title: string; metric: string }> = [
  { key: "discover", label: "اكتشف", title: "بيانات العميل والطلب", metric: "مدخلات" },
  { key: "define", label: "حدد", title: "تعريف القدرة المالية", metric: "تحليل" },
  { key: "develop", label: "طوّر", title: "مقارنة العروض", metric: "بدائل" },
  { key: "deliver", label: "سلّم", title: "قرار واضح وخطوة تالية", metric: "توصية" },
];

const personas: Persona[] = [
  {
    id: "ahmed_borderline",
    name: "أحمد",
    label: "حالة حدية",
    summary: "راتب خاص مع التزامات شهرية، مناسب لإظهار القبول والرفض معاً.",
    amount: 80000,
    tenor: 48,
    age: 28,
  },
  {
    id: "sara_strong",
    name: "سارة",
    label: "ملف قوي",
    summary: "راتب حكومي ومساحة تمويلية مريحة، مناسب لإظهار أفضل عرض.",
    amount: 60000,
    tenor: 36,
    age: 31,
  },
  {
    id: "khalid_rejected",
    name: "خالد",
    label: "رفض مفسر",
    summary: "التزامات عالية مقابل الراتب، مناسب لإظهار أسباب الرفض بوضوح.",
    amount: 50000,
    tenor: 36,
    age: 35,
  },
];

const statusCopy: Record<MatchStatus, { label: string; className: string }> = {
  eligible: { label: "مؤهل", className: "statusEligible" },
  conditional: { label: "مشروط", className: "statusConditional" },
  ineligible: { label: "غير مؤهل", className: "statusIneligible" },
  policy_review: { label: "مراجعة سياسة", className: "statusReview" },
};

const statusFilters: Array<{ key: "all" | MatchStatus; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "eligible", label: "مؤهل" },
  { key: "conditional", label: "مشروط" },
  { key: "ineligible", label: "غير مؤهل" },
];

const agentLabels: Record<string, string> = {
  financial_profile: "الملف المالي",
  matching: "المطابقة",
  cost: "التكلفة",
  advisor: "المستشار",
  application: "التقديم",
};

const eventLabels: Record<string, string> = {
  agent_started: "بدأ",
  tool_called: "أداة",
  finding: "نتيجة",
  agent_completed: "اكتمل",
  error: "خطأ",
  journey_completed: "انتهت الرحلة",
};

const applicationStatusLabels: Record<string, string> = {
  draft: "مسودة",
  submitted: "مرسل",
  under_review: "تحت المراجعة",
  approved: "مقبول",
  declined: "مرفوض",
};

const confidenceLabels: Record<string, string> = {
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

const trendLabels: Record<string, string> = {
  rising: "تصاعدي",
  falling: "تنازلي",
  stable: "مستقر",
  none: "لا توجد التزامات",
  unknown: "غير واضح",
};

function formatSar(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "غير متاح";
  }
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "غير متاح";
  }
  return new Intl.NumberFormat("ar-SA", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatNearMiss(suggestion: NearMissSuggestion) {
  const status = suggestion.status ? statusCopy[suggestion.status]?.label : null;
  const suffix = suggestion.monthly_installment
    ? ` القسط المتوقع ${formatSar(suggestion.monthly_installment)}.`
    : "";

  if (suggestion.kind === "lower_amount" && suggestion.requested_amount) {
    return `مسار متاح عند ${formatSar(suggestion.requested_amount)}${status ? ` بحالة ${status}` : ""}.${suffix}`;
  }
  if (suggestion.kind === "shorter_tenor" && suggestion.requested_tenor_months) {
    return `مسار متاح عند مدة ${suggestion.requested_tenor_months} شهر${status ? ` بحالة ${status}` : ""}.${suffix}`;
  }
  if (suggestion.kind === "salary_transfer") {
    return `تحويل الراتب يفتح هذا المسار${status ? ` بحالة ${status}` : ""}.${suffix}`;
  }
  return suggestion.message;
}

function schedulePreviewRows(schedule: PaymentScheduleRow[]) {
  if (schedule.length <= 3) {
    return schedule;
  }
  const middle = schedule[Math.floor(schedule.length / 2)];
  return [schedule[0], middle, schedule[schedule.length - 1]];
}

function statusCounts(matches: OfferMatch[]) {
  return matches.reduce(
    (acc, match) => {
      acc[match.status] += 1;
      return acc;
    },
    { eligible: 0, conditional: 0, ineligible: 0, policy_review: 0 } as Record<MatchStatus, number>,
  );
}

function parseSseEvent<T>(rawEvent: string): SseEvent<T> | null {
  const lines = rawEvent.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const idLine = lines.find((line) => line.startsWith("id:"));
  const retryLine = lines.find((line) => line.startsWith("retry:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (dataLines.length === 0) {
    return null;
  }

  try {
    return {
      event: eventLine?.replace("event:", "").trim() ?? "message",
      id: idLine?.replace("id:", "").trim(),
      retry: retryLine?.replace("retry:", "").trim(),
      data: JSON.parse(
        dataLines.map((line) => line.replace(/^data:\s?/, "")).join("\n"),
      ) as T,
    };
  } catch {
    return null;
  }
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
  const [chatInput, setChatInput] = useState("ما أفضل خيار متاح ولماذا؟");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [applicationError, setApplicationError] = useState("");
  const [isApplicationLoading, setIsApplicationLoading] = useState(false);
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

  const counts = useMemo(() => statusCounts(activeMatches), [activeMatches]);

  const visibleMatches = useMemo(() => {
    if (!journey) {
      return [];
    }
    if (filter === "all") {
      return activeMatches;
    }
    return activeMatches.filter((match) => match.status === filter);
  }, [journey, activeMatches, filter]);

  const compareMatches = useMemo(
    () =>
      compareOfferIds
        .map((offerId) => activeMatches.find((match) => match.offer_id === offerId))
        .filter((match): match is OfferMatch => Boolean(match)),
    [activeMatches, compareOfferIds],
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
  }

  async function submitJourney(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setJourneyError("");
    setJourney(null);
    setLiveEvents([]);
    setFilter("all");
    setChatMessages([]);
    setChatError("");
    setApplication(null);
    setApplicationError("");
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
            visibleMatches={visibleMatches}
            onFilterChange={setFilter}
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
            applicationError={applicationError}
            isApplicationLoading={isApplicationLoading}
            journey={journey}
            recommendedMatch={recommendedMatch}
            onApplicationAdvance={() => updateApplication("advance")}
            onApplicationCreate={(offerId) => createApplication(offerId)}
            onApplicationSubmit={() => updateApplication("submit")}
            onChatInputChange={setChatInput}
            onChatSubmit={submitChat}
          />
        )}
      </section>
    </main>
  );
}

function DiscoverStage({
  age,
  consent,
  isLoading,
  journeyError,
  requestedAmount,
  requestedTenor,
  selectedPersona,
  onAgeChange,
  onAmountChange,
  onConsentChange,
  onPersonaChange,
  onSubmit,
  onTenorChange,
}: {
  age: number;
  consent: boolean;
  isLoading: boolean;
  journeyError: string;
  requestedAmount: number;
  requestedTenor: number;
  selectedPersona: Persona;
  onAgeChange: (value: number) => void;
  onAmountChange: (value: number) => void;
  onConsentChange: (value: boolean) => void;
  onPersonaChange: (persona: Persona) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTenorChange: (value: number) => void;
}) {
  return (
    <div className="stageContent">
      <section className="personaGrid" aria-label="الشخصيات التجريبية">
        {personas.map((persona) => (
          <button
            key={persona.id}
            type="button"
            className={`personaCard ${selectedPersona.id === persona.id ? "personaSelected" : ""}`}
            onClick={() => onPersonaChange(persona)}
          >
            <span>{persona.label}</span>
            <strong>{persona.name}</strong>
            <p>{persona.summary}</p>
          </button>
        ))}
      </section>

      <form className="requestPanel" onSubmit={onSubmit}>
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Discover</p>
            <h3>طلب التمويل</h3>
          </div>
          <span className="connectionPill">Live API</span>
        </div>

        <div className="formGrid">
          <label>
            <span>مبلغ التمويل</span>
            <input
              min={5000}
              step={1000}
              type="number"
              value={requestedAmount}
              onChange={(event) => onAmountChange(Number(event.target.value))}
            />
          </label>
          <label>
            <span>مدة التمويل بالأشهر</span>
            <input
              max={60}
              min={6}
              step={6}
              type="number"
              value={requestedTenor}
              onChange={(event) => onTenorChange(Number(event.target.value))}
            />
          </label>
          <label>
            <span>العمر</span>
            <input
              max={65}
              min={18}
              type="number"
              value={age}
              onChange={(event) => onAgeChange(Number(event.target.value))}
            />
          </label>
        </div>

        <label className="consentRow">
          <input
            checked={consent}
            type="checkbox"
            onChange={(event) => onConsentChange(event.target.checked)}
          />
          <span>موافقة مشاركة بيانات الحساب التجريبية</span>
        </label>

        {journeyError && <p className="errorBanner">{journeyError}</p>}

        <button className="primaryButton" disabled={!consent || isLoading} type="submit">
          {isLoading ? "جاري التحليل..." : "ابدأ تحليل التمويل"}
        </button>
      </form>
    </div>
  );
}

function DefineStage({
  isLoading,
  liveEvents,
  journey,
  onBack,
}: {
  isLoading: boolean;
  liveEvents: AgentEvent[];
  journey: JourneyResponse | null;
  onBack: () => void;
}) {
  if (!journey) {
    if (isLoading || liveEvents.length > 0) {
      return (
        <div className="stageContent">
          <section className="analysisPanel">
            <div>
              <p className="eyebrow">Define</p>
              <h3>جاري التحليل</h3>
            </div>
          </section>
          {liveEvents.length > 0 ? (
            <AgentTimeline events={liveEvents} />
          ) : (
            <EmptyState title="جاري الاتصال" />
          )}
        </div>
      );
    }
    return (
      <EmptyState
        actionLabel="اختيار عميل"
        onAction={onBack}
        title="ابدأ من مرحلة الاكتشاف"
      />
    );
  }

  const profile = journey.profile;
  const totalObligations =
    profile.salary_linked_obligations +
    profile.other_obligations +
    profile.real_estate_obligations;

  return (
    <div className="stageContent">
      <section className="metricsGrid">
        <MetricCard label="الراتب الشهري" value={formatSar(profile.gross_salary)} />
        <MetricCard label="الدخل المحتسب" value={formatSar(profile.total_monthly_income)} />
        <MetricCard label="الالتزامات الشهرية" value={formatSar(totalObligations)} />
        <MetricCard
          label="القسط الجديد المتاح"
          value={formatSar(journey.max_affordable_new_installment)}
        />
        <MetricCard label="ثبات الراتب" value={formatPercent(profile.salary_stability_score)} />
      </section>

      <AgentTimeline events={journey.events} />

      <section className="analysisPanel">
        <div>
          <p className="eyebrow">Define</p>
          <h3>تعريف القرار</h3>
        </div>
        <p>
          العميل لديه مساحة قسط جديدة تقارب{" "}
          <strong>{formatSar(journey.max_affordable_new_installment)}</strong> بعد قراءة الراتب
          والالتزامات المتكررة من بيانات الحساب.
        </p>
        <dl className="profileFacts">
          <div>
            <dt>البنك</dt>
            <dd>{profile.salary_bank || "غير محدد"}</dd>
          </div>
          <div>
            <dt>نوع العمل</dt>
            <dd>{profile.employment_type}</dd>
          </div>
          <div>
            <dt>الأشهر المرصودة</dt>
            <dd>{profile.months_observed}</dd>
          </div>
          <div>
            <dt>الثقة</dt>
            <dd>{confidenceLabels[profile.confidence_level] ?? profile.confidence_level}</dd>
          </div>
          <div>
            <dt>اتجاه الالتزامات</dt>
            <dd>{trendLabels[profile.obligation_trend] ?? profile.obligation_trend}</dd>
          </div>
        </dl>
        {profile.detection_notes.length > 0 && (
          <ul className="notesList">
            {profile.detection_notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AgentTimeline({ events }: { events: AgentEvent[] }) {
  const visibleEvents = events.filter((event) => event.type !== "journey_completed");

  return (
    <section className="agentTimeline" aria-label="تسلسل عمل الوكلاء">
      <div className="timelineHeading">
        <div>
          <p className="eyebrow">Agents</p>
          <h3>الوكلاء أثناء العمل</h3>
        </div>
        <span>{visibleEvents.length} حدث</span>
      </div>

      <div className="timelineList">
        {visibleEvents.map((event) => (
          <article key={`${event.sequence}-${event.type}`} className="timelineEvent">
            <span className="timelineIndex">{event.sequence}</span>
            <div>
              <div className="timelineMeta">
                <strong>{event.agent ? agentLabels[event.agent] ?? event.agent : "الرحلة"}</strong>
                <small>{eventLabels[event.type] ?? event.type}</small>
              </div>
              <p>{event.message_ar}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DevelopStage({
  compareMatches,
  compareOfferIds,
  filter,
  hasSimulation,
  isSimulatorLoading,
  journey,
  simulatorAmount,
  simulatorError,
  simulatorSalaryTransfer,
  simulatorTenor,
  visibleMatches,
  onFilterChange,
  onSimulatorAmountChange,
  onSimulatorReset,
  onSimulatorRun,
  onSimulatorSalaryTransferChange,
  onSimulatorTenorChange,
  onToggleCompare,
}: {
  compareMatches: OfferMatch[];
  compareOfferIds: string[];
  filter: "all" | MatchStatus;
  hasSimulation: boolean;
  isSimulatorLoading: boolean;
  journey: JourneyResponse | null;
  simulatorAmount: number;
  simulatorError: string;
  simulatorSalaryTransfer: boolean;
  simulatorTenor: number;
  visibleMatches: OfferMatch[];
  onFilterChange: (value: "all" | MatchStatus) => void;
  onSimulatorAmountChange: (value: number) => void;
  onSimulatorReset: () => void;
  onSimulatorRun: () => void;
  onSimulatorSalaryTransferChange: (value: boolean) => void;
  onSimulatorTenorChange: (value: number) => void;
  onToggleCompare: (offerId: string) => void;
}) {
  if (!journey) {
    return <EmptyState title="لا توجد عروض بعد" />;
  }

  return (
    <div className="stageContent">
      <section className="comparisonHeader">
        <div>
          <p className="eyebrow">Develop</p>
          <h3>العروض المرتبة</h3>
        </div>
        <div className="segmentedControl" aria-label="تصفية العروض">
          {statusFilters.map((item) => (
            <button
              key={item.key}
              className={filter === item.key ? "segmentActive" : ""}
              type="button"
              onClick={() => onFilterChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="requestPanel">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Simulator</p>
            <h3>اختبر سيناريو آخر</h3>
          </div>
          <span className="connectionPill">{hasSimulation ? "محاكاة مفعلة" : "المحرك"}</span>
        </div>

        <div className="formGrid">
          <label>
            <span>مبلغ التمويل</span>
            <input
              min={5000}
              step={1000}
              type="number"
              value={simulatorAmount}
              onChange={(event) => onSimulatorAmountChange(Number(event.target.value))}
            />
          </label>
          <label>
            <span>مدة التمويل بالأشهر</span>
            <input
              max={60}
              min={6}
              step={6}
              type="number"
              value={simulatorTenor}
              onChange={(event) => onSimulatorTenorChange(Number(event.target.value))}
            />
          </label>
        </div>

        <label className="consentRow">
          <input
            checked={simulatorSalaryTransfer}
            type="checkbox"
            onChange={(event) => onSimulatorSalaryTransferChange(event.target.checked)}
          />
          <span>محاكاة تحويل الراتب</span>
        </label>

        {simulatorError && <p className="errorBanner">{simulatorError}</p>}

        <div className="applicationActions">
          <button disabled={isSimulatorLoading} type="button" onClick={onSimulatorRun}>
            {isSimulatorLoading ? "..." : "تشغيل المحاكاة"}
          </button>
          {hasSimulation && (
            <button disabled={isSimulatorLoading} type="button" onClick={onSimulatorReset}>
              إعادة الأصل
            </button>
          )}
        </div>
      </section>

      {compareMatches.length > 0 && (
        <ComparePanel
          matches={compareMatches}
          onRemove={(offerId) => onToggleCompare(offerId)}
        />
      )}

      <section className="offersList" aria-label="نتائج العروض">
        {visibleMatches.map((match) => (
          <OfferCard
            key={match.offer_id}
            compareDisabled={
              compareOfferIds.length >= 3 && !compareOfferIds.includes(match.offer_id)
            }
            compareSelected={compareOfferIds.includes(match.offer_id)}
            match={match}
            onCompareToggle={onToggleCompare}
          />
        ))}
      </section>
    </div>
  );
}

function ComparePanel({
  matches,
  onRemove,
}: {
  matches: OfferMatch[];
  onRemove: (offerId: string) => void;
}) {
  return (
    <section className="comparePanel" aria-label="مقارنة العروض المختارة">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Compare</p>
          <h3>مقارنة مختارة</h3>
        </div>
        <span className="connectionPill">{matches.length} / 3</span>
      </div>

      <div className="compareGrid">
        {matches.map((match) => {
          const status = statusCopy[match.status];
          const firstIssue = match.reasons[0] ?? match.conditions[0] ?? "لا توجد ملاحظات";
          return (
            <article key={match.offer_id} className="compareColumn">
              <header>
                <div>
                  <span className={`statusBadge ${status.className}`}>{status.label}</span>
                  {!match.rate_verified && <span className="warningBadge">سعر غير مؤكد</span>}
                </div>
                <strong>{match.institution}</strong>
                <p>{match.product}</p>
                <button type="button" onClick={() => onRemove(match.offer_id)}>
                  إزالة
                </button>
              </header>

              <dl className="compareRows">
                <div>
                  <dt>القسط</dt>
                  <dd>{formatSar(match.monthly_installment)}</dd>
                </div>
                <div>
                  <dt>APR</dt>
                  <dd>{formatPercent(match.apr_effective)}</dd>
                </div>
                <div>
                  <dt>الإجمالي</dt>
                  <dd>{formatSar(match.total_amount_payable)}</dd>
                </div>
                <div>
                  <dt>الهيكل</dt>
                  <dd>{match.structure}</dd>
                </div>
                <div>
                  <dt>جدول السداد</dt>
                  <dd>{match.payment_schedule.length || "غير متاح"}</dd>
                </div>
                <div>
                  <dt>الملاحظة</dt>
                  <dd>{firstIssue}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DeliverStage({
  application,
  applicationError,
  chatError,
  chatInput,
  chatMessages,
  isApplicationLoading,
  isChatLoading,
  journey,
  recommendedMatch,
  onApplicationAdvance,
  onApplicationCreate,
  onApplicationSubmit,
  onChatInputChange,
  onChatSubmit,
}: {
  application: ApplicationRecord | null;
  applicationError: string;
  chatError: string;
  chatInput: string;
  chatMessages: ChatMessage[];
  isApplicationLoading: boolean;
  isChatLoading: boolean;
  journey: JourneyResponse | null;
  recommendedMatch: OfferMatch | null;
  onApplicationAdvance: () => void;
  onApplicationCreate: (offerId: string) => void;
  onApplicationSubmit: () => void;
  onChatInputChange: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!journey) {
    return <EmptyState title="لا يوجد قرار جاهز" />;
  }

  return (
    <div className="deliverGrid">
      <section className="recommendationPanel">
        <div>
          <p className="eyebrow">Deliver</p>
          <h3>{recommendedMatch ? "أفضل مسار قابل للتنفيذ" : "لا يوجد عرض مناسب حالياً"}</h3>
        </div>

        {recommendedMatch ? (
          <OfferCard match={recommendedMatch} compact />
        ) : (
          <p className="emptyText">
            الالتزامات الحالية تتجاوز المساحة التمويلية المتاحة. القرار الأنسب هو تخفيض
            الالتزامات أو تقليل مبلغ التمويل.
          </p>
        )}

        <ol className="nextSteps">
          <li>مراجعة العروض ذات الأسعار غير المؤكدة قبل أي عرض رسمي.</li>
          <li>مطابقة المتطلبات مع جهة العمل وتحويل الراتب إن كان شرطاً.</li>
          <li>حفظ أسباب الرفض لشرح القرار للعميل أو لجنة التحكيم.</li>
        </ol>

        <ApplicationTracker
          application={application}
          error={applicationError}
          isLoading={isApplicationLoading}
          recommendedMatch={recommendedMatch}
          onAdvance={onApplicationAdvance}
          onCreate={onApplicationCreate}
          onSubmit={onApplicationSubmit}
        />
      </section>

      <section className="advisorPanel">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Advisor</p>
            <h3>المستشار</h3>
          </div>
          <span className="connectionPill">اختياري</span>
        </div>

        <div className="chatWindow" aria-live="polite">
          {chatMessages.length === 0 && (
            <p className="emptyText">اسأل عن سبب التوصية أو الرفض بناءً على نتائج الرحلة.</p>
          )}
          {chatMessages.map((message, index) => (
            <p key={`${message.role}-${index}`} className={`chatBubble ${message.role}`}>
              {message.text}
            </p>
          ))}
          {chatError && <p className="errorBanner">{chatError}</p>}
        </div>

        {journey.suggested_questions.length > 0 && (
          <div className="suggestedQuestions" aria-label="أسئلة مقترحة">
            {journey.suggested_questions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onChatInputChange(question)}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        <form className="chatForm" onSubmit={onChatSubmit}>
          <input
            value={chatInput}
            placeholder="اكتب سؤالك"
            onChange={(event) => onChatInputChange(event.target.value)}
          />
          <button disabled={isChatLoading || !chatInput.trim()} type="submit">
            {isChatLoading ? "..." : "إرسال"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ApplicationTracker({
  application,
  error,
  isLoading,
  recommendedMatch,
  onAdvance,
  onCreate,
  onSubmit,
}: {
  application: ApplicationRecord | null;
  error: string;
  isLoading: boolean;
  recommendedMatch: OfferMatch | null;
  onAdvance: () => void;
  onCreate: (offerId: string) => void;
  onSubmit: () => void;
}) {
  const isFinal = application?.status === "approved" || application?.status === "declined";

  return (
    <section className="applicationPanel">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Application</p>
          <h3>طلب تجريبي</h3>
        </div>
        <span className="warningBadge">محاكاة</span>
      </div>

      {!application && (
        <button
          className="secondaryButton"
          disabled={!recommendedMatch || isLoading}
          type="button"
          onClick={() => recommendedMatch && onCreate(recommendedMatch.offer_id)}
        >
          {isLoading ? "جاري التجهيز..." : "جهز طلب العرض"}
        </button>
      )}

      {application && (
        <>
          <div className="applicationSummary">
            <strong>{applicationStatusLabels[application.status] ?? application.status}</strong>
            <p>{application.summary.simulation_notice_ar}</p>
          </div>
          <div className="applicationTimeline">
            {application.history.map((item) => (
              <p key={`${item.status}-${item.created_at}`}>
                <span>{applicationStatusLabels[item.status] ?? item.status}</span>
                {item.message_ar}
              </p>
            ))}
          </div>
          <div className="applicationActions">
            {application.status === "draft" && (
              <button disabled={isLoading} type="button" onClick={onSubmit}>
                {isLoading ? "..." : "إرسال المحاكاة"}
              </button>
            )}
            {(application.status === "submitted" || application.status === "under_review") && (
              <button disabled={isLoading} type="button" onClick={onAdvance}>
                {isLoading ? "..." : "تحديث الحالة"}
              </button>
            )}
            {isFinal && <span>{applicationStatusLabels[application.status]}</span>}
          </div>
        </>
      )}

      {error && <p className="errorBanner">{error}</p>}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function OfferCard({
  compareDisabled = false,
  compareSelected = false,
  compact = false,
  match,
  onCompareToggle,
}: {
  compareDisabled?: boolean;
  compareSelected?: boolean;
  compact?: boolean;
  match: OfferMatch;
  onCompareToggle?: (offerId: string) => void;
}) {
  const status = statusCopy[match.status];

  return (
    <article className={`offerCard ${compact ? "offerCompact" : ""}`}>
      <header>
        <div>
          <span className={`statusBadge ${status.className}`}>{status.label}</span>
          {!match.rate_verified && <span className="warningBadge">سعر غير مؤكد</span>}
        </div>
        <strong>{match.institution}</strong>
        <p>{match.product}</p>
        {onCompareToggle && (
          <button
            className="compareButton"
            disabled={compareDisabled}
            type="button"
            onClick={() => onCompareToggle(match.offer_id)}
          >
            {compareSelected ? "مختار للمقارنة" : "قارن"}
          </button>
        )}
      </header>

      <dl className="offerNumbers">
        <div>
          <dt>القسط</dt>
          <dd>{formatSar(match.monthly_installment)}</dd>
        </div>
        <div>
          <dt>APR</dt>
          <dd>{formatPercent(match.apr_effective)}</dd>
        </div>
        <div>
          <dt>الإجمالي</dt>
          <dd>{formatSar(match.total_amount_payable)}</dd>
        </div>
      </dl>

      {match.payment_schedule.length > 0 && (
        <details className="paymentSchedule">
          <summary>جدول السداد ({match.payment_schedule.length} شهر)</summary>
          <div className="schedulePreview">
            {schedulePreviewRows(match.payment_schedule).map((row) => (
              <div key={`${match.offer_id}-month-${row.month}`}>
                <span>شهر {row.month}</span>
                <strong>{formatSar(row.installment)}</strong>
                <small>المتبقي {formatSar(row.remaining_principal)}</small>
              </div>
            ))}
          </div>
        </details>
      )}

      {(match.reasons.length > 0 || match.conditions.length > 0) && (
        <div className="reasonBlock">
          {match.conditions.map((condition) => (
            <p key={condition}>شرط: {condition}</p>
          ))}
          {match.reasons.map((reason) => (
            <p key={reason}>سبب: {reason}</p>
          ))}
        </div>
      )}

      {match.near_miss_suggestions.length > 0 && (
        <div className="nearMissBlock">
          <strong>مسار بديل</strong>
          {match.near_miss_suggestions.map((suggestion) => (
            <p key={`${match.offer_id}-${suggestion.kind}-${suggestion.requested_amount ?? ""}`}>
              {formatNearMiss(suggestion)}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}

function EmptyState({
  actionLabel,
  title,
  onAction,
}: {
  actionLabel?: string;
  title: string;
  onAction?: () => void;
}) {
  return (
    <section className="emptyState">
      <h3>{title}</h3>
      {actionLabel && onAction && (
        <button className="secondaryButton" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}
