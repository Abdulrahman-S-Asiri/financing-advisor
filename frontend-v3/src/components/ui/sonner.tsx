"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type ToastInput =
  | string
  | {
      title: string;
      description?: string;
    };

type ToastMessage = {
  id: number;
  title: string;
  description?: string;
};

const TOAST_EVENT = "athar:toast";

function toast(input: ToastInput) {
  if (typeof window === "undefined") {
    return;
  }

  const detail =
    typeof input === "string"
      ? { title: input }
      : { title: input.title, description: input.description };

  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}

function Toaster({ className }: { className?: string }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  React.useEffect(() => {
    function handleToast(event: Event) {
      const customEvent = event as CustomEvent<{ title: string; description?: string }>;
      const id = Date.now();
      setToasts((current) => [...current, { id, ...customEvent.detail }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toastMessage) => toastMessage.id !== id));
      }, 4500);
    }

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-4 end-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2",
        className,
      )}
    >
      {toasts.map((toastMessage) => (
        <div
          key={toastMessage.id}
          className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg"
        >
          <p className="text-sm font-medium">{toastMessage.title}</p>
          {toastMessage.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{toastMessage.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export { Toaster, toast };
