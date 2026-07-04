"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { statusCopy } from "../../../../../features/journey/data";
import {
  formatCap,
  formatNearMiss,
  formatPercent,
  formatSar,
} from "../../../../../features/journey/format";
import type {
  AgentEvent,
  OfferMatch,
  PaymentScheduleRow,
} from "../../../../../features/journey/types";

type OfferPolicy = {
  id: string;
  institution: string;
  product_name: string;
  category: string;
  structure: string;
  flat_rate_annual: number;
  admin_fee_pct: number;
  admin_fee_cap_sar: number;
  min_amount: number;
  max_amount: number;
  min_tenor_months: number;
  max_tenor_months: number;
  min_gross_salary: number;
  salary_transfer_required: boolean;
  eligible_employment: string[];
  nationality: string[];
  max_age_at_maturity: number;
  rate_verified: boolean;
  source_url: string;
  retrieved_at: string;
  notes: string;
};

type OfferDetail = OfferMatch & {
  offer: OfferPolicy;
};

type OfferDetailResponse = {
  journey_id: string;
  tool: string;
  event: AgentEvent;
  offer: OfferDetail;
};

type PaymentScheduleResponse = {
  journey_id: string;
  tool: string;
  event: AgentEvent;
  offer_id: string;
  payment_schedule: PaymentScheduleRow[];
};

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.detail ?? "تعذر تحميل تفاصيل العرض.");
  }
  return body as T;
}

export default function OfferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const journeyId = paramValue(params.journeyId);
  const offerId = paramValue(params.offerId);
  const [detail, setDetail] = useState<OfferDetail | null>(null);
  const [schedule, setSchedule] = useState<PaymentScheduleRow[]>([]);
  const [error, setError] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [isDetailLoading, setIsDetailLoading] = useState(true);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  useEffect(() => {
    if (!journeyId || !offerId) {
      setError("رابط العرض غير مكتمل.");
      setIsDetailLoading(false);
      setIsScheduleLoading(false);
      return;
    }

    const controller = new AbortController();
    const detailUrl = `/backend/advisor/tools/${journeyId}/offers/${offerId}`;
    const scheduleUrl = `${detailUrl}/payment-schedule`;

    async function loadDetail() {
      setIsDetailLoading(true);
      setError("");
      setDetail(null);
      try {
        const detailBody = await fetch(detailUrl, { signal: controller.signal }).then(
          readJson<OfferDetailResponse>,
        );
        setDetail(detailBody.offer);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "تعذر تحميل تفاصيل العرض.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsDetailLoading(false);
        }
      }
    }

    async function loadSchedule() {
      setIsScheduleLoading(true);
      setScheduleError("");
      setSchedule([]);
      try {
        const scheduleBody = await fetch(scheduleUrl, { signal: controller.signal }).then(
          readJson<PaymentScheduleResponse>,
        );
        setSchedule(scheduleBody.payment_schedule);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setScheduleError(
            loadError instanceof Error ? loadError.message : "تعذر تحميل جدول السداد.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsScheduleLoading(false);
        }
      }
    }

    loadDetail();
    loadSchedule();
    return () => controller.abort();
  }, [journeyId, offerId]);

  const status = detail ? statusCopy[detail.status] : null;
  const policyFacts = useMemo(() => {
    if (!detail) {
      return [];
    }
    return [
      ["نوع التمويل", detail.offer.structure],
      ["الفئة", detail.offer.category],
      ["الحد الأدنى", formatSar(detail.offer.min_amount)],
      ["الحد الأعلى", formatSar(detail.offer.max_amount)],
      ["أقل راتب", formatSar(detail.offer.min_gross_salary)],
      ["المدة", `${detail.offer.min_tenor_months} - ${detail.offer.max_tenor_months} شهر`],
      ["تحويل الراتب", detail.offer.salary_transfer_required ? "مطلوب" : "غير مطلوب"],
      ["أقصى عمر عند الاستحقاق", `${detail.offer.max_age_at_maturity}`],
    ];
  }, [detail]);

  if (isDetailLoading) {
    return (
      <main className="detailShell">
        <section className="emptyState">
          <h3>جاري تحميل تفاصيل العرض</h3>
        </section>
      </main>
    );
  }

  if (error || !detail || !status) {
    return (
      <main className="detailShell">
        <section className="emptyState">
          <h3>{error || "العرض غير متاح"}</h3>
          <button className="secondaryButton" type="button" onClick={() => router.back()}>
            رجوع
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="detailShell">
      <header className="detailTopbar">
        <button className="backButton" type="button" onClick={() => router.back()}>
          العودة
        </button>
        <Link className="detailLink" href="/">
          الرحلة
        </Link>
      </header>

      <section className="detailHero">
        <div>
          <p className="eyebrow">تفاصيل العرض</p>
          <h1>{detail.institution}</h1>
          <p>{detail.product}</p>
        </div>
        <div className="detailBadges">
          <span className={`statusBadge ${status.className}`}>{status.label}</span>
          {!detail.rate_verified && <span className="warningBadge">سعر غير مؤكد</span>}
        </div>
      </section>

      <section className="metricsGrid">
        <article className="metricCard">
          <span>القسط الشهري</span>
          <strong>{formatSar(detail.monthly_installment)}</strong>
        </article>
        <article className="metricCard">
          <span>APR</span>
          <strong>{formatPercent(detail.apr_effective)}</strong>
        </article>
        <article className="metricCard">
          <span>إجمالي السداد</span>
          <strong>{formatSar(detail.total_amount_payable)}</strong>
        </article>
      </section>

      <section className="detailGrid">
        {detail.cost_breakdown && (
          <section className="detailPanel">
            <div className="panelHeading">
              <div>
                <p className="eyebrow">التكلفة</p>
                <h2>تفاصيل التكلفة</h2>
              </div>
            </div>
            <dl className="detailFacts">
              <div>
                <dt>مبلغ التمويل</dt>
                <dd>{formatSar(detail.cost_breakdown.principal)}</dd>
              </div>
              <div>
                <dt>الربح الإجمالي</dt>
                <dd>{formatSar(detail.cost_breakdown.total_profit)}</dd>
              </div>
              <div>
                <dt>الرسوم الإدارية</dt>
                <dd>{formatSar(detail.cost_breakdown.admin_fee)}</dd>
              </div>
              <div>
                <dt>المعدل الثابت</dt>
                <dd>{formatPercent(detail.cost_breakdown.flat_rate_annual)}</dd>
              </div>
              <div>
                <dt>المدة</dt>
                <dd>{detail.cost_breakdown.tenor_months} شهر</dd>
              </div>
              <div>
                <dt>APR</dt>
                <dd>{formatPercent(detail.cost_breakdown.apr_effective)}</dd>
              </div>
            </dl>
          </section>
        )}

        {detail.dbr && (
          <section className="detailPanel">
            <div className="panelHeading">
              <div>
                <p className="eyebrow">نسبة الالتزامات</p>
                <h2>أثر الالتزامات</h2>
              </div>
              <span className="connectionPill">شريحة {detail.dbr.tier}</span>
            </div>
            <dl className="detailFacts">
              <div>
                <dt>مرتبط بالراتب</dt>
                <dd>
                  {formatPercent(detail.dbr.salary_linked_ratio)} /{" "}
                  {formatCap(detail.dbr.salary_linked_cap)}
                </dd>
              </div>
              <div>
                <dt>غير عقاري</dt>
                <dd>
                  {formatPercent(detail.dbr.non_real_estate_ratio)} /{" "}
                  {formatCap(detail.dbr.non_real_estate_cap)}
                </dd>
              </div>
              <div>
                <dt>الإجمالي</dt>
                <dd>
                  {formatPercent(detail.dbr.total_ratio)} / {formatCap(detail.dbr.total_cap)}
                </dd>
              </div>
            </dl>
            {detail.dbr.breaches.length > 0 && (
              <div className="traceList">
                {detail.dbr.breaches.map((breach) => (
                  <p key={breach}>{breach}</p>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="detailPanel">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">الشروط</p>
              <h2>شروط العرض</h2>
            </div>
          </div>
          <dl className="detailFacts">
            {policyFacts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {detail.offer.notes && <p className="emptyText">{detail.offer.notes}</p>}
        </section>

        <section className="detailPanel">
          <div className="panelHeading">
            <div>
              <p className="eyebrow">مسار القرار</p>
              <h2>أسباب القرار</h2>
            </div>
          </div>
          <div className="traceList">
            {detail.conditions.map((condition) => (
              <p key={condition}>شرط: {condition}</p>
            ))}
            {detail.reasons.map((reason) => (
              <p key={reason}>سبب: {reason}</p>
            ))}
            {detail.near_miss_suggestions.map((suggestion) => (
              <p key={`${suggestion.kind}-${suggestion.requested_amount ?? ""}`}>
                {formatNearMiss(suggestion)}
              </p>
            ))}
            {detail.conditions.length === 0 &&
              detail.reasons.length === 0 &&
              detail.near_miss_suggestions.length === 0 && <p>لا توجد ملاحظات إضافية.</p>}
          </div>
        </section>
      </section>

      <section className="detailPanel">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">السداد</p>
            <h2>جدول السداد</h2>
          </div>
          <span className="connectionPill">{schedule.length} شهر</span>
        </div>
        {isScheduleLoading ? (
          <p className="emptyText">جاري تحميل جدول السداد.</p>
        ) : scheduleError ? (
          <p className="errorBanner">{scheduleError}</p>
        ) : schedule.length > 0 ? (
          <div className="scheduleTable">
            <div className="scheduleTableHead">
              <span>الشهر</span>
              <span>القسط</span>
              <span>الأصل</span>
              <span>الربح</span>
              <span>المتبقي</span>
            </div>
            {schedule.map((row) => (
              <div className="scheduleTableRow" key={`${offerId}-month-${row.month}`}>
                <span>شهر {row.month}</span>
                <span>{formatSar(row.installment)}</span>
                <span>{formatSar(row.principal_component)}</span>
                <span>{formatSar(row.profit_component)}</span>
                <span>{formatSar(row.remaining_principal)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="emptyText">لا يوجد جدول سداد لهذا العرض.</p>
        )}
      </section>

      {detail.source_url && (
        <section className="sourceRow">
          <span>مصدر السعر</span>
          <a href={detail.source_url} rel="noreferrer" target="_blank">
            {detail.rate_verified ? "مصدر منشور" : "مصدر للمراجعة"}
          </a>
        </section>
      )}
    </main>
  );
}
