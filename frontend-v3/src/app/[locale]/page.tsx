import { setRequestLocale } from "next-intl/server";

import { isLocale, type Locale } from "@/i18n/locales";
import { getMessages } from "@/i18n/messages";

type HomeProps = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: HomeProps) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "ar";
  const messages = getMessages(locale);
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground sm:px-8">
      <section className="mx-auto grid min-h-[70vh] max-w-4xl place-items-center">
        <div className="max-w-2xl rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {messages.landing.eyebrow}
          </p>
          <h1 className="text-4xl font-semibold text-foreground sm:text-5xl">
            {messages.landing.heroTitle}
          </h1>
          <p className="mt-5 text-base leading-8 text-muted-foreground">
            {messages.landing.heroSubtitle}
          </p>
        </div>
      </section>
    </main>
  );
}
