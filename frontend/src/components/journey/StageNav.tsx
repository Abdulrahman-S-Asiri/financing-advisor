"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { EmptyState, SkeletonCard } from "@/components/ui";
import { strings } from "@/lib/strings";
import { useJourneyStore } from "@/stores/journey";

export function StageNav() {
  const pathname = usePathname();
  const journey = useJourneyStore((state) => state.journey);
  const running = useJourneyStore((state) => state.running);

  return (
    <nav aria-label={strings.journey.stagesTitle} className="mb-6">
      <ol className="flex flex-wrap gap-2">
        {strings.journey.stages.map((stage, index) => {
          const active = pathname === stage.href;
          const unlocked = index === 0 || journey !== null || running;
          return (
            <li key={stage.href}>
              {unlocked ? (
                <Link
                  href={stage.href}
                  aria-current={active ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-muted hover:text-ink"
                  }`}
                >
                  <span aria-hidden className="rotate-45 text-[0.6rem]">◆</span>
                  {stage.label}
                </Link>
              ) : (
                <span className="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-2 text-sm font-bold text-muted/60">
                  <span aria-hidden className="rotate-45 text-[0.6rem]">◇</span>
                  {stage.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function useJourneyStoreHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(useJourneyStore.persist.hasHydrated());
    return useJourneyStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

/**
 * Guards deep stage routes: without a journey (and no run in flight) the user
 * is sent back to the start. Renders a friendly fallback for the one frame
 * before redirect and for direct visits with an empty store.
 */
export function JourneyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useJourneyStoreHydrated();
  const journey = useJourneyStore((state) => state.journey);
  const running = useJourneyStore((state) => state.running);

  useEffect(() => {
    if (hydrated && !journey && !running) {
      router.replace("/journey");
    }
  }, [hydrated, journey, running, router]);

  if (!hydrated) {
    return (
      <div role="status" aria-label={strings.journey.guardHydrating}>
        <SkeletonCard />
      </div>
    );
  }

  if (!journey && !running) {
    return (
      <EmptyState
        title={strings.journey.guardStart}
        actionLabel={strings.journey.guardAction}
        actionHref="/journey"
      />
    );
  }
  return <>{children}</>;
}

export function JourneyShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <StageNav />
      {children}
    </div>
  );
}
