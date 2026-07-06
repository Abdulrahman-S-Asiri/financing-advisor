import type { ReactNode } from "react";

import type { BadgeTone } from "@/lib/data";
import { strings } from "@/lib/strings";

const badgeTones: Record<BadgeTone | "neutral", string> = {
  ok: "bg-ok/15 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  accent: "bg-accent/15 text-accent",
  neutral: "bg-surface-soft text-muted",
};

export function Badge({
  tone = "neutral",
  title,
  children,
}: {
  tone?: BadgeTone | "neutral";
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function UnverifiedBadge({ hint }: { hint: string }) {
  return (
    <Badge tone="warn" title={hint}>
      {strings.common.unverifiedRate}
    </Badge>
  );
}
