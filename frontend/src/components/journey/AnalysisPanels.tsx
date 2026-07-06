"use client";

import { motion, useReducedMotion } from "framer-motion";

import { Card, Gauge, SectionHeading, Badge } from "@/components/ui";
import {
  agentLabels,
  confidenceLabels,
  employmentLabels,
  eventLabels,
  trendLabels,
} from "@/lib/data";
import { formatCap, formatPercent, formatSar } from "@/lib/format";
import type { AgentEvent, FinancialHealth, FinancialProfile } from "@/lib/schemas";
import { strings } from "@/lib/strings";

export function AgentTimeline({ events }: { events: AgentEvent[] }) {
  const reducedMotion = useReducedMotion();
  const visible = events.filter((event) => event.type !== "journey_completed");

  return (
    <Card>
      <SectionHeading
        title={strings.analysis.liveTitle}
        trailing={
          <span className="text-xs font-bold text-muted">
            {visible.length} {strings.analysis.eventsCount}
          </span>
        }
      />
      <ol aria-live="polite" className="space-y-2">
        {visible.map((event) => (
          <motion.li
            key={`${event.sequence}-${event.type}`}
            initial={reducedMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-start gap-3 rounded-xl bg-surface-soft p-3"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-black text-brand">
              {event.sequence}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-ink">
                  {event.agent ? (agentLabels[event.agent] ?? event.agent) : strings.nav.journey}
                </strong>
                <Badge tone="neutral">{eventLabels[event.type] ?? event.type}</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted">{event.message_ar}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </Card>
  );
}

export function HealthPanel({ health }: { health: FinancialHealth }) {
  const gauges = [
    {
      key: "salary-linked",
      label: strings.analysis.gauges.salaryLinked,
      ratio: health.salary_linked_ratio,
      cap: health.salary_linked_cap,
    },
    {
      key: "non-real-estate",
      label: strings.analysis.gauges.nonRealEstate,
      ratio: health.non_real_estate_ratio,
      cap: health.non_real_estate_cap,
    },
    {
      key: "total",
      label: strings.analysis.gauges.total,
      ratio: health.total_ratio,
      cap: health.total_cap,
    },
  ];

  return (
    <Card>
      <SectionHeading
        title={strings.analysis.healthTitle}
        trailing={
          <Badge tone="accent">{`${strings.analysis.tierPrefix} ${health.tier}`}</Badge>
        }
      />
      <dl className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">{strings.analysis.currentObligations}</dt>
          <dd className="text-base font-black text-ink">
            {formatSar(health.monthly_obligations)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.analysis.newHeadroom}</dt>
          <dd className="text-base font-black text-ink">
            {formatSar(health.max_affordable_new_installment)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.analysis.policyState}</dt>
          <dd className="text-base font-black text-ink">
            {health.policy_review
              ? strings.analysis.policyReview
              : strings.analysis.policyBounded}
          </dd>
        </div>
      </dl>

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

      {health.breaches.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl border border-danger/30 bg-danger/5 p-3">
          {health.breaches.map((breach) => (
            <li key={breach} className="text-xs leading-6 text-danger">
              {breach}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ProfileFacts({ profile }: { profile: FinancialProfile }) {
  const facts = [
    { label: strings.analysis.bank, value: profile.salary_bank || strings.analysis.unspecified },
    {
      label: strings.analysis.employment,
      value: employmentLabels[profile.employment_type] ?? profile.employment_type,
    },
    { label: strings.analysis.monthsObserved, value: String(profile.months_observed) },
    {
      label: strings.analysis.confidence,
      value: confidenceLabels[profile.confidence_level] ?? profile.confidence_level,
    },
    {
      label: strings.analysis.trend,
      value: trendLabels[profile.obligation_trend] ?? profile.obligation_trend,
    },
  ];

  return (
    <Card>
      <SectionHeading title={strings.analysis.factsTitle} />
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-muted">{fact.label}</dt>
            <dd className="text-sm font-bold text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {profile.detection_notes.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-line pt-3">
          {profile.detection_notes.map((note) => (
            <li key={note} className="text-xs leading-6 text-muted">
              {note}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
