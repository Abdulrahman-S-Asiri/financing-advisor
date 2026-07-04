import { statusCopy, sortOptions, statusFilters, structureFilters } from "../data";
import { formatPercent, formatSar } from "../format";
import type { JourneyResponse, MatchStatus, OfferMatch, SortMode } from "../types";
import { EmptyState } from "../components/EmptyState";
import { OfferCard } from "../components/OfferCard";

export type DevelopStageProps = {
  compareMatches: OfferMatch[];
  compareOfferIds: string[];
  filter: "all" | MatchStatus;
  hasSimulation: boolean;
  isSimulatorLoading: boolean;
  journey: JourneyResponse | null;
  simulatorAmount: number;
  simulatorError: string;
  simulatorSalaryTransfer: boolean;
  simulatorTenor: number;
  sortMode: SortMode;
  structureFilter: string;
  visibleMatches: OfferMatch[];
  onFilterChange: (value: "all" | MatchStatus) => void;
  onSortModeChange: (value: SortMode) => void;
  onStructureFilterChange: (value: string) => void;
  onSimulatorAmountChange: (value: number) => void;
  onSimulatorReset: () => void;
  onSimulatorRun: () => void;
  onSimulatorSalaryTransferChange: (value: boolean) => void;
  onSimulatorTenorChange: (value: number) => void;
  onToggleCompare: (offerId: string) => void;
};

export default function DevelopStage({
  compareMatches,
  compareOfferIds,
  filter,
  hasSimulation,
  isSimulatorLoading,
  journey,
  simulatorAmount,
  simulatorError,
  simulatorSalaryTransfer,
  simulatorTenor,
  sortMode,
  structureFilter,
  visibleMatches,
  onFilterChange,
  onSortModeChange,
  onStructureFilterChange,
  onSimulatorAmountChange,
  onSimulatorReset,
  onSimulatorRun,
  onSimulatorSalaryTransferChange,
  onSimulatorTenorChange,
  onToggleCompare,
}: DevelopStageProps) {
  if (!journey) {
    return <EmptyState title="لا توجد عروض بعد" />;
  }

  return (
    <div className="stageContent">
      <section className="comparisonHeader">
        <div>
          <p className="eyebrow">Develop</p>
          <h3>العروض المرتبة</h3>
        </div>
        <div className="segmentedControl" aria-label="تصفية العروض">
          {statusFilters.map((item) => (
            <button
              key={item.key}
              className={filter === item.key ? "segmentActive" : ""}
              type="button"
              onClick={() => onFilterChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="marketControls" aria-label="فرز وتصفية العروض">
        <div className="segmentedControl" aria-label="تصفية هيكل التمويل">
          {structureFilters.map((item) => (
            <button
              key={item.key}
              className={structureFilter === item.key ? "segmentActive" : ""}
              type="button"
              onClick={() => onStructureFilterChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="segmentedControl" aria-label="ترتيب العروض">
          {sortOptions.map((item) => (
            <button
              key={item.key}
              className={sortMode === item.key ? "segmentActive" : ""}
              type="button"
              onClick={() => onSortModeChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="requestPanel">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Simulator</p>
            <h3>اختبر سيناريو آخر</h3>
          </div>
          <span className="connectionPill">{hasSimulation ? "محاكاة مفعلة" : "المحرك"}</span>
        </div>

        <div className="formGrid">
          <label>
            <span>مبلغ التمويل</span>
            <input
              min={5000}
              step={1000}
              type="number"
              value={simulatorAmount}
              onChange={(event) => onSimulatorAmountChange(Number(event.target.value))}
            />
          </label>
          <label>
            <span>مدة التمويل بالأشهر</span>
            <input
              max={60}
              min={6}
              step={6}
              type="number"
              value={simulatorTenor}
              onChange={(event) => onSimulatorTenorChange(Number(event.target.value))}
            />
          </label>
        </div>

        <label className="consentRow">
          <input
            checked={simulatorSalaryTransfer}
            type="checkbox"
            onChange={(event) => onSimulatorSalaryTransferChange(event.target.checked)}
          />
          <span>محاكاة تحويل الراتب</span>
        </label>

        {simulatorError && <p className="errorBanner">{simulatorError}</p>}

        <div className="applicationActions">
          <button disabled={isSimulatorLoading} type="button" onClick={onSimulatorRun}>
            {isSimulatorLoading ? "..." : "تشغيل المحاكاة"}
          </button>
          {hasSimulation && (
            <button disabled={isSimulatorLoading} type="button" onClick={onSimulatorReset}>
              إعادة الأصل
            </button>
          )}
        </div>
      </section>

      {compareMatches.length > 0 && (
        <ComparePanel
          matches={compareMatches}
          onRemove={(offerId) => onToggleCompare(offerId)}
        />
      )}

      <section className="offersList" aria-label="نتائج العروض">
        {visibleMatches.length > 0 ? (
          visibleMatches.map((match) => (
            <OfferCard
              key={match.offer_id}
              compareDisabled={
                compareOfferIds.length >= 3 && !compareOfferIds.includes(match.offer_id)
              }
              compareSelected={compareOfferIds.includes(match.offer_id)}
              detailHref={`/journeys/${journey.journey_id}/offers/${match.offer_id}`}
              match={match}
              onCompareToggle={onToggleCompare}
            />
          ))
        ) : (
          <EmptyState title="لا توجد عروض مطابقة" />
        )}
      </section>
    </div>
  );
}

function ComparePanel({
  matches,
  onRemove,
}: {
  matches: OfferMatch[];
  onRemove: (offerId: string) => void;
}) {
  return (
    <section className="comparePanel" aria-label="مقارنة العروض المختارة">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Compare</p>
          <h3>مقارنة مختارة</h3>
        </div>
        <span className="connectionPill">{matches.length} / 3</span>
      </div>

      <div className="compareGrid">
        {matches.map((match) => {
          const status = statusCopy[match.status];
          const firstIssue = match.reasons[0] ?? match.conditions[0] ?? "لا توجد ملاحظات";
          return (
            <article key={match.offer_id} className="compareColumn">
              <header>
                <div>
                  <span className={`statusBadge ${status.className}`}>{status.label}</span>
                  {!match.rate_verified && <span className="warningBadge">سعر غير مؤكد</span>}
                </div>
                <strong>{match.institution}</strong>
                <p>{match.product}</p>
                <button type="button" onClick={() => onRemove(match.offer_id)}>
                  إزالة
                </button>
              </header>

              <dl className="compareRows">
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
                <div>
                  <dt>الهيكل</dt>
                  <dd>{match.structure}</dd>
                </div>
                <div>
                  <dt>جدول السداد</dt>
                  <dd>{match.payment_schedule_months || "غير متاح"}</dd>
                </div>
                <div>
                  <dt>الملاحظة</dt>
                  <dd>{firstIssue}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
