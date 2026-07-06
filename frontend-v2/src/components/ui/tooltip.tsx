import type { ReactNode } from "react";

export function Tooltip({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      tabIndex={0}
      className="inline-flex cursor-help items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {children}
    </span>
  );
}
