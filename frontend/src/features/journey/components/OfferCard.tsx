import { memo } from "react";

import { statusCopy } from "../data";
import {
  formatCap,
  formatNearMiss,
  formatPercent,
  formatSar,
} from "../format";
import type { OfferMatch } from "../types";

export const OfferCard = memo(function OfferCard({
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

      {match.cost_breakdown && (
        <details className="costDetails">
          <summary>تفاصيل التكلفة</summary>
          <dl className="costDetailGrid">
            <div>
              <dt>مبلغ التمويل</dt>
              <dd>{formatSar(match.cost_breakdown.principal)}</dd>
            </div>
            <div>
              <dt>الربح الإجمالي</dt>
              <dd>{formatSar(match.cost_breakdown.total_profit)}</dd>
            </div>
            <div>
              <dt>الرسوم الإدارية</dt>
              <dd>{formatSar(match.cost_breakdown.admin_fee)}</dd>
            </div>
            <div>
              <dt>المعدل الثابت</dt>
              <dd>{formatPercent(match.cost_breakdown.flat_rate_annual)}</dd>
            </div>
            <div>
              <dt>المدة</dt>
              <dd>{match.cost_breakdown.tenor_months} شهر</dd>
            </div>
            <div>
              <dt>APR</dt>
              <dd>{formatPercent(match.cost_breakdown.apr_effective)}</dd>
            </div>
          </dl>
        </details>
      )}

      {match.dbr && (
        <details className="dbrDetails">
          <summary>أثر DBR</summary>
          <dl className="dbrGrid">
            <div>
              <dt>الشريحة</dt>
              <dd>{match.dbr.tier}</dd>
            </div>
            <div>
              <dt>مرتبط بالراتب</dt>
              <dd>
                {formatPercent(match.dbr.salary_linked_ratio)} /{" "}
                {formatCap(match.dbr.salary_linked_cap)}
              </dd>
            </div>
            <div>
              <dt>غير عقاري</dt>
              <dd>
                {formatPercent(match.dbr.non_real_estate_ratio)} /{" "}
                {formatCap(match.dbr.non_real_estate_cap)}
              </dd>
            </div>
            <div>
              <dt>الإجمالي</dt>
              <dd>
                {formatPercent(match.dbr.total_ratio)} / {formatCap(match.dbr.total_cap)}
              </dd>
            </div>
          </dl>
          {match.dbr.breaches.length > 0 && (
            <div className="dbrBreaches">
              {match.dbr.breaches.map((breach) => (
                <p key={breach}>{breach}</p>
              ))}
            </div>
          )}
        </details>
      )}

      {match.source_url && (
        <div className="sourceRow">
          <span>مصدر السعر</span>
          <a href={match.source_url} rel="noreferrer" target="_blank">
            {match.rate_verified ? "مصدر منشور" : "مصدر للمراجعة"}
          </a>
        </div>
      )}

      {match.payment_schedule.length > 0 && (
        <details className="paymentSchedule">
          <summary>جدول السداد الكامل ({match.payment_schedule.length} شهر)</summary>
          <div className="scheduleTable">
            <div className="scheduleTableHead">
              <span>الشهر</span>
              <span>القسط</span>
              <span>الأصل</span>
              <span>الربح</span>
              <span>المتبقي</span>
            </div>
            {match.payment_schedule.map((row) => (
              <div className="scheduleTableRow" key={`${match.offer_id}-month-${row.month}`}>
                <span>شهر {row.month}</span>
                <span>{formatSar(row.installment)}</span>
                <span>{formatSar(row.principal_component)}</span>
                <span>{formatSar(row.profit_component)}</span>
                <span>{formatSar(row.remaining_principal)}</span>
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
});
