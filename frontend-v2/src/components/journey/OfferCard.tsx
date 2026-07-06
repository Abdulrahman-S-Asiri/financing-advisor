"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { memo } from "react";

import { Badge, UnverifiedBadge } from "@/components/ui";
import { statusCopy, unverifiedRateHint, type MatchStatus } from "@/lib/data";
import { formatNearMiss, formatPercent, formatSar } from "@/lib/format";
import type { OfferMatch } from "@/lib/schemas";
import { strings } from "@/lib/strings";

export const OfferCard = memo(function OfferCard({
  match,
  detailHref,
  compact = false,
  compareSelected = false,
  compareDisabled = false,
  onCompareToggle,
}: {
  match: OfferMatch;
  detailHref?: string;
  compact?: boolean;
  compareSelected?: boolean;
  compareDisabled?: boolean;
  onCompareToggle?: (offerId: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const status = statusCopy[match.status as MatchStatus];
  const firstIssue = match.conditions[0] ?? match.reasons[0];
  const firstNearMiss = match.near_miss_suggestions[0];

  return (
    <motion.article
      layout={reducedMotion ? false : "position"}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-athar"
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {!match.rate_verified && <UnverifiedBadge hint={unverifiedRateHint} />}
        </div>
        <strong className="break-words text-base text-ink">{match.institution}</strong>
        <p className="break-words text-sm text-muted">{match.product}</p>
      </header>

      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-surface-soft p-3">
        <div>
          <dt className="text-xs text-muted">{strings.offers.installment}</dt>
          <dd className="text-sm font-black text-ink">{formatSar(match.monthly_installment)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.common.apr}</dt>
          <dd className="text-sm font-black text-ink">{formatPercent(match.apr_effective)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.offers.total}</dt>
          <dd className="text-sm font-black text-ink">
            {formatSar(match.total_amount_payable)}
          </dd>
        </div>
      </dl>

      {!compact && (firstIssue || firstNearMiss) && (
        <div className="space-y-1 text-xs leading-6 text-muted">
          {firstIssue && <p>{firstIssue}</p>}
          {firstNearMiss && <p className="font-bold text-brand">{formatNearMiss(firstNearMiss)}</p>}
        </div>
      )}

      {(detailHref || onCompareToggle) && (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {detailHref && (
            <Link
              href={detailHref}
              prefetch={false}
              className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-brand hover:border-brand"
            >
              {strings.offers.detailsLink}
            </Link>
          )}
          {onCompareToggle && (
            <button
              type="button"
              disabled={compareDisabled}
              onClick={() => onCompareToggle(match.offer_id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:opacity-40 ${
                compareSelected
                  ? "bg-brand text-white"
                  : "border border-line text-muted hover:text-ink"
              }`}
            >
              {compareSelected ? strings.offers.compareSelected : strings.offers.compareButton}
            </button>
          )}
        </div>
      )}
    </motion.article>
  );
});
