import type { FormEvent } from "react";

import { applicationProgressOrder, applicationStatusLabels, statusCopy } from "../data";
import { formatSar } from "../format";
import type { ApplicationRecord, ChatMessage, JourneyResponse, OfferMatch } from "../types";
import { EmptyState } from "../components/EmptyState";
import { OfferCard } from "../components/OfferCard";

export type DeliverStageProps = {
  application: ApplicationRecord | null;
  applicationCandidates: OfferMatch[];
  applicationError: string;
  chatError: string;
  chatInput: string;
  chatMessages: ChatMessage[];
  isApplicationLoading: boolean;
  isChatLoading: boolean;
  journey: JourneyResponse | null;
  recommendedMatch: OfferMatch | null;
  selectedApplicationMatch: OfferMatch | null;
  onApplicationAdvance: () => void;
  onApplicationCreate: (offerId: string) => void;
  onApplicationOfferSelect: (offerId: string) => void;
  onApplicationSubmit: () => void;
  onChatInputChange: (value: string) => void;
  onChatSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function DeliverStage({
  application,
  applicationCandidates,
  applicationError,
  chatError,
  chatInput,
  chatMessages,
  isApplicationLoading,
  isChatLoading,
  journey,
  recommendedMatch,
  selectedApplicationMatch,
  onApplicationAdvance,
  onApplicationCreate,
  onApplicationOfferSelect,
  onApplicationSubmit,
  onChatInputChange,
  onChatSubmit,
}: DeliverStageProps) {
  if (!journey) {
    return <EmptyState title="لا يوجد قرار جاهز" />;
  }

  return (
    <div className="deliverGrid">
      <section className="recommendationPanel">
        <div>
          <p className="eyebrow">Deliver</p>
          <h3>{recommendedMatch ? "أفضل مسار قابل للتنفيذ" : "لا يوجد عرض مناسب حالياً"}</h3>
        </div>

        {recommendedMatch ? (
          <OfferCard match={recommendedMatch} compact />
        ) : (
          <p className="emptyText">
            الالتزامات الحالية تتجاوز المساحة التمويلية المتاحة. القرار الأنسب هو تخفيض
            الالتزامات أو تقليل مبلغ التمويل.
          </p>
        )}

        <ol className="nextSteps">
          <li>مراجعة العروض ذات الأسعار غير المؤكدة قبل أي عرض رسمي.</li>
          <li>مطابقة المتطلبات مع جهة العمل وتحويل الراتب إن كان شرطاً.</li>
          <li>حفظ أسباب الرفض لشرح القرار للعميل أو لجنة التحكيم.</li>
        </ol>

        <ApplicationTracker
          application={application}
          candidateMatches={applicationCandidates}
          error={applicationError}
          isLoading={isApplicationLoading}
          selectedMatch={selectedApplicationMatch}
          onAdvance={onApplicationAdvance}
          onCreate={onApplicationCreate}
          onOfferSelect={onApplicationOfferSelect}
          onSubmit={onApplicationSubmit}
        />
      </section>

      <section className="advisorPanel">
        <div className="panelHeading">
          <div>
            <p className="eyebrow">Advisor</p>
            <h3>المستشار</h3>
          </div>
          <span className="connectionPill">اختياري</span>
        </div>

        <div className="chatWindow" aria-live="polite">
          {chatMessages.length === 0 && (
            <p className="emptyText">اسأل عن سبب التوصية أو الرفض بناءً على نتائج الرحلة.</p>
          )}
          {chatMessages.map((message, index) => (
            <p key={`${message.role}-${index}`} className={`chatBubble ${message.role}`}>
              {message.text}
            </p>
          ))}
          {chatError && <p className="errorBanner">{chatError}</p>}
        </div>

        {journey.suggested_questions.length > 0 && (
          <div className="suggestedQuestions" aria-label="أسئلة مقترحة">
            {journey.suggested_questions.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onChatInputChange(question)}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        <form className="chatForm" onSubmit={onChatSubmit}>
          <input
            value={chatInput}
            placeholder="اكتب سؤالك"
            onChange={(event) => onChatInputChange(event.target.value)}
          />
          <button disabled={isChatLoading || !chatInput.trim()} type="submit">
            {isChatLoading ? "..." : "إرسال"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ApplicationTracker({
  application,
  candidateMatches,
  error,
  isLoading,
  selectedMatch,
  onAdvance,
  onCreate,
  onOfferSelect,
  onSubmit,
}: {
  application: ApplicationRecord | null;
  candidateMatches: OfferMatch[];
  error: string;
  isLoading: boolean;
  selectedMatch: OfferMatch | null;
  onAdvance: () => void;
  onCreate: (offerId: string) => void;
  onOfferSelect: (offerId: string) => void;
  onSubmit: () => void;
}) {
  const isFinal = application?.status === "approved" || application?.status === "declined";

  return (
    <section className="applicationPanel">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Application</p>
          <h3>طلب تجريبي</h3>
        </div>
        <span className="warningBadge">محاكاة</span>
      </div>

      {!application && (
        <>
          {candidateMatches.length > 0 ? (
            <div className="applicationChoices" aria-label="اختيار عرض للتقديم">
              {candidateMatches.map((match) => {
                const isSelected = selectedMatch?.offer_id === match.offer_id;
                const status = statusCopy[match.status];
                return (
                  <button
                    key={match.offer_id}
                    className={isSelected ? "applicationChoiceSelected" : ""}
                    type="button"
                    onClick={() => onOfferSelect(match.offer_id)}
                  >
                    <span className={`statusBadge ${status.className}`}>{status.label}</span>
                    <strong>{match.institution}</strong>
                    <small>
                      {formatSar(match.monthly_installment)} ·{" "}
                      {formatSar(match.total_amount_payable)}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="emptyText">لا يوجد عرض قابل للتقديم في هذه الرحلة.</p>
          )}

          <button
            className="secondaryButton"
            disabled={!selectedMatch || isLoading}
            type="button"
            onClick={() => selectedMatch && onCreate(selectedMatch.offer_id)}
          >
            {isLoading ? "جاري التجهيز..." : "جهز الطلب المختار"}
          </button>
        </>
      )}

      {application && (
        <>
          <div className="applicationSummary">
            <strong>{applicationStatusLabels[application.status] ?? application.status}</strong>
            <p>{application.summary.simulation_notice_ar}</p>
          </div>
          <dl className="applicationSummaryGrid">
            <div>
              <dt>الممول</dt>
              <dd>{application.summary.institution}</dd>
            </div>
            <div>
              <dt>المنتج</dt>
              <dd>{application.summary.product}</dd>
            </div>
            <div>
              <dt>القسط</dt>
              <dd>{formatSar(application.summary.monthly_installment)}</dd>
            </div>
            <div>
              <dt>الإجمالي</dt>
              <dd>{formatSar(application.summary.total_amount_payable)}</dd>
            </div>
          </dl>
          <ApplicationProgress status={application.status} />
          <div className="applicationTimeline">
            {application.history.map((item) => (
              <p key={`${item.status}-${item.created_at}`}>
                <span>{applicationStatusLabels[item.status] ?? item.status}</span>
                {item.message_ar}
              </p>
            ))}
          </div>
          <div className="applicationActions">
            {application.status === "draft" && (
              <button disabled={isLoading} type="button" onClick={onSubmit}>
                {isLoading ? "..." : "إرسال المحاكاة"}
              </button>
            )}
            {(application.status === "submitted" || application.status === "under_review") && (
              <button disabled={isLoading} type="button" onClick={onAdvance}>
                {isLoading ? "..." : "تحديث الحالة"}
              </button>
            )}
            {isFinal && <span>{applicationStatusLabels[application.status]}</span>}
          </div>
        </>
      )}

      {error && <p className="errorBanner">{error}</p>}
    </section>
  );
}

function ApplicationProgress({ status }: { status: string }) {
  const steps = [
    ...applicationProgressOrder,
    status === "declined" ? "declined" : "approved",
  ];
  const currentIndex = steps.indexOf(status);

  return (
    <ol className="applicationProgress" aria-label="تقدم الطلب التجريبي">
      {steps.map((step, index) => {
        const isDone = currentIndex >= 0 && index < currentIndex;
        const isCurrent = step === status;
        return (
          <li
            key={step}
            className={`${isDone ? "progressDone" : ""} ${isCurrent ? "progressCurrent" : ""}`}
          >
            <span>{index + 1}</span>
            <strong>{applicationStatusLabels[step] ?? step}</strong>
          </li>
        );
      })}
    </ol>
  );
}
