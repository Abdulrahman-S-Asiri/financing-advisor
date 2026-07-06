"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
  actionHref,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface p-8 text-center">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="rounded-xl border border-line px-4 py-2 text-sm font-bold text-brand hover:border-brand dark:text-accent"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
