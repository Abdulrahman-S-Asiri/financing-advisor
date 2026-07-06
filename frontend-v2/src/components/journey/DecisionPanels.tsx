"use client";

import { useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  Card,
  ChatBubble,
  ErrorState,
  SectionHeading,
  Stepper,
  UnverifiedBadge,
} from "@/components/ui";
import {
  applicationProgressOrder,
  applicationStatusLabels,
  statusCopy,
  unverifiedRateHint,
  type MatchStatus,
} from "@/lib/data";
import { formatSar } from "@/lib/format";
import type { ApplicationRecord, OfferMatch } from "@/lib/schemas";
import { strings } from "@/lib/strings";
import { useJourneyStore } from "@/stores/journey";

export function ApplicationTracker({ candidates }: { candidates: OfferMatch[] }) {
  const application = useJourneyStore((state) => state.application);
  const busy = useJourneyStore((state) => state.applicationBusy);
  const error = useJourneyStore((state) => state.applicationError);
  const selectedOfferId = useJourneyStore((state) => state.selectedOfferId);
  const selectOffer = useJourneyStore((state) => state.selectOffer);
  const createDraft = useJourneyStore((state) => state.createDraft);
  const applicationAction = useJourneyStore((state) => state.applicationAction);

  return (
    <Card>
      <SectionHeading
        title={strings.decision.applicationTitle}
        trailing={<Badge tone="warn">{strings.common.simulation}</Badge>}
      />

      {!application && (
        <>
          {candidates.length > 0 ? (
            <div
              role="group"
              aria-label={strings.decision.chooseOfferAria}
              className="grid gap-2 sm:grid-cols-3"
            >
              {candidates.map((match) => {
                const status = statusCopy[match.status as MatchStatus];
                const selected = selectedOfferId === match.offer_id;
                return (
                  <button
                    key={match.offer_id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectOffer(match.offer_id)}
                    className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition-colors ${
                      selected ? "border-brand bg-brand/5" : "border-line hover:border-brand/50"
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {!match.rate_verified && <UnverifiedBadge hint={unverifiedRateHint} />}
                    </span>
                    <strong className="text-sm text-ink">{match.institution}</strong>
                    <small className="text-xs text-muted">
                      {formatSar(match.monthly_installment)} ·{" "}
                      {formatSar(match.total_amount_payable)}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">{strings.decision.noCandidates}</p>
          )}
          <div className="mt-4">
            <Button
              variant="secondary"
              loading={busy}
              disabled={!selectedOfferId}
              onClick={() => selectedOfferId && createDraft(selectedOfferId)}
            >
              {busy ? strings.decision.preparing : strings.decision.prepareDraft}
            </Button>
          </div>
        </>
      )}

      {application && <ApplicationSummary application={application} busy={busy} onAction={applicationAction} />}

      {error && <div className="mt-3"><ErrorState message={error} /></div>}
    </Card>
  );
}

function ApplicationSummary({
  application,
  busy,
  onAction,
}: {
  application: ApplicationRecord;
  busy: boolean;
  onAction: (action: "submit" | "advance") => void;
}) {
  const steps = [
    ...applicationProgressOrder,
    application.status === "declined" ? "declined" : "approved",
  ];
  const currentIndex = steps.indexOf(application.status);
  const isFinal = application.status === "approved" || application.status === "declined";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-soft p-3">
        <strong className="text-sm text-ink">
          {applicationStatusLabels[application.status] ?? application.status}
        </strong>
        <p className="mt-1 text-xs leading-6 text-muted">
          {application.summary.simulation_notice_ar}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">{strings.decision.lender}</dt>
          <dd className="text-sm font-bold text-ink">{application.summary.institution}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.decision.product}</dt>
          <dd className="text-sm font-bold text-ink">{application.summary.product}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.offers.installment}</dt>
          <dd className="text-sm font-bold text-ink">
            {formatSar(application.summary.monthly_installment)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">{strings.offers.total}</dt>
          <dd className="text-sm font-bold text-ink">
            {formatSar(application.summary.total_amount_payable)}
          </dd>
        </div>
      </dl>

      <Stepper
        ariaLabel={strings.decision.progressAria}
        steps={steps.map((step) => applicationStatusLabels[step] ?? step)}
        currentIndex={currentIndex}
      />

      <ol className="space-y-1 border-s-2 border-line ps-3">
        {application.history.map((item) => (
          <li key={`${item.status}-${item.created_at}`} className="text-xs leading-6 text-muted">
            <span className="font-bold text-ink">
              {applicationStatusLabels[item.status] ?? item.status}
            </span>{" "}
            — {item.message_ar}
          </li>
        ))}
      </ol>

      {!isFinal && (
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => onAction(application.status === "draft" ? "submit" : "advance")}
        >
          {application.status === "draft"
            ? strings.decision.submitApplication
            : strings.decision.advanceApplication}
        </Button>
      )}
    </div>
  );
}

export function AdvisorChat({ suggestedQuestions }: { suggestedQuestions: string[] }) {
  const messages = useJourneyStore((state) => state.chatMessages);
  const busy = useJourneyStore((state) => state.chatBusy);
  const error = useJourneyStore((state) => state.chatError);
  const sendChat = useJourneyStore((state) => state.sendChat);
  const [input, setInput] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || busy) {
      return;
    }
    void sendChat(input);
    setInput("");
  };

  return (
    <Card className="flex h-full flex-col">
      <SectionHeading
        title={strings.decision.advisorTitle}
        trailing={<Badge tone="neutral">{strings.decision.advisorOptional}</Badge>}
      />

      <div
        aria-live="polite"
        className="flex min-h-52 flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-background p-3"
      >
        {messages.length === 0 && (
          <p className="text-sm leading-7 text-muted">{strings.decision.chatEmpty}</p>
        )}
        {messages.map((message, index) => (
          <ChatBubble
            key={`${message.role}-${index}`}
            role={message.role}
            fallback={message.fallback}
          >
            {message.text}
          </ChatBubble>
        ))}
        {error && <ErrorState message={error} />}
      </div>

      {suggestedQuestions.length > 0 && (
        <div
          aria-label={strings.decision.suggestedAria}
          className="mt-3 flex flex-wrap gap-2"
        >
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => setInput(question)}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:border-brand hover:text-brand"
            >
              {question}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor="advisor-chat-input" className="sr-only">
          {strings.decision.chatInputLabel}
        </label>
        <input
          id="advisor-chat-input"
          name="advisorChat"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={strings.decision.chatPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-brand"
        />
        <Button type="submit" loading={busy} disabled={!input.trim()}>
          {strings.decision.chatSend}
        </Button>
      </form>
    </Card>
  );
}
