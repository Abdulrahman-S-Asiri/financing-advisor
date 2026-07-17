"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type AccordionContextValue = {
  value: string[];
  toggleValue: (value: string) => void;
  type: "single" | "multiple";
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const AccordionItemContext = React.createContext<string | null>(null);

function useAccordion() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used inside Accordion");
  }
  return context;
}

function useAccordionItem() {
  const value = React.useContext(AccordionItemContext);
  if (value === null) {
    throw new Error("AccordionTrigger and AccordionContent must be used inside AccordionItem");
  }
  return value;
}

function Accordion({
  type = "single",
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}) {
  const normalize = React.useCallback(
    (nextValue: string | string[] | undefined) =>
      Array.isArray(nextValue) ? nextValue : nextValue ? [nextValue] : [],
    [],
  );
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string[]>(
    normalize(defaultValue),
  );
  const value = controlledValue === undefined ? uncontrolledValue : normalize(controlledValue);

  const toggleValue = React.useCallback(
    (itemValue: string) => {
      const nextValue =
        type === "single"
          ? value.includes(itemValue)
            ? []
            : [itemValue]
          : value.includes(itemValue)
            ? value.filter((entry) => entry !== itemValue)
            : [...value, itemValue];

      if (controlledValue === undefined) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(type === "single" ? (nextValue[0] ?? "") : nextValue);
    },
    [controlledValue, onValueChange, type, value],
  );

  return (
    <AccordionContext.Provider value={{ value, toggleValue, type }}>
      <div className={cn("w-full", className)} {...props} />
    </AccordionContext.Provider>
  );
}

const AccordionItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, ...props }, ref) => (
  <AccordionItemContext.Provider value={value}>
    <div ref={ref} className={cn("border-b border-border", className)} {...props} />
  </AccordionItemContext.Provider>
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const accordion = useAccordion();
  const value = useAccordionItem();
  const open = accordion.value.includes(value);

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      className={cn(
        "flex w-full items-center justify-between py-4 text-start text-sm font-medium transition-all hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          accordion.toggleValue(value);
        }
      }}
      {...props}
    />
  );
});
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const accordion = useAccordion();
  const value = useAccordionItem();

  if (!accordion.value.includes(value)) {
    return null;
  }

  return <div ref={ref} className={cn("pb-4 pt-0 text-sm", className)} {...props} />;
});
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
