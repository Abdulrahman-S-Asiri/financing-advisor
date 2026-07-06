"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { personas } from "../../features/journey/data";

type Healthz = {
  status: string;
  version: string;
  offers_loaded: number;
  catalog_valid: boolean;
  postgres_enabled: boolean;
  llm_configured: boolean;
  open_banking_provider: string;
};

type VerificationIssue = {
  offer_id: string | null;
  severity: string;
  code: string;
  message: string;
};

type Verification = {
  total_offers: number;
  verified_count: number;
  unverified_count: number;
  missing_source_count: number;
  stale_verified_count: number;
  target_min_offers: number;
  ready_for_public_demo: boolean;
  issues: VerificationIssue[];
};

type OpenBankingStatus = {
  provider: string;
  mock_mode: boolean;
};

type Analytics = {
  journeys: { total: number; with_path_forward: number };
  applications: { total: number; status_counts: Record<string, number> };
};

type Fetched<T> = { state: "loading" } | { state: "error" } | { state: "ok"; data: T };

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

function Bool({ value, warnWhenOff = false }: { value: boolean; warnWhenOff?: boolean }) {
  const className = value
    ? "statusBool statusBoolOn"
    : `statusBool ${warnWhenOff ? "statusBoolWarn" : "statusBoolOff"}`;
  return <span className={className}>{value ? "مفعل" : "غير مفعل"}</span>;
}

function CardState({ result }: { result: { state: "loading" } | { state: "error" } }) {
  return (
    <p className="emptyText">
      {result.state === "loading" ? "جاري التحميل..." : "تعذر تحميل هذه البيانات."}
    </p>
  );
}

function groupIssues(issues: VerificationIssue[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  }
  return [...counts.entries()];
}

export default function StatusDashboard() {
  const [health, setHealth] = useState<Fetched<Healthz>>({ state: "loading" });
  const [verification, setVerification] = useState<Fetched<Verification>>({ state: "loading" });
  const [openBanking, setOpenBanking] = useState<Fetched<OpenBankingStatus>>({ state: "loading" });
  const [analytics, setAnalytics] = useState<Fetched<Analytics>>({ state: "loading" });
  const [refreshedAt, setRefreshedAt] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    setHealth({ state: "loading" });
    setVerification({ state: "loading" });
    setOpenBanking({ state: "loading" });
    setAnalytics({ state: "loading" });

    const [h, v, ob, a] = await Promise.allSettled([
      fetchJson<Healthz>("/backend/healthz"),
      fetchJson<Verification>("/backend/offers/verification"),
      fetchJson<OpenBankingStatus>("/backend/integrations/open-banking/status"),
      fetchJson<Analytics>("/backend/analytics/overview"),
    ]);

    setHealth(h.status === "fulfilled" ? { state: "ok", data: h.value } : { state: "error" });
    setVerification(v.status === "fulfilled" ? { state: "ok", data: v.value } : { state: "error" });
    setOpenBanking(ob.status === "fulfilled" ? { state: "ok", data: ob.value } : { state: "error" });
    setAnalytics(a.status === "fulfilled" ? { state: "ok", data: a.value } : { state: "error" });
    setRefreshedAt(new Date().toLocaleTimeString("ar-SA"));
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const backendDown = health.state === "error";

  return (
    <main className="sitePage">
      <div className="statusHeader">
        <div>
          <p className="eyebrow">صفحة داخلية</p>
          <h1>حالة أثر</h1>
        </div>
        <button
          className="statusRefresh"
          type="button"
          disabled={isRefreshing}
          onClick={() => void load()}
        >
          {isRefreshing ? "..." : "تحديث"}
        </button>
      </div>

      <div className="statusGrid">
        {backendDown && (
          <section className="statusDownCard">
            <h2>الخادم غير متصل</h2>
            <p className="emptyText">
              تحقق من تشغيل الواجهة الخلفية ثم اضغط تحديث:
            </p>
            <code>uvicorn api.main:app --port 8000</code>
          </section>
        )}

        <section className="statusCard" aria-label="صحة الخدمة">
          <h2>الخدمة</h2>
          {health.state !== "ok" ? (
            <CardState result={health} />
          ) : (
            <div className="statusRows">
              <div className="statusRow">
                <span>الإصدار</span>
                <strong>{health.data.version}</strong>
              </div>
              <div className="statusRow">
                <span>العروض المحملة</span>
                <strong>{health.data.offers_loaded}</strong>
              </div>
              <div className="statusRow">
                <span>سلامة بنية الكتالوج</span>
                <Bool value={health.data.catalog_valid} warnWhenOff />
              </div>
              <div className="statusRow">
                <span>قاعدة بيانات دائمة</span>
                <Bool value={health.data.postgres_enabled} />
              </div>
              <div className="statusRow">
                <span>مزود النموذج اللغوي</span>
                <Bool value={health.data.llm_configured} />
              </div>
              <p className="statusMeta">
                تُعرض حالة الإعدادات كقيم منطقية فقط — لا تُعرض أي قيم سرية.
              </p>
            </div>
          )}
        </section>

        <section className="statusCard" aria-label="التحقق من الأسعار">
          <h2>التحقق من أسعار العروض</h2>
          {verification.state !== "ok" ? (
            <CardState result={verification} />
          ) : (
            <div className="statusRows">
              <div className="statusRow">
                <span>عروض مؤكدة المصدر</span>
                <strong>
                  {verification.data.verified_count} / {verification.data.total_offers}
                </strong>
              </div>
              <div className="statusRow">
                <span>الهدف الأدنى للكتالوج</span>
                <strong>{verification.data.target_min_offers}</strong>
              </div>
              <div className="statusRow">
                <span>جاهز للعرض العام</span>
                <Bool value={verification.data.ready_for_public_demo} warnWhenOff />
              </div>
              {verification.data.issues.length > 0 && (
                <ul className="statusIssueList">
                  {groupIssues(verification.data.issues).map(([code, count]) => (
                    <li key={code}>
                      {code} × {count}
                    </li>
                  ))}
                </ul>
              )}
              <p className="statusMeta">
                الأسعار غير المؤكدة تبقى موسومة في كل الشاشات حتى تُراجع من
                المصادر الرسمية.
              </p>
            </div>
          )}
        </section>

        <section className="statusCard" aria-label="الخدمات المصرفية المفتوحة">
          <h2>الخدمات المصرفية المفتوحة</h2>
          {openBanking.state !== "ok" ? (
            <CardState result={openBanking} />
          ) : (
            <div className="statusRows">
              <div className="statusRow">
                <span>المزود</span>
                <strong>{openBanking.data.provider}</strong>
              </div>
              <div className="statusRow">
                <span>وضع المحاكاة</span>
                <Bool value={openBanking.data.mock_mode} />
              </div>
            </div>
          )}
        </section>

        <section className="statusCard" aria-label="نشاط الجلسة">
          <h2>نشاط الجلسة</h2>
          {analytics.state !== "ok" ? (
            <CardState result={analytics} />
          ) : (
            <div className="statusRows">
              <div className="statusRow">
                <span>رحلات محفوظة</span>
                <strong>{analytics.data.journeys.total}</strong>
              </div>
              <div className="statusRow">
                <span>رحلات لها مسار متاح</span>
                <strong>{analytics.data.journeys.with_path_forward}</strong>
              </div>
              <div className="statusRow">
                <span>طلبات تجريبية</span>
                <strong>{analytics.data.applications.total}</strong>
              </div>
              <p className="statusMeta">
                إحصاءات مجمعة من ذاكرة الخادم الحالية (أحدث الرحلات فقط) —
                دون معرفات أو عمليات خام.
              </p>
            </div>
          )}
        </section>

        <section className="statusCard" aria-label="اختصارات التجربة">
          <h2>اختصارات التجربة</h2>
          <div className="personaShortcuts">
            {personas.map((persona) => (
              <Link key={persona.id} href={`/journey?persona=${persona.id}`}>
                {persona.name} — {persona.label}
              </Link>
            ))}
          </div>
          {refreshedAt && <p className="statusMeta">آخر تحديث: {refreshedAt}</p>}
        </section>
      </div>
    </main>
  );
}
