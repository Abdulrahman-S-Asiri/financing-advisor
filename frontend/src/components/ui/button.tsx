"use client";

import type { ReactNode } from "react";

const buttonVariants = {
  primary:
    "bg-brand text-white hover:bg-brand-strong disabled:opacity-50 disabled:hover:bg-brand dark:bg-accent dark:text-navy dark:hover:bg-accent/90",
  secondary:
    "border border-line bg-surface text-ink hover:border-brand disabled:opacity-50",
  ghost: "text-brand hover:bg-surface-soft disabled:opacity-50 dark:text-accent",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  onClick,
  children,
}: {
  variant?: keyof typeof buttonVariants;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${buttonVariants[variant]}`}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
