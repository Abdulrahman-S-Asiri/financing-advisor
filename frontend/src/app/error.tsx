"use client";

import Link from "next/link";

import { Button } from "@/components/ui";
import { strings } from "@/lib/strings";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-16rem)] w-full max-w-3xl place-items-center px-4 py-16">
      <section
        aria-labelledby="error-title"
        className="w-full rounded-2xl border border-danger/25 bg-surface p-6 shadow-athar md:p-8"
      >
        <p className="text-sm font-bold text-danger">{strings.common.demo}</p>
        <h1 id="error-title" className="mt-3 text-3xl font-black text-ink">
          {strings.errors.boundaryTitle}
        </h1>
        <p className="mt-3 leading-8 text-muted">
          {error.message || strings.errors.boundaryText}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={reset}>
            {strings.common.retry}
          </Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-strong dark:bg-accent dark:text-navy"
          >
            {strings.common.backHome}
          </Link>
          <Link
            href="/journey"
            className="inline-flex items-center justify-center rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-brand"
          >
            {strings.errors.goJourney}
          </Link>
        </div>
      </section>
    </main>
  );
}
