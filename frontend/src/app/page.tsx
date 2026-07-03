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
  detection_notes: string[];
  total_monthly_income: number;
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
  reasons: string[];
  conditions: string[];
  rate_verified: boolean;
};

type JourneyResponse = {
  profile: FinancialProfile;
  max_affordable_new_installment: number;
  matches: OfferMatch[];
};

type ChatMessage = {
  role: "user" | "advisor";
  text: string;
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

function statusCounts(matches: OfferMatch[]) {
  return matches.reduce(
    (acc, match) => {
      acc[match.status] += 1;
      return acc;
    },
    { eligible: 0, conditional: 0, ineligible: 0, policy_review: 0 } as Record<MatchStatus, number>,
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
  const [journeyError, setJourneyError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | MatchStatus>("all");
  const [chatInput, setChatInput] = useState("ما أفضل خيار متاح ولماذا؟");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const counts = useMemo(() => statusCounts(journey?.matches ?? []), [journey]);

  const visibleMatches = useMemo(() => {
    if (!journey) {
      return [];
    }
    if (filter === "all") {
      return journey.matches;
    }
    return journey.matches.filter((match) => match.status === filter);
  }, [journey, filter]);

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
  }

  async function submitJourney(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setJourneyError("");

    // Calls the deterministic backend and moves the user into the analysis stage.
    try {
      const response = await fetch("/backend/journey/connect", {
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

      const body = (await response.json()) as JourneyResponse;
      setJourney(body);
      setFilter("all");
      setChatMessages([]);
      setChatError("");
      setActiveStage("define");
    } catch (error) {
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

    // Advisor chat is optional, so provider errors become a visible panel state.
    try {
      const response = await fetch("/backend/advisor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: journey.profile.persona_id,
          message: nextQuestion,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail ?? "تعذر تشغيل المستشار.");
      }

      const body = (await response.json()) as { reply: string };
      setChatMessages((messages) => [...messages, { role: "advisor", text: body.reply }]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "المستشار غير متاح حالياً.");
    } finally {
      setIsChatLoading(false);
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
          <DefineStage journey={journey} onBack={() => setActiveStage("discover")} />
        )}

        {activeStage === "develop" && (
          <DevelopStage
            filter={filter}
            journey={journey}
            visibleMatches={visibleMatches}
            onFilterChange={setFilter}
          />
        )}

        {activeStage === "deliver" && (
          <DeliverStage
            chatError={chatError}
            chatInput={chatInput}
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            journey={journey}
            recommendedMatch={recommendedMatch}
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
  journey,
  onBack,
}: {
  journey: JourneyResponse | null;
  onBack: () => void;
}) {
  if (!journey) {
    return <EmptyState actionLabel="اختيار عميل" onAction={onBack} title="ابدأ من مرحلة الاكتشاف" />;
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
      </section>

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

function DevelopStage({
  filter,
  journey,
  visibleMatches,
  onFilterChange,
}: {
  filter: "all" | MatchStatus;
  journey: JourneyResponse | null;
  visibleMatches: OfferMatch[];
  onFilterChange: (value: "all" | MatchStatus) => void;
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

      <section className="offersList" aria-label="نتائج العروض">
        {visibleMatches.map((match) => (
          <OfferCard key={match.offer_id} match={match} />
        ))}
      </section>
    </div>
  );
}

function DeliverStage({
  chatError,
  chatInput,
  chatMessages,
  isChatLoading,
  journey,
  recommendedMatch,
  onChatInputChange,
  onChatSubmit,
}: {
  chatError: string;
  chatInput: string;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  journey: JourneyResponse | null;
  recommendedMatch: OfferMatch | null;
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metricCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function OfferCard({ match, compact = false }: { match: OfferMatch; compact?: boolean }) {
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
