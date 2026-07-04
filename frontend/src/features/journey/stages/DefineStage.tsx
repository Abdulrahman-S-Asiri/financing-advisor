import {
  agentLabels,
  confidenceLabels,
  eventLabels,
  trendLabels,
} from "../data";
import {
  formatCap,
  formatPercent,
  formatSar,
  gaugePercent,
} from "../format";
import type { AgentEvent, FinancialHealth, JourneyResponse } from "../types";
import { EmptyState } from "../components/EmptyState";
import { MetricCard } from "../components/MetricCard";

export type DefineStageProps = {
  isLoading: boolean;
  liveEvents: AgentEvent[];
  journey: JourneyResponse | null;
  onBack: () => void;
};

export default function DefineStage({
  isLoading,
  liveEvents,
  journey,
  onBack,
}: DefineStageProps) {
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

      <FinancialHealthDashboard health={journey.financial_health} />

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

function FinancialHealthDashboard({ health }: { health: FinancialHealth }) {
  const gauges = [
    {
      key: "salary-linked",
      label: "التزامات مرتبطة بالراتب",
      ratio: health.salary_linked_ratio,
      cap: health.salary_linked_cap,
    },
    {
      key: "non-real-estate",
      label: "التزامات غير عقارية",
      ratio: health.non_real_estate_ratio,
      cap: health.non_real_estate_cap,
    },
    {
      key: "total",
      label: "إجمالي الالتزامات",
      ratio: health.total_ratio,
      cap: health.total_cap,
    },
  ];

  return (
    <section className="healthPanel" aria-label="لوحة الصحة المالية">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Health</p>
          <h3>الصحة المالية</h3>
        </div>
        <span className="connectionPill">شريحة {health.tier}</span>
      </div>

      <div className="healthSummary">
        <div>
          <span>الالتزامات الحالية</span>
          <strong>{formatSar(health.monthly_obligations)}</strong>
        </div>
        <div>
          <span>مساحة قسط جديدة</span>
          <strong>{formatSar(health.max_affordable_new_installment)}</strong>
        </div>
        <div>
          <span>حالة السياسة</span>
          <strong>{health.policy_review ? "مراجعة ممول" : "حدود محددة"}</strong>
        </div>
      </div>

      <div className="gaugeGrid">
        {gauges.map((gauge) => (
          <article key={gauge.key} className="gaugeCard">
            <div className="gaugeMeta">
              <strong>{gauge.label}</strong>
              <span>
                {formatPercent(gauge.ratio)} / {formatCap(gauge.cap)}
              </span>
            </div>
            <div className="gaugeTrack" aria-hidden="true">
              <span style={{ width: `${gaugePercent(gauge.ratio, gauge.cap)}%` }} />
            </div>
          </article>
        ))}
      </div>

      {health.breaches.length > 0 && (
        <div className="healthBreaches">
          {health.breaches.map((breach) => (
            <p key={breach}>{breach}</p>
          ))}
        </div>
      )}
    </section>
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
