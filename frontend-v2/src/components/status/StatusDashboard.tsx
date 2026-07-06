"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Badge, Button, Card, ErrorState, SectionHeading, Skeleton } from "@/components/ui";
import { personas } from "@/lib/data";
import { api } from "@/lib/api";
import type {
  AnalyticsOverview,
  Healthz,
  OfferVerification,
  OpenBankingStatus,
  VerificationIssue,
} from "@/lib/schemas";
import { strings } from "@/lib/strings";

type Fetched<T> = { state: "loading" } | { state: "error" } | { state: "ok"; data: T };

function boolBadge(value: boolean, warnWhenOff = false) {
  const tone = value ? "ok" : warnWhenOff ? "warn" : "neutral";
  return <Badge tone={tone}>{value ? strings.status.enabled : strings.status.disabled}</Badge>;
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-5 w-3/4" />
    </div>
  );
}

function CardState<T>({ result }: { result: Fetched<T> }) {
  if (result.state === "loading") {
    return (
      <div>
        <p className="sr-only">{strings.status.loadingCard}</p>
        <LoadingRows />
      </div>
    );
  }
  if (result.state === "error") {
    return <ErrorState message={strings.status.cardError} />;
  }
  return null;
}

function issueCounts(issues: VerificationIssue[]) {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  }
  return [...counts.entries()];
}

function ServiceCard({ health }: { health: Fetched<Healthz> }) {
  return (
    <Card>
      <SectionHeading title={strings.status.serviceTitle} />
      {health.state !== "ok" ? (
        <CardState result={health} />
      ) : (
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.version}</dt>
            <dd className="text-sm font-bold text-ink">{health.data.version}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.offersLoaded}</dt>
            <dd className="text-sm font-bold text-ink">{health.data.offers_loaded}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.catalogValid}</dt>
            <dd>{boolBadge(health.data.catalog_valid, true)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.postgres}</dt>
            <dd>{boolBadge(health.data.postgres_enabled)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.llm}</dt>
            <dd>{boolBadge(health.data.llm_configured)}</dd>
          </div>
          <p className="border-t border-line pt-3 text-xs leading-6 text-muted">
            {strings.status.secretNote}
          </p>
        </dl>
      )}
    </Card>
  );
}

function VerificationCard({ verification }: { verification: Fetched<OfferVerification> }) {
  return (
    <Card>
      <SectionHeading title={strings.status.verificationTitle} />
      {verification.state !== "ok" ? (
        <CardState result={verification} />
      ) : (
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.verifiedOf}</dt>
            <dd className="text-sm font-black text-ink">
              {verification.data.verified_count} / {verification.data.total_offers}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.targetMinimum}</dt>
            <dd className="text-sm font-bold text-ink">
              {verification.data.target_min_offers}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.readyForDemo}</dt>
            <dd>{boolBadge(verification.data.ready_for_public_demo, true)}</dd>
          </div>
          {verification.data.issues.length > 0 && (
            <div className="border-t border-line pt-3">
              <dt className="text-xs font-bold text-muted">{strings.status.issues}</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {issueCounts(verification.data.issues).map(([code, count]) => (
                  <Badge key={code} tone="warn">
                    {code} × {count}
                  </Badge>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  );
}

function OpenBankingCard({ openBanking }: { openBanking: Fetched<OpenBankingStatus> }) {
  return (
    <Card>
      <SectionHeading title={strings.status.openBankingTitle} />
      {openBanking.state !== "ok" ? (
        <CardState result={openBanking} />
      ) : (
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.provider}</dt>
            <dd className="text-sm font-bold text-ink">{openBanking.data.provider}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.mockMode}</dt>
            <dd>{boolBadge(openBanking.data.mock_mode)}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
}

function AnalyticsCard({ analytics }: { analytics: Fetched<AnalyticsOverview> }) {
  return (
    <Card>
      <SectionHeading title={strings.status.activityTitle} />
      {analytics.state !== "ok" ? (
        <CardState result={analytics} />
      ) : (
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.journeysTotal}</dt>
            <dd className="text-sm font-bold text-ink">{analytics.data.journeys.total}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.withPathForward}</dt>
            <dd className="text-sm font-bold text-ink">
              {analytics.data.journeys.with_path_forward}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted">{strings.status.applicationsTotal}</dt>
            <dd className="text-sm font-bold text-ink">{analytics.data.applications.total}</dd>
          </div>
          <p className="border-t border-line pt-3 text-xs leading-6 text-muted">
            {strings.status.activityNote}
          </p>
        </dl>
      )}
    </Card>
  );
}

export function StatusDashboard() {
  const [health, setHealth] = useState<Fetched<Healthz>>({ state: "loading" });
  const [verification, setVerification] = useState<Fetched<OfferVerification>>({
    state: "loading",
  });
  const [openBanking, setOpenBanking] = useState<Fetched<OpenBankingStatus>>({
    state: "loading",
  });
  const [analytics, setAnalytics] = useState<Fetched<AnalyticsOverview>>({
    state: "loading",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState("");

  const load = useCallback(async () => {
    setIsRefreshing(true);
    setHealth({ state: "loading" });
    setVerification({ state: "loading" });
    setOpenBanking({ state: "loading" });
    setAnalytics({ state: "loading" });

    const [healthResult, verificationResult, openBankingResult, analyticsResult] =
      await Promise.allSettled([
        api.healthz(),
        api.offerVerification(),
        api.openBankingStatus(),
        api.analyticsOverview(),
      ]);

    setHealth(
      healthResult.status === "fulfilled"
        ? { state: "ok", data: healthResult.value }
        : { state: "error" },
    );
    setVerification(
      verificationResult.status === "fulfilled"
        ? { state: "ok", data: verificationResult.value }
        : { state: "error" },
    );
    setOpenBanking(
      openBankingResult.status === "fulfilled"
        ? { state: "ok", data: openBankingResult.value }
        : { state: "error" },
    );
    setAnalytics(
      analyticsResult.status === "fulfilled"
        ? { state: "ok", data: analyticsResult.value }
        : { state: "error" },
    );
    setRefreshedAt(new Date().toLocaleTimeString("ar-SA"));
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const backendDown = health.state === "error";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-ink">{strings.status.title}</h1>
          <p className="mt-2 text-sm leading-7 text-muted">{strings.status.internalNote}</p>
          {refreshedAt && (
            <p className="mt-1 text-xs font-bold text-muted">
              {strings.status.lastUpdated}: {refreshedAt}
            </p>
          )}
        </div>
        <Button variant="secondary" loading={isRefreshing} onClick={() => void load()}>
          {isRefreshing ? strings.status.refreshing : strings.status.refresh}
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {backendDown && (
          <Card className="border-danger/40 bg-danger/5 lg:col-span-2">
            <SectionHeading title={strings.status.serviceDown} />
            <code className="block rounded-xl bg-surface px-4 py-3 text-sm font-bold text-ink">
              {strings.status.serviceCommand}
            </code>
          </Card>
        )}

        <ServiceCard health={health} />
        <VerificationCard verification={verification} />
        <OpenBankingCard openBanking={openBanking} />
        <AnalyticsCard analytics={analytics} />

        <Card className="lg:col-span-2">
          <SectionHeading title={strings.status.personasTitle} />
          <div className="flex flex-wrap gap-2">
            {personas.map((persona) => (
              <Link
                key={persona.id}
                href={`/journey?persona=${persona.id}`}
                className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-brand hover:border-brand dark:text-accent"
              >
                {persona.name} — {persona.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
