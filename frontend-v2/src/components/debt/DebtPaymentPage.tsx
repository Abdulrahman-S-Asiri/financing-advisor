"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge, Card, SectionHeading } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { strings } from "@/lib/strings";

export function DebtPaymentPage() {
  const [selectedObligation, setSelectedObligation] = useState(0);
  const [selectedStage, setSelectedStage] = useState(0);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="mb-8">
        <Badge tone="warn">{strings.debtPayment.eyebrow}</Badge>
        <h1 className="mt-4 text-4xl font-black text-ink">{strings.debtPayment.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          {strings.debtPayment.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/journey"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-strong dark:bg-accent dark:text-navy dark:hover:bg-accent/90"
          >
            {strings.debtPayment.cta}
          </Link>
          <Link
            href="/docs"
            className="rounded-xl border border-line px-5 py-2.5 text-sm font-bold text-brand hover:border-brand dark:text-accent"
          >
            {strings.nav.docs}
          </Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <SectionHeading title={strings.debtPayment.obligationsTitle} />
          <p className="mb-4 text-sm leading-7 text-muted">
            {strings.debtPayment.obligationsHint}
          </p>
          <div className="grid gap-2">
            {strings.debtPayment.obligations.map((obligation, index) => (
              <button
                key={obligation}
                type="button"
                aria-pressed={selectedObligation === index}
                onClick={() => setSelectedObligation(index)}
                className={`rounded-xl border px-4 py-3 text-start text-sm font-bold transition-colors ${
                  selectedObligation === index
                    ? "border-brand bg-brand/10 text-ink"
                    : "border-line text-muted hover:border-brand/50 hover:text-ink"
                }`}
              >
                {obligation}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading title={strings.debtPayment.stagesTitle} />
          <div className="grid gap-3">
            {strings.debtPayment.stages.map((stage, index) => (
              <button
                key={stage}
                type="button"
                aria-pressed={selectedStage === index}
                onClick={() => setSelectedStage(index)}
                className={`rounded-xl border p-4 text-start transition-colors ${
                  selectedStage === index
                    ? "border-brand bg-brand/10"
                    : "border-line hover:border-brand/50"
                }`}
              >
                <span className="block text-xs font-black text-brand dark:text-accent">
                  {strings.debtPayment.selectedLabel} {formatNumber(index + 1)}
                </span>
                <span className="mt-1 block text-sm font-bold text-ink">{stage}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeading title={strings.debtPayment.documentsTitle} />
          <ul className="space-y-2">
            {strings.debtPayment.documents.map((document) => (
              <li key={document} className="rounded-xl bg-surface-soft p-3 text-sm text-muted">
                {document}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeading title={strings.debtPayment.guardrailsTitle} />
          <ul className="space-y-2">
            {strings.debtPayment.guardrails.map((guardrail) => (
              <li key={guardrail} className="rounded-xl bg-danger/5 p-3 text-sm leading-7 text-muted">
                {guardrail}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm font-bold text-ink">
            {strings.debtPayment.noPaymentAction}
          </p>
        </Card>
      </div>
    </main>
  );
}
