import Link from "next/link";

import { strings } from "@/lib/strings";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-16rem)] w-full max-w-3xl place-items-center px-4 py-16">
      <section
        aria-labelledby="not-found-title"
        className="w-full rounded-2xl border border-line bg-surface p-6 shadow-athar md:p-8"
      >
        <p className="text-sm font-bold text-accent">{strings.common.brand}</p>
        <h1 id="not-found-title" className="mt-3 text-3xl font-black text-ink">
          {strings.errors.notFoundTitle}
        </h1>
        <p className="mt-3 leading-8 text-muted">{strings.errors.notFoundText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
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
