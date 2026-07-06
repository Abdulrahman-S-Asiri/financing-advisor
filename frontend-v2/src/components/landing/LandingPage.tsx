"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui";
import { personas } from "@/lib/data";
import { strings } from "@/lib/strings";

const numberFormatter = new Intl.NumberFormat("ar-SA", {
  maximumFractionDigits: 0,
});

const metrics = strings.landing.metrics;

function CountUp({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  const [current, setCurrent] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setCurrent(value);
      return;
    }

    let frame = 0;
    const totalFrames = 32;
    const tick = () => {
      frame += 1;
      const progress = Math.min(1, frame / totalFrames);
      setCurrent(Math.round(value * progress));
      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    };
    const id = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(id);
  }, [reducedMotion, value]);

  return <span>{numberFormatter.format(current)}</span>;
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`landingReveal ${className}`}>{children}</section>;
}

function HeroScene() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-accent/35" />
      <div className="absolute bottom-10 start-[8%] hidden h-48 w-72 rounded-2xl border border-sand/15 bg-sand/5 p-4 shadow-athar md:block">
        <div className="flex items-center justify-between gap-3">
          <span className="h-2 w-24 rounded-full bg-accent" />
          <span className="h-2 w-10 rounded-full bg-sand/30" />
        </div>
        <div className="mt-8 grid gap-3">
          <span className="h-3 w-full rounded-full bg-sand/25" />
          <span className="h-3 w-10/12 rounded-full bg-sand/20" />
          <span className="h-3 w-7/12 rounded-full bg-sand/15" />
        </div>
        <div className="mt-7 flex items-end gap-3">
          {[56, 86, 42, 72].map((height) => (
            <span
              key={height}
              className="w-9 rounded-t-xl bg-accent/55"
              style={{ height }}
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-12 end-[8%] hidden h-56 w-80 rounded-2xl border border-sand/15 bg-sand/5 p-4 shadow-athar lg:block">
        <div className="grid grid-cols-3 gap-3">
          {["DBR", "APR", "SAR"].map((label) => (
            <div key={label} className="rounded-xl border border-sand/15 p-3">
              <span className="font-mono text-xs font-semibold text-sand/60">{label}</span>
              <span className="mt-4 block h-2 rounded-full bg-accent/70" />
            </div>
          ))}
        </div>
        <div className="relative mx-auto mt-7 size-28">
          <span className="absolute inset-0 rounded-full border border-sand/20" />
          <span className="absolute inset-4 rounded-full border border-sand/25" />
          <span className="absolute inset-[2.35rem] rounded-full bg-accent" />
        </div>
      </div>
      <div className="absolute inset-x-[12%] top-24 h-px bg-sand/10" />
      <div className="absolute bottom-20 start-[24%] h-px w-[52%] bg-sand/10" />
      <div className="absolute end-[28%] top-28 size-3 rounded-full bg-accent" />
      <div className="absolute bottom-28 start-[38%] size-2 rounded-full bg-accent" />
    </div>
  );
}

export function LandingPage() {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: reducedMotion ? undefined : { staggerChildren: 0.08 },
      },
    }),
    [reducedMotion],
  );
  const item = {
    hidden: reducedMotion ? {} : { opacity: 0, y: 14 },
    show: reducedMotion ? {} : { opacity: 1, y: 0 },
  };

  return (
    <main className="bg-background text-ink">
      <section className="relative isolate overflow-hidden bg-navy text-sand">
        <HeroScene />
        <div className="relative mx-auto grid min-h-[calc(100svh-10rem)] w-full max-w-6xl content-center px-4 py-14">
          <motion.div
            variants={container}
            initial={false}
            animate={mounted ? "show" : false}
            className="max-w-3xl"
          >
            <motion.p variants={item} className="text-sm font-bold text-accent">
              {strings.landing.eyebrow}
            </motion.p>
            <motion.h1
              variants={item}
              className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-normal text-sand sm:text-5xl md:text-6xl"
            >
              {strings.landing.heroTitle}
            </motion.h1>
            <motion.p
              variants={item}
              className="mt-6 max-w-2xl text-base leading-8 text-sand/78 sm:text-lg"
            >
              {strings.landing.heroSubtitle}
            </motion.p>
            <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/journey"
                className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-black text-navy transition-colors hover:bg-accent/90"
              >
                {strings.landing.ctaPrimary}
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-xl border border-sand/25 px-5 py-3 text-sm font-black text-sand transition-colors hover:border-accent"
              >
                {strings.landing.ctaSecondary}
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
          <p className="text-sm font-bold text-ink">{strings.landing.honestyStrip}</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="warn">{strings.common.unverifiedRate}</Badge>
            <Badge tone="accent">{strings.common.simulation}</Badge>
            <Badge tone="neutral">{strings.common.demo}</Badge>
          </div>
        </div>
      </section>

      <Reveal className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-line bg-surface p-5 shadow-athar"
            >
              <p className="font-mono text-4xl font-bold text-brand">
                <CountUp value={metric.value} />
              </p>
              <p className="mt-2 text-sm font-bold text-muted">{metric.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="mx-auto w-full max-w-6xl px-4 pb-14">
        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-bold text-accent">{strings.landing.stepsEyebrow}</p>
          <h2 className="mt-2 text-3xl font-black text-ink">
            {strings.landing.stepsTitle}
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {strings.landing.steps.map((step, index) => (
            <article
              key={step.label}
              className="relative rounded-2xl border border-line bg-surface p-5 shadow-athar"
            >
              <span className="grid size-11 rotate-45 place-items-center border border-accent bg-surface-soft">
                <span className="-rotate-45 font-mono text-sm font-bold text-brand">
                  {numberFormatter.format(index + 1)}
                </span>
              </span>
              <p className="mt-5 text-sm font-black text-accent">{step.label}</p>
              <h3 className="mt-2 text-lg font-black text-ink">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{step.text}</p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal className="bg-surface py-14">
        <div className="mx-auto w-full max-w-6xl px-4">
          <div className="mb-6 max-w-2xl">
            <p className="text-sm font-bold text-accent">{strings.common.brand}</p>
            <h2 className="mt-2 text-3xl font-black text-ink">
              {strings.landing.trustTitle}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {strings.landing.trust.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-line bg-background p-5 shadow-athar"
              >
                <h3 className="text-lg font-black text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{item.text}</p>
                {"linkLabel" in item && item.linkLabel && (
                  <Link
                    href="/status"
                    className="mt-4 inline-flex text-sm font-black text-brand hover:underline dark:text-accent"
                  >
                    {item.linkLabel}
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="mx-auto w-full max-w-6xl px-4 py-14">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-accent">{strings.landing.personasCaption}</p>
            <h2 className="mt-2 text-3xl font-black text-ink">
              {strings.landing.personasTitle}
            </h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {personas.map((persona) => (
            <Link
              key={persona.id}
              href={`/journey?persona=${persona.id}`}
              className="group rounded-2xl border border-line bg-surface p-5 shadow-athar transition-colors hover:border-accent"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-black text-ink">{persona.name}</p>
                  <p className="mt-1 text-sm font-bold text-accent">{persona.label}</p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-surface-soft font-mono text-sm font-bold text-brand transition-colors group-hover:bg-accent group-hover:text-navy">
                  {numberFormatter.format(persona.age)}
                </span>
              </div>
              <p className="mt-4 min-h-20 text-sm leading-7 text-muted">{persona.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-muted">
                <span className="rounded-full bg-surface-soft px-3 py-1">
                  {numberFormatter.format(persona.amount)} {strings.common.sarSuffix}
                </span>
                <span className="rounded-full bg-surface-soft px-3 py-1">
                  {numberFormatter.format(persona.tenor)} {strings.common.monthSuffix}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal className="px-4 pb-16">
        <section className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-navy p-6 text-sand shadow-athar md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-accent">{strings.common.demo}</p>
              <h2 className="mt-2 text-3xl font-black">{strings.landing.finalCtaTitle}</h2>
            </div>
            <Link
              href="/journey"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-black text-navy transition-colors hover:bg-accent/90"
            >
              {strings.landing.finalCta}
            </Link>
          </div>
        </section>
      </Reveal>
    </main>
  );
}
