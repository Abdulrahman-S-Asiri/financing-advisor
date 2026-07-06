import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Footer } from "@/components/site/Footer";
import { NavBar } from "@/components/site/NavBar";
import { RouteFocusManager } from "@/components/site/RouteFocusManager";
import { strings } from "@/lib/strings";

let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

afterEach(() => {
  pathname = "/";
  document.documentElement.classList.remove("dark");
  window.localStorage.clear();
});

describe("site shell", () => {
  it("treats offer-detail routes as the journey section", () => {
    pathname = "/journeys/demo/offers/riyad";

    render(<NavBar />);

    expect(screen.getByRole("link", { name: strings.nav.journey })).toHaveClass(
      "text-brand",
    );
  });

  it("opens and closes the mobile menu with keyboard recovery", () => {
    render(<NavBar />);

    fireEvent.click(screen.getByRole("button", { name: strings.nav.openMenu }));

    expect(screen.getAllByRole("link", { name: strings.nav.status })).toHaveLength(2);
    expect(screen.getByRole("button", { name: strings.nav.closeMenu })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.getByRole("button", { name: strings.nav.openMenu })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("toggles and stores the selected theme", () => {
    render(<NavBar />);

    fireEvent.click(screen.getByRole("button", { name: strings.nav.toggleTheme }));

    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("athar-theme")).toBe("dark");
  });

  it("renders footer navigation and transparency copy", () => {
    render(<Footer />);

    expect(screen.getByText(strings.footer.transparency)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: strings.footer.docsLink })).toHaveAttribute(
      "href",
      "/docs",
    );
  });

  it("moves focus to the main content after route navigation", async () => {
    const { rerender } = render(
      <>
        <div id="main-content" tabIndex={-1} />
        <RouteFocusManager />
      </>,
    );

    expect(document.activeElement).not.toBe(document.getElementById("main-content"));

    pathname = "/journey/analysis";
    rerender(
      <>
        <div id="main-content" tabIndex={-1} />
        <RouteFocusManager />
      </>,
    );

    await waitFor(() => {
      expect(document.activeElement).toBe(document.getElementById("main-content"));
    });
  });
});
