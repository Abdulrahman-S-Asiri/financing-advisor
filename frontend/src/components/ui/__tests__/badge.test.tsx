import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, UnverifiedBadge } from "@/components/ui";

describe("Badge", () => {
  it.each([
    ["ok", "bg-ok/15 text-ok"],
    ["warn", "bg-warn/15 text-warn"],
    ["danger", "bg-danger/15 text-danger"],
    ["accent", "bg-accent/15 text-accent"],
    ["neutral", "bg-surface-soft text-muted"],
  ] as const)("renders the %s tone", (tone, expectedClass) => {
    render(<Badge tone={tone}>وسم</Badge>);

    expect(screen.getByText("وسم")).toHaveClass(...expectedClass.split(" "));
  });

  it("keeps the title tooltip text for unverified rates", () => {
    render(<UnverifiedBadge hint="تفاصيل السعر غير مؤكدة" />);

    expect(screen.getByText("سعر غير مؤكد")).toHaveAttribute(
      "title",
      "تفاصيل السعر غير مؤكدة",
    );
  });
});
