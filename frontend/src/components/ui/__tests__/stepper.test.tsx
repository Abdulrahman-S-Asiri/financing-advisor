import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stepper } from "@/components/ui";

describe("Stepper", () => {
  it("marks completed, current, and upcoming steps", () => {
    render(
      <Stepper
        ariaLabel="تقدم الرحلة"
        steps={["اكتشف", "حدد", "طوّر"]}
        currentIndex={1}
      />,
    );

    const list = screen.getByRole("list", { name: "تقدم الرحلة" });
    const items = screen.getAllByRole("listitem");

    expect(list).toBeInTheDocument();
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("data-state", "complete");
    expect(items[1]).toHaveAttribute("data-state", "current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveAttribute("data-state", "upcoming");
  });
});
