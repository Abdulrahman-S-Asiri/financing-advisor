import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Gauge } from "@/components/ui";

describe("Gauge", () => {
  it("renders the ratio against the cap without doing financial math", () => {
    render(<Gauge label="عبء الالتزامات" ratio={0.2} cap={0.4} detail="٢٠٪ / ٤٠٪" />);

    const meter = screen.getByRole("meter", { name: "عبء الالتزامات" });
    const fill = screen.getByTestId("gauge-fill");

    expect(meter).toHaveAttribute("aria-valuenow", "0.2");
    expect(meter).toHaveAttribute("aria-valuemax", "0.4");
    expect(meter).toHaveAttribute("aria-valuetext", "٢٠٪ / ٤٠٪");
    expect(fill).toHaveStyle({ width: "50%" });
    expect(fill).toHaveClass("bg-brand");
  });

  it("marks a cap breach visually and clamps the bar to 100%", () => {
    render(<Gauge label="عبء الالتزامات" ratio={0.5} cap={0.4} detail="٥٠٪ / ٤٠٪" />);

    const fill = screen.getByTestId("gauge-fill");

    expect(fill).toHaveStyle({ width: "100%" });
    expect(fill).toHaveClass("bg-danger");
  });
});
