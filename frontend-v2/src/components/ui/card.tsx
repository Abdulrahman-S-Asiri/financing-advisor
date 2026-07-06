import type { ReactNode } from "react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-5 shadow-athar ${className}`}
    >
      {children}
    </section>
  );
}
