"use client";

import { Button } from "@/components/ui/button";
import { strings } from "@/lib/strings";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-5"
    >
      <p className="text-sm font-semibold text-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {strings.common.retry}
        </Button>
      )}
    </div>
  );
}
