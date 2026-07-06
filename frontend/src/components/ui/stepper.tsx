import { formatNumber } from "@/lib/format";

export function Stepper({
  steps,
  currentIndex,
  ariaLabel,
}: {
  steps: string[];
  currentIndex: number;
  ariaLabel: string;
}) {
  return (
    <ol aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const state = done ? "complete" : current ? "current" : "upcoming";

        return (
          <li
            key={step}
            aria-current={current ? "step" : undefined}
            data-state={state}
            className="flex items-center gap-2"
          >
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-black ${
                done
                  ? "bg-ok text-white"
                  : current
                    ? "bg-brand text-white dark:bg-accent dark:text-navy"
                    : "bg-surface-soft text-muted"
              }`}
            >
              {formatNumber(index + 1)}
            </span>
            <span
              className={`text-xs font-bold ${current ? "text-ink" : "text-muted"}`}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <span aria-hidden className="h-px w-4 bg-line" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
