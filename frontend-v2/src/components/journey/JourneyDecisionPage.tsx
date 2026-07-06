"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AdvisorChat, ApplicationTracker } from "@/components/journey/DecisionPanels";
import { JourneyGuard, JourneyShell } from "@/components/journey/StageNav";
import { OfferCard } from "@/components/journey/OfferCard";
import { Badge, Card, SectionHeading } from "@/components/ui";
import {
  applicationCandidateStatuses,
  type MatchStatus,
} from "@/lib/data";
import type { OfferMatch } from "@/lib/schemas";
import { strings } from "@/lib/strings";
import { useJourneyStore } from "@/stores/journey";

function hasApplicationPath(match: OfferMatch) {
  return applicationCandidateStatuses.includes(match.status as MatchStatus);
}

function sourceLabel(active: boolean) {
  return active ? strings.decision.sourceSimulation : strings.decision.sourceOriginal;
}

function RecommendationPanel({
  recommendation,
  simulationActive,
}: {
  recommendation: OfferMatch | null;
  simulationActive: boolean;
}) {
  return (
    <section>
      <SectionHeading
        title={strings.decision.recommendedTitle}
        trailing={
          <Badge tone={simulationActive ? "accent" : "neutral"}>
            {sourceLabel(simulationActive)}
          </Badge>
        }
      />
      {recommendation ? (
        <OfferCard match={recommendation} compact />
      ) : (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <h2 className="text-base font-black text-danger">
            {strings.decision.noRecommendation}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted">
            {strings.decision.noRecommendationText}
          </p>
        </div>
      )}
    </section>
  );
}

function NextStepsPanel() {
  return (
    <Card>
      <SectionHeading title={strings.decision.nextStepsTitle} />
      <ol className="list-inside list-decimal space-y-3 text-sm leading-7 text-muted">
        <li>
          {strings.decision.nextStep1}{" "}
          <Link href="/status" className="font-bold text-brand dark:text-accent">
            {strings.decision.nextStep1Link}
          </Link>
        </li>
        <li>
          {strings.decision.nextStep2}
        </li>
        <li>
          {strings.decision.nextStep3}
        </li>
      </ol>
    </Card>
  );
}

function DecisionContent() {
  const journey = useJourneyStore((state) => state.journey);
  const simulation = useJourneyStore((state) => state.simulation);

  const sourceMatches = useMemo(
    () => simulation?.matches ?? journey?.matches ?? [],
    [journey?.matches, simulation?.matches],
  );
  const candidates = useMemo(
    () => sourceMatches.filter(hasApplicationPath),
    [sourceMatches],
  );
  const recommendation = candidates[0] ?? null;

  if (!journey) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black text-ink">{strings.decision.metaTitle}</h1>
        <p className="mt-2 text-sm font-semibold text-muted">
          {sourceLabel(Boolean(simulation))}
        </p>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0 space-y-6">
          <RecommendationPanel
            recommendation={recommendation}
            simulationActive={Boolean(simulation)}
          />
          <NextStepsPanel />
          <ApplicationTracker candidates={candidates} />
        </div>
        <div className="min-w-0">
          <AdvisorChat suggestedQuestions={journey.suggested_questions} />
        </div>
      </div>
    </div>
  );
}

export function JourneyDecisionPage() {
  return (
    <JourneyShell>
      <JourneyGuard>
        <DecisionContent />
      </JourneyGuard>
    </JourneyShell>
  );
}
