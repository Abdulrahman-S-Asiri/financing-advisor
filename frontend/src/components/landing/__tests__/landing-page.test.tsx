import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/landing/LandingPage";
import { personas } from "@/lib/data";
import { strings } from "@/lib/strings";

describe("LandingPage", () => {
  it("renders the hero with honest demo labels and working CTAs", () => {
    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: strings.landing.heroTitle })).toBeInTheDocument();
    expect(screen.getByText(strings.landing.honestyStrip)).toBeInTheDocument();
    expect(screen.getByText(strings.common.unverifiedRate)).toBeInTheDocument();
    expect(screen.getByText(strings.common.simulation)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: strings.landing.ctaPrimary })).toHaveAttribute(
      "href",
      "/journey",
    );
    expect(screen.getByRole("link", { name: strings.landing.ctaSecondary })).toHaveAttribute(
      "href",
      "/docs",
    );
  });

  it("renders all double-diamond stages", () => {
    render(<LandingPage />);

    strings.landing.steps.forEach((step) => {
      expect(screen.getByRole("heading", { name: step.title })).toBeInTheDocument();
    });
  });

  it("links rate transparency to status and personas to preselected journeys", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("link", { name: strings.landing.trust[1].linkLabel }),
    ).toHaveAttribute("href", "/status");

    personas.forEach((persona) => {
      expect(screen.getByRole("link", { name: new RegExp(persona.name) })).toHaveAttribute(
        "href",
        `/journey?persona=${persona.id}`,
      );
    });
  });

  it("renders the final journey CTA", () => {
    render(<LandingPage />);

    expect(screen.getByRole("heading", { name: strings.landing.finalCtaTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: strings.landing.finalCta })).toHaveAttribute(
      "href",
      "/journey",
    );
  });
});
