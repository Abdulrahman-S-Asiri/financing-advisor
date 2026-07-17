import { useDirection } from "@radix-ui/react-direction";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Providers, useTheme } from "../providers";

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function DirectionProbe() {
  return <span data-testid="direction">{useDirection()}</span>;
}

function ThemeProbe() {
  const { resolvedTheme, setThemeMode, themeMode, toggleTheme } = useTheme();

  return (
    <>
      <span data-testid="theme-mode">{themeMode}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button type="button" onClick={() => setThemeMode("light")}>
        light
      </button>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
    </>
  );
}

describe("Providers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.removeAttribute("data-theme");
    mockMatchMedia(false);
  });

  it("sets Radix direction from the active locale", () => {
    const { rerender } = render(
      <Providers locale="ar">
        <DirectionProbe />
      </Providers>,
    );

    expect(screen.getByTestId("direction")).toHaveTextContent("rtl");

    rerender(
      <Providers locale="en">
        <DirectionProbe />
      </Providers>,
    );

    expect(screen.getByTestId("direction")).toHaveTextContent("ltr");
  });

  it("hydrates the stored theme and persists user changes", async () => {
    window.localStorage.setItem("athar-theme", "dark");

    render(
      <Providers locale="ar">
        <ThemeProbe />
      </Providers>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("theme-mode")).toHaveTextContent("dark");
      expect(screen.getByTestId("resolved-theme")).toHaveTextContent("dark");
      expect(document.documentElement).toHaveClass("dark");
    });

    fireEvent.click(screen.getByRole("button", { name: "light" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("athar-theme")).toBe("light");
      expect(screen.getByTestId("resolved-theme")).toHaveTextContent("light");
      expect(document.documentElement).not.toHaveClass("dark");
    });

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("athar-theme")).toBe("dark");
      expect(document.documentElement).toHaveClass("dark");
    });
  });
});
