"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { strings } from "@/lib/strings";

export function ChatBubble({
  role,
  fallback = false,
  children,
}: {
  role: "user" | "advisor";
  fallback?: boolean;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const base =
    role === "user"
      ? "bg-accent/10 text-ink self-end"
      : fallback
        ? "border border-warn/40 bg-warn/10 text-ink self-start"
        : "bg-surface-soft text-ink self-start";

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-7 ${base}`}
    >
      {fallback && (
        <span className="mb-1 block text-xs font-black text-warn">
          {strings.decision.fallbackBadge}
        </span>
      )}
      {children}
    </motion.div>
  );
}
