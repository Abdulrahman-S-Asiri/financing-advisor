import { gaugePercent } from "@/lib/format";

export function Gauge({
  label,
  ratio,
  cap,
  detail,
}: {
  label: string;
  ratio: number;
  cap: number | null;
  detail: string;
}) {
  const percent = gaugePercent(ratio, cap);
  const breach = cap !== null && ratio > cap;

  return (
    <div className="rounded-xl border border-line bg-surface-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm text-ink">{label}</strong>
        <span className="text-xs font-semibold text-muted">{detail}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={cap ?? 1}
        aria-valuenow={ratio}
        aria-valuetext={detail}
        className="mt-3 h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          data-testid="gauge-fill"
          className={`h-full rounded-full transition-[width] duration-500 ${breach ? "bg-danger" : "bg-brand"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
