"use client";

import Link from "next/link";

import { AgentTimeline, HealthPanel, ProfileFacts } from "@/components/journey/AnalysisPanels";
import { JourneyGuard, JourneyShell } from "@/components/journey/StageNav";
import { ErrorState, MetricCard, SectionHeading, SkeletonCard } from "@/components/ui";
import { formatPercent, formatSar } from "@/lib/format";
import { strings } from "@/lib/strings";
import { useJourneyStore } from "@/stores/journey";

function AnalysisLoading() {
  const liveEvents = useJourneyStore((state) => state.liveEvents);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black text-ink">{strings.analysis.pageTitle}</h1>
        <p role="status" className="mt-2 text-sm font-semibold text-muted">
          {strings.analysis.liveConnecting}
        </p>
      </header>
      <AgentTimeline events={liveEvents} />
      <div className="grid gap-3 md:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard />
    </div>
  );
}

function AnalysisDashboard() {
  const journey = useJourneyStore((state) => state.journey);
  const liveEvents = useJourneyStore((state) => state.liveEvents);

  if (!journey) {
    return null;
  }

  const events = journey.events.length > 0 ? journey.events : liveEvents;
  const metrics = [
    {
      label: strings.analysis.salary,
      value: journey.profile.gross_salary,
      format: formatSar,
    },
    {
      label: strings.analysis.income,
      value: journey.profile.total_monthly_income,
      format: formatSar,
    },
    {
      label: strings.analysis.obligations,
      value: journey.financial_health.monthly_obligations,
      format: formatSar,
    },
    {
      label: strings.analysis.headroom,
      value: journey.financial_health.max_affordable_new_installment,
      format: formatSar,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink">{strings.analysis.pageTitle}</h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            {strings.analysis.stability}:{" "}
            <span className="text-ink">
              {formatPercent(journey.profile.salary_stability_score)}
            </span>
          </p>
        </div>
        <Link
          href="/journey/offers"
          className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-strong dark:bg-accent dark:text-navy dark:hover:bg-accent/90"
        >
          {strings.analysis.continueToOffers}
        </Link>
      </header>

      <AgentTimeline events={events} />

      <section>
        <SectionHeading title={strings.analysis.metricsTitle} />
        <div className="grid gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              format={metric.format}
            />
          ))}
        </div>
      </section>

      <HealthPanel health={journey.financial_health} />
      <ProfileFacts profile={journey.profile} />
    </div>
  );
}

function InterruptedAnalysis() {
  const request = useJourneyStore((state) => state.request);
  const journeyError = useJourneyStore((state) => state.journeyError);
  const runJourney = useJourneyStore((state) => state.runJourney);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black text-ink">{strings.analysis.interruptedTitle}</h1>
      </header>
      <ErrorState
        message={journeyError}
        onRetry={request ? () => void runJourney(request) : undefined}
      />
    </div>
  );
}

export function JourneyAnalysisPage() {
  const journey = useJourneyStore((state) => state.journey);
  const running = useJourneyStore((state) => state.running);
  const journeyError = useJourneyStore((state) => state.journeyError);

  return (
    <JourneyShell>
      {journeyError && !running && !journey ? (
        <InterruptedAnalysis />
      ) : (
        <JourneyGuard>{running ? <AnalysisLoading /> : <AnalysisDashboard />}</JourneyGuard>
      )}
    </JourneyShell>
  );
}
