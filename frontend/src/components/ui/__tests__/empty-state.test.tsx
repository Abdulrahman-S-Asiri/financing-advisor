import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "@/components/ui";

describe("EmptyState", () => {
  it("renders title, hint, and a link action", () => {
    render(
      <EmptyState
        title="لا توجد نتائج"
        hint="غيّر التصفية ثم حاول مرة أخرى."
        actionLabel="إظهار الكل"
        actionHref="/journey/offers"
      />,
    );

    expect(screen.getByText("لا توجد نتائج")).toBeInTheDocument();
    expect(screen.getByText("غيّر التصفية ثم حاول مرة أخرى.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "إظهار الكل" })).toHaveAttribute(
      "href",
      "/journey/offers",
    );
  });

  it("runs the button action when no href is provided", () => {
    const onAction = vi.fn();

    render(
      <EmptyState
        title="لا توجد نتائج"
        actionLabel="إعادة المحاولة"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
