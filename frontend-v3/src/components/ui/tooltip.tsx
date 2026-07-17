"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return <span className="group/tooltip relative inline-flex">{children}</span>;
}

function TooltipTrigger({
  asChild,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
  children: React.ReactElement;
}) {
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
    return React.cloneElement(child, {
      className: cn(child.props.className, className),
      ...props,
    });
  }

  return (
    <button type="button" className={cn("inline-flex", className)} {...props}>
      {children}
    </button>
  );
}

const TooltipContent = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="tooltip"
      className={cn(
        "pointer-events-none absolute bottom-full start-1/2 z-50 mb-2 hidden max-w-xs -translate-x-1/2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md group-hover/tooltip:block group-focus-within/tooltip:block",
        className,
      )}
      {...props}
    />
  ),
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
