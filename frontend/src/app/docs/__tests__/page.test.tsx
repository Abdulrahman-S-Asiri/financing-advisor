import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DocsPage from "@/app/docs/page";
import { strings } from "@/lib/strings";

describe("DocsPage", () => {
  it("renders the blunt demo limitations and status link", () => {
    render(<DocsPage />);

    expect(screen.getByRole("heading", { name: strings.docs.title })).toBeInTheDocument();
    strings.docs.limits.items.forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: strings.docs.verification.link })).toHaveAttribute(
      "href",
      "/status",
    );
  });

  it("renders the documented flow without calculating or submitting anything", () => {
    render(<DocsPage />);

    expect(screen.getByLabelText(strings.docs.flowAria)).toBeInTheDocument();
    strings.docs.flow.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });
});
