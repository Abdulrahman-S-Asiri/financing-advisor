import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-accent">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-bold text-ink">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}
