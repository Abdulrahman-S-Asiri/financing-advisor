"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Card,
  ErrorState,
  Gauge,
  MetricCard,
  SectionHeading,
  Skeleton,
  SkeletonCard,
  UnverifiedBadge,
} from "@/components/ui";
import {
  statusCopy,
  structureLabels,
  unverifiedRateHint,
  type MatchStatus,
} from "@/lib/data";
import {
  formatCap,
  formatNearMiss,
  formatPercent,
  formatSar,
} from "@/lib/format";
import type {
  DbrDecision,
  OfferDetailResponse,
  OfferMatch,
  PaymentScheduleRow,
} from "@/lib/schemas";
import { api } from "@/lib/api";
import { strings } from "@/lib/strings";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return strings.detail.unavailable;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
  }).format(date);
}

function DetailHero({ offer }: { offer: OfferMatch }) {
  const status = statusCopy[offer.status as MatchStatus];
  const metrics = [
    {
      label: strings.offers.installment,
      value: offer.monthly_installment ?? strings.common.notAvailable,
      format: formatSar,
    },
    {
      label: strings.common.apr,
      value: offer.apr_effective ?? strings.common.notAvailable,
      format: formatPercent,
    },
    {
      label: strings.offers.total,
      value: offer.total_amount_payable ?? strings.common.notAvailable,
      format: formatSar,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-accent">
            {strings.detail.heroEyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black text-ink">{offer.institution}</h1>
          <p className="mt-2 text-sm font-semibold text-muted">{offer.product}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {!offer.rate_verified && <UnverifiedBadge hint={unverifiedRateHint} />}
          <Badge tone="neutral">
            {structureLabels[offer.structure] ?? offer.structure}
          </Badge>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
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
  );
}

function CostPanel({ offer }: { offer: OfferMatch }) {
  const cost = offer.cost_breakdown;
  if (!cost) {
    return null;
  }

  const facts = [
    { label: strings.detail.principal, value: formatSar(cost.principal) },
    { label: strings.detail.tenor, value: `${cost.tenor_months} ${strings.detail.monthsSuffix}` },
    { label: strings.detail.flatRate, value: formatPercent(cost.flat_rate_annual) },
    { label: strings.detail.totalProfit, value: formatSar(cost.total_profit) },
    { label: strings.detail.adminFee, value: formatSar(cost.admin_fee) },
    { label: strings.detail.totalPayable, value: formatSar(cost.total_amount_payable) },
    { label: strings.common.apr, value: formatPercent(cost.apr_effective) },
  ];

  return (
    <Card>
      <SectionHeading title={strings.detail.costTitle} />
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-muted">{fact.label}</dt>
            <dd className="text-sm font-black text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function DbrPanel({ dbr }: { dbr: DbrDecision | null }) {
  if (!dbr) {
    return null;
  }
  const gauges = [
    {
      key: "salary-linked",
      label: strings.analysis.gauges.salaryLinked,
      ratio: dbr.salary_linked_ratio,
      cap: dbr.salary_linked_cap,
    },
    {
      key: "non-real-estate",
      label: strings.analysis.gauges.nonRealEstate,
      ratio: dbr.non_real_estate_ratio,
      cap: dbr.non_real_estate_cap,
    },
    {
      key: "total",
      label: strings.analysis.gauges.total,
      ratio: dbr.total_ratio,
      cap: dbr.total_cap,
    },
  ];

  return (
    <Card>
      <SectionHeading
        title={strings.detail.dbrTitle}
        trailing={<Badge tone={dbr.passes ? "ok" : "danger"}>{dbr.tier}</Badge>}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {gauges.map((gauge) => (
          <Gauge
            key={gauge.key}
            label={gauge.label}
            ratio={gauge.ratio}
            cap={gauge.cap}
            detail={`${formatPercent(gauge.ratio)} / ${formatCap(gauge.cap)}`}
          />
        ))}
      </div>
      {dbr.breaches.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl border border-danger/30 bg-danger/5 p-3">
          {dbr.breaches.map((breach) => (
            <li key={breach} className="text-xs leading-6 text-danger">
              {breach}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DecisionTracePanel({ offer }: { offer: OfferMatch }) {
  const notes = [
    ...offer.conditions.map((condition) => ({ key: `c-${condition}`, value: condition })),
    ...offer.reasons.map((reason) => ({ key: `r-${reason}`, value: reason })),
    ...offer.near_miss_suggestions.map((suggestion, index) => ({
      key: `n-${suggestion.kind}-${index}`,
      value: formatNearMiss(suggestion),
    })),
  ];

  return (
    <Card>
      <SectionHeading title={strings.detail.conditionsTitle} />
      {notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.key} className="rounded-xl bg-surface-soft p-3 text-xs leading-6 text-muted">
              {note.value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{strings.detail.noDecisionNotes}</p>
      )}
    </Card>
  );
}

function SchedulePanel({
  rows,
  loading,
  error,
}: {
  rows: PaymentScheduleRow[];
  loading: boolean;
  error: string;
}) {
  return (
    <Card>
      <SectionHeading
        title={strings.detail.scheduleTitle}
        trailing={
          rows.length > 0 ? (
            <Badge tone="neutral">
              {rows.length} {strings.detail.monthsSuffix}
            </Badge>
          ) : undefined
        }
      />
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">{strings.detail.noSchedule}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-surface-soft text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-3 text-start font-bold">
                  {strings.detail.scheduleMonth}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-bold">
                  {strings.detail.scheduleInstallment}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-bold">
                  {strings.detail.schedulePrincipal}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-bold">
                  {strings.detail.scheduleProfit}
                </th>
                <th scope="col" className="px-3 py-3 text-start font-bold">
                  {strings.detail.scheduleRemaining}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.month}>
                  <td className="px-3 py-3 font-bold text-ink">{row.month}</td>
                  <td className="px-3 py-3 text-muted">{formatSar(row.installment)}</td>
                  <td className="px-3 py-3 text-muted">{formatSar(row.principal_component)}</td>
                  <td className="px-3 py-3 text-muted">{formatSar(row.profit_component)}</td>
                  <td className="px-3 py-3 text-muted">{formatSar(row.remaining_principal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SourcePanel({ offer }: { offer: OfferMatch }) {
  return (
    <Card>
      <SectionHeading title={strings.detail.sourceTitle} />
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">{strings.detail.sourceLink}</dt>
          <dd className="text-sm font-bold text-ink">
            {offer.source_url ? (
              <a
                href={offer.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline dark:text-accent"
              >
                {strings.detail.sourceLink}
              </a>
            ) : (
              strings.detail.unavailable
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.detail.retrievedAt}</dt>
          <dd className="text-sm font-bold text-ink">{formatDate(offer.retrieved_at)}</dd>
        </div>
      </dl>
    </Card>
  );
}

export function OfferDetailPage({
  journeyId,
  offerId,
}: {
  journeyId: string;
  offerId: string;
}) {
  const [detail, setDetail] = useState<OfferDetailResponse | null>(null);
  const [schedule, setSchedule] = useState<PaymentScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [error, setError] = useState("");
  const [scheduleError, setScheduleError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setScheduleLoading(true);
    setError("");
    setScheduleError("");
    setDetail(null);
    setSchedule([]);

    void api
      .offerDetail(journeyId, offerId)
      .then((response) => {
        if (active) {
          setDetail(response);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(errorMessage(loadError, strings.detail.loadError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    void api
      .paymentSchedule(journeyId, offerId)
      .then((response) => {
        if (active) {
          setSchedule(response.payment_schedule);
        }
      })
      .catch((loadError) => {
        if (active) {
          setScheduleError(errorMessage(loadError, strings.detail.scheduleError));
        }
      })
      .finally(() => {
        if (active) {
          setScheduleLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [journeyId, offerId]);

  const dbr = useMemo(
    () => detail?.dbr ?? detail?.offer.dbr ?? null,
    [detail?.dbr, detail?.offer.dbr],
  );

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <p role="status" className="mb-4 text-sm font-semibold text-muted">
          {strings.detail.loading}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <ErrorState message={error || strings.detail.loadError} />
        <Link
          href="/journey/offers"
          className="mt-4 inline-flex rounded-xl border border-line px-4 py-2 text-sm font-bold text-brand hover:border-brand dark:text-accent"
        >
          {strings.detail.back}
        </Link>
      </main>
    );
  }

  const offer = detail.offer;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link
        href="/journey/offers"
        className="mb-6 inline-flex rounded-xl border border-line px-4 py-2 text-sm font-bold text-brand hover:border-brand dark:text-accent"
      >
        {strings.detail.back}
      </Link>

      <div className="space-y-6">
        <DetailHero offer={offer} />
        <div className="grid gap-6 lg:grid-cols-2">
          <CostPanel offer={offer} />
          <DbrPanel dbr={dbr} />
          <DecisionTracePanel offer={offer} />
          <SourcePanel offer={offer} />
        </div>
        <SchedulePanel
          rows={schedule}
          loading={scheduleLoading}
          error={scheduleError}
        />
      </div>
    </main>
  );
}
