// Single home for number formatting — ar-SA everywhere so numerals stay
// consistent across the site. Ported from v1.
import { statusCopy, type MatchStatus, type SortMode } from "@/lib/data";
import type { NearMissSuggestion, OfferMatch } from "@/lib/schemas";

const sarFormatter = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("ar-SA", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const plainFormatter = new Intl.NumberFormat("ar-SA");

export function formatSar(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "غير متاح";
  }
  return sarFormatter.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "غير متاح";
  }
  return percentFormatter.format(value);
}

export function formatNumber(value: number): string {
  return plainFormatter.format(value);
}

export function formatCap(value: number | null): string {
  return value === null ? "سياسة الممول" : formatPercent(value);
}

export function gaugePercent(value: number, cap: number | null): number {
  const denominator = cap && cap > 0 ? cap : 1;
  return Math.min(100, Math.max(0, (value / denominator) * 100));
}

export function formatNearMiss(suggestion: NearMissSuggestion): string {
  const status = suggestion.status
    ? statusCopy[suggestion.status as MatchStatus]?.label
    : null;
  const suffix = suggestion.monthly_installment
    ? ` القسط المتوقع ${formatSar(suggestion.monthly_installment)}.`
    : "";

  if (suggestion.kind === "lower_amount" && suggestion.requested_amount) {
    return `مسار متاح عند ${formatSar(suggestion.requested_amount)}${status ? ` بحالة ${status}` : ""}.${suffix}`;
  }
  if (suggestion.kind === "shorter_tenor" && suggestion.requested_tenor_months) {
    return `مسار متاح عند مدة ${suggestion.requested_tenor_months} شهر${status ? ` بحالة ${status}` : ""}.${suffix}`;
  }
  if (suggestion.kind === "salary_transfer") {
    return `تحويل الراتب يفتح هذا المسار${status ? ` بحالة ${status}` : ""}.${suffix}`;
  }
  return suggestion.message;
}

export function statusCounts(matches: OfferMatch[]): Record<MatchStatus, number> {
  return matches.reduce(
    (acc, match) => {
      acc[match.status] += 1;
      return acc;
    },
    { eligible: 0, conditional: 0, ineligible: 0, policy_review: 0 },
  );
}

export function sortableValue(match: OfferMatch, sortMode: SortMode): number {
  if (sortMode === "apr") {
    return match.apr_effective ?? Number.POSITIVE_INFINITY;
  }
  if (sortMode === "installment") {
    return match.monthly_installment ?? Number.POSITIVE_INFINITY;
  }
  if (sortMode === "total") {
    return match.total_amount_payable ?? Number.POSITIVE_INFINITY;
  }
  return 0;
}
