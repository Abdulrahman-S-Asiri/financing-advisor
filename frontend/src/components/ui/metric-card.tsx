"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const frame = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(target * (1 - (1 - progress) ** 3));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, enabled]);

  return value;
}

export function MetricCard({
  label,
  value,
  format,
}: {
  label: string;
  /** Numeric values animate (count-up); pass formatted strings to skip. */
  value: number | string;
  format?: (value: number) => string;
}) {
  const reducedMotion = useReducedMotion();
  const numeric = typeof value === "number" ? value : 0;
  const animated = useCountUp(numeric, typeof value === "number" && !reducedMotion);

  return (
    <Card className="!p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-ink" dir="ltr" style={{ textAlign: "end" }}>
        {typeof value === "number"
          ? (format ?? formatNumber)(Math.round(animated * 100) / 100)
          : value}
      </p>
    </Card>
  );
}
