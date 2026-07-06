import type { Metadata } from "next";
import Link from "next/link";

import { Card, SectionHeading } from "@/components/ui";
import { strings } from "@/lib/strings";

export const metadata: Metadata = {
  title: strings.docs.metaTitle,
};

export default function DocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-4xl font-black text-ink">{strings.docs.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{strings.docs.lead}</p>
      </header>

      <div className="space-y-5">
        <Card>
          <SectionHeading title={strings.docs.idea.title} />
          <p className="text-sm leading-7 text-muted">{strings.docs.idea.text}</p>
        </Card>

        <Card>
          <SectionHeading title={strings.docs.engine.title} />
          <p className="text-sm leading-7 text-muted">{strings.docs.engine.text}</p>
        </Card>

        <Card>
          <SectionHeading title={strings.docs.data.title} />
          <ol
            aria-label={strings.docs.flowAria}
            className="mb-4 grid gap-2 md:grid-cols-4"
          >
            {strings.docs.flow.map((step) => (
              <li
                key={step}
                className="rounded-xl border border-line bg-surface-soft p-3 text-sm font-bold text-ink"
              >
                {step}
              </li>
            ))}
          </ol>
          <p className="text-sm leading-7 text-muted">{strings.docs.data.text}</p>
        </Card>

        <Card>
          <SectionHeading title={strings.docs.limits.title} />
          <ul className="space-y-2">
            {strings.docs.limits.items.map((item) => (
              <li key={item} className="rounded-xl bg-danger/5 p-3 text-sm leading-7 text-muted">
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionHeading title={strings.docs.verification.title} />
          <p className="text-sm leading-7 text-muted">
            {strings.docs.verification.text}{" "}
            <Link href="/status" className="font-bold text-brand dark:text-accent">
              {strings.docs.verification.link}
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
