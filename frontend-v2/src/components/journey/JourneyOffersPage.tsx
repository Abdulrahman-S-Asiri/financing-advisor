"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { JourneyGuard, JourneyShell } from "@/components/journey/StageNav";
import { OfferCard } from "@/components/journey/OfferCard";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  SectionHeading,
  SegmentedControl,
  SkeletonCard,
  UnverifiedBadge,
} from "@/components/ui";
import {
  sortOptions,
  statusFilters,
  structureFilters,
  structureLabels,
  unverifiedRateHint,
  type SortMode,
} from "@/lib/data";
import { formatPercent, formatSar, sortableValue } from "@/lib/format";
import type { OfferMatch } from "@/lib/schemas";
import { strings } from "@/lib/strings";
import { useJourneyStore } from "@/stores/journey";

function sourceLabel(active: boolean) {
  return active ? strings.offers.sourceSimulation : strings.offers.sourceOriginal;
}

function sortMatches(matches: OfferMatch[], sortMode: SortMode) {
  if (sortMode === "ranked") {
    return matches;
  }

  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => {
      const diff = sortableValue(a.match, sortMode) - sortableValue(b.match, sortMode);
      return diff === 0 ? a.index - b.index : diff;
    })
    .map((item) => item.match);
}

function OffersControls({ resultCount }: { resultCount: number }) {
  const statusFilter = useJourneyStore((state) => state.statusFilter);
  const structureFilter = useJourneyStore((state) => state.structureFilter);
  const sortMode = useJourneyStore((state) => state.sortMode);
  const setStatusFilter = useJourneyStore((state) => state.setStatusFilter);
  const setStructureFilter = useJourneyStore((state) => state.setStructureFilter);
  const setSortMode = useJourneyStore((state) => state.setSortMode);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title={strings.offers.title} />
        <Badge tone="neutral">
          {resultCount} {strings.offers.resultsCount}
        </Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <SegmentedControl
          ariaLabel={strings.offers.statusFilterAria}
          options={statusFilters}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
        />
        <SegmentedControl
          ariaLabel={strings.offers.structureFilterAria}
          options={structureFilters}
          value={structureFilter}
          onChange={(value) => setStructureFilter(value)}
        />
        <SegmentedControl
          ariaLabel={strings.offers.sortAria}
          options={sortOptions}
          value={sortMode}
          onChange={(value) => setSortMode(value)}
        />
      </div>
    </section>
  );
}

function SimulatorPanel() {
  const request = useJourneyStore((state) => state.request);
  const simulation = useJourneyStore((state) => state.simulation);
  const simulating = useJourneyStore((state) => state.simulating);
  const simulationError = useJourneyStore((state) => state.simulationError);
  const simulate = useJourneyStore((state) => state.simulate);
  const resetSimulation = useJourneyStore((state) => state.resetSimulation);

  const [amount, setAmount] = useState(simulation?.requested_amount ?? request?.amount ?? 50000);
  const [tenor, setTenor] = useState(
    simulation?.requested_tenor_months ?? request?.tenor ?? 36,
  );
  const [salaryTransfer, setSalaryTransfer] = useState(
    simulation?.salary_transfer ?? false,
  );

  useEffect(() => {
    setAmount(simulation?.requested_amount ?? request?.amount ?? 50000);
    setTenor(simulation?.requested_tenor_months ?? request?.tenor ?? 36);
    setSalaryTransfer(simulation?.salary_transfer ?? false);
  }, [
    request?.amount,
    request?.tenor,
    simulation?.requested_amount,
    simulation?.requested_tenor_months,
    simulation?.salary_transfer,
  ]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void simulate(amount, tenor, salaryTransfer);
  };

  const onReset = () => {
    resetSimulation();
    setAmount(request?.amount ?? 50000);
    setTenor(request?.tenor ?? 36);
    setSalaryTransfer(false);
  };

  return (
    <Card>
      <SectionHeading
        title={strings.offers.simulatorTitle}
        trailing={
          <Badge tone={simulation ? "accent" : "neutral"}>
            {simulation ? strings.offers.simulatorActive : strings.offers.simulatorIdle}
          </Badge>
        }
      />
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <label htmlFor="simulator-amount" className="block text-sm font-bold text-ink">
          {strings.journey.amountLabel}
          </label>
          <input
            id="simulator-amount"
            name="simulatorAmount"
            type="number"
            min={5000}
            max={2000000}
            step={1000}
            value={amount}
            disabled={simulating}
            onChange={(event) => setAmount(Number(event.currentTarget.value))}
            className="w-full rounded-xl border border-line bg-surface-soft px-3 py-2 text-ink outline-none focus:border-brand"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="simulator-tenor" className="block text-sm font-bold text-ink">
          {strings.journey.tenorLabel}
          </label>
          <input
            id="simulator-tenor"
            name="simulatorTenor"
            type="number"
            min={6}
            max={60}
            step={6}
            value={tenor}
            disabled={simulating}
            onChange={(event) => setTenor(Number(event.currentTarget.value))}
            className="w-full rounded-xl border border-line bg-surface-soft px-3 py-2 text-ink outline-none focus:border-brand"
          />
        </div>
        <div className="flex flex-col gap-2 md:justify-end">
          <div className="flex items-center gap-2">
            <input
              id="simulator-salary-transfer"
              name="simulatorSalaryTransfer"
              type="checkbox"
              checked={salaryTransfer}
              disabled={simulating}
              onChange={(event) => setSalaryTransfer(event.currentTarget.checked)}
              className="size-4 accent-[var(--athar-gold)]"
            />
            <label
              htmlFor="simulator-salary-transfer"
              className="text-xs font-bold text-muted"
            >
            {strings.offers.salaryTransferLabel}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={simulating}
              className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-strong disabled:opacity-50 dark:bg-accent dark:text-navy dark:hover:bg-accent/90"
            >
              {strings.offers.runSimulation}
            </button>
            <button
              type="button"
              disabled={simulating || !simulation}
              onClick={onReset}
              className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-muted transition-colors hover:text-ink disabled:opacity-50"
            >
              {strings.offers.resetSimulation}
            </button>
          </div>
        </div>
      </form>
      {simulationError && (
        <div className="mt-4">
          <ErrorState
            message={simulationError}
            onRetry={() => void simulate(amount, tenor, salaryTransfer)}
          />
        </div>
      )}
    </Card>
  );
}

function ComparePanel({ matches }: { matches: OfferMatch[] }) {
  const compareIds = useJourneyStore((state) => state.compareIds);
  const toggleCompare = useJourneyStore((state) => state.toggleCompare);
  const selected = compareIds
    .map((id) => matches.find((match) => match.offer_id === id))
    .filter((match): match is OfferMatch => Boolean(match));

  return (
    <Card>
      <SectionHeading
        title={strings.offers.compareTitle}
        trailing={<Badge tone="neutral">{selected.length}/3</Badge>}
      />
      {selected.length === 0 ? (
        <p className="text-sm text-muted">{strings.offers.compareEmpty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {selected.map((match) => (
            <article key={match.offer_id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-ink">{match.institution}</strong>
                {!match.rate_verified && <UnverifiedBadge hint={unverifiedRateHint} />}
              </div>
              <p className="mt-1 text-xs text-muted">{match.product}</p>
              <dl className="mt-3 grid gap-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{strings.offers.structure}</dt>
                  <dd className="font-bold text-ink">
                    {structureLabels[match.structure] ?? match.structure}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{strings.offers.installment}</dt>
                  <dd className="font-bold text-ink">{formatSar(match.monthly_installment)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{strings.common.apr}</dt>
                  <dd className="font-bold text-ink">{formatPercent(match.apr_effective)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{strings.offers.total}</dt>
                  <dd className="font-bold text-ink">
                    {formatSar(match.total_amount_payable)}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => toggleCompare(match.offer_id)}
                className="mt-3 rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-muted hover:text-ink"
              >
                {strings.offers.compareRemove}
              </button>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function HardBreachNotice({ breaches }: { breaches: string[] }) {
  return (
    <Card className="border-danger/40 bg-danger/5">
      <SectionHeading
        title={strings.offers.hardBreachTitle}
        trailing={<Badge tone="danger">غير مؤهل</Badge>}
      />
      <p className="text-sm leading-7 text-muted">{strings.offers.hardBreachText}</p>
      <ul className="mt-3 space-y-1">
        {breaches.map((breach) => (
          <li key={breach} className="text-xs leading-6 text-danger">
            {breach}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OffersGrid({ matches }: { matches: OfferMatch[] }) {
  const journey = useJourneyStore((state) => state.journey);
  const simulating = useJourneyStore((state) => state.simulating);
  const compareIds = useJourneyStore((state) => state.compareIds);
  const toggleCompare = useJourneyStore((state) => state.toggleCompare);
  const resetFilters = useJourneyStore((state) => state.resetFilters);

  if (simulating) {
    return (
      <div aria-busy="true" className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        title={strings.offers.emptyFiltered}
        actionLabel={strings.offers.showAll}
        onAction={resetFilters}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {matches.map((match) => {
        const selected = compareIds.includes(match.offer_id);
        return (
          <OfferCard
            key={match.offer_id}
            match={match}
            detailHref={
              journey ? `/journeys/${journey.journey_id}/offers/${match.offer_id}` : undefined
            }
            compareSelected={selected}
            compareDisabled={!selected && compareIds.length >= 3}
            onCompareToggle={toggleCompare}
          />
        );
      })}
    </div>
  );
}

function OffersContent() {
  const journey = useJourneyStore((state) => state.journey);
  const running = useJourneyStore((state) => state.running);
  const simulation = useJourneyStore((state) => state.simulation);
  const statusFilter = useJourneyStore((state) => state.statusFilter);
  const structureFilter = useJourneyStore((state) => state.structureFilter);
  const sortMode = useJourneyStore((state) => state.sortMode);

  const sourceMatches = useMemo(
    () => simulation?.matches ?? journey?.matches ?? [],
    [journey?.matches, simulation?.matches],
  );
  const visibleMatches = useMemo(() => {
    const filtered = sourceMatches.filter((match) => {
      const statusMatches = statusFilter === "all" || match.status === statusFilter;
      const structureMatches =
        structureFilter === "all" || match.structure === structureFilter;
      return statusMatches && structureMatches;
    });
    return sortMatches(filtered, sortMode);
  }, [sourceMatches, sortMode, statusFilter, structureFilter]);
  const showHardBreachNotice =
    sourceMatches.length > 0 &&
    sourceMatches.every((match) => match.status === "ineligible") &&
    !sourceMatches.some((match) => match.near_miss_suggestions.length > 0) &&
    (journey?.financial_health.breaches.length ?? 0) > 0;

  if (!journey && running) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!journey) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-ink">{strings.offers.title}</h1>
          <p className="mt-2 text-sm font-semibold text-muted">
            {sourceLabel(Boolean(simulation))}
          </p>
        </div>
        <Link
          href="/journey/decision"
          className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-strong dark:bg-accent dark:text-navy dark:hover:bg-accent/90"
        >
          {strings.offers.continueToDecision}
        </Link>
      </header>

      <SimulatorPanel />
      {showHardBreachNotice ? (
        <HardBreachNotice breaches={journey.financial_health.breaches} />
      ) : null}
      <OffersControls resultCount={visibleMatches.length} />
      <OffersGrid matches={visibleMatches} />
      <ComparePanel matches={sourceMatches} />
    </div>
  );
}

export function JourneyOffersPage() {
  return (
    <JourneyShell>
      <JourneyGuard>
        <OffersContent />
      </JourneyGuard>
    </JourneyShell>
  );
}
