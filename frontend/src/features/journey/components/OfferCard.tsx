import { memo } from "react";
import Link from "next/link";

import { statusCopy, unverifiedRateHint } from "../data";
import {
  formatNearMiss,
  formatPercent,
  formatSar,
} from "../format";
import type { OfferMatch } from "../types";

export const OfferCard = memo(function OfferCard({
  compareDisabled = false,
  compareSelected = false,
  compact = false,
  detailHref,
  match,
  onCompareToggle,
}: {
  compareDisabled?: boolean;
  compareSelected?: boolean;
  compact?: boolean;
  detailHref?: string;
  match: OfferMatch;
  onCompareToggle?: (offerId: string) => void;
}) {
  const status = statusCopy[match.status];
  const firstIssue = match.conditions[0] ?? match.reasons[0];
  const firstNearMiss = match.near_miss_suggestions[0];

  return (
    <article className={`offerCard ${compact ? "offerCompact" : ""}`}>
      <header>
        <div>
          <span className={`statusBadge ${status.className}`}>{status.label}</span>
          {!match.rate_verified && (
            <span className="warningBadge" title={unverifiedRateHint}>
              سعر غير مؤكد
            </span>
          )}
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

      {(firstIssue || firstNearMiss) && (
        <div className="offerHighlights">
          {firstIssue && <p>{firstIssue}</p>}
          {firstNearMiss && <p>{formatNearMiss(firstNearMiss)}</p>}
        </div>
      )}

      {(detailHref || onCompareToggle) && (
        <div className="offerActions">
          {detailHref && (
            <Link className="detailLink" href={detailHref} prefetch={false}>
              عرض التفاصيل
            </Link>
          )}
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
        </div>
      )}
    </article>
  );
});
