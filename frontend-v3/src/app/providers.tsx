"use client";

import { DirectionProvider } from "@radix-ui/react-direction";
import * as React from "react";

import { getDirection, type Locale } from "@/i18n/locales";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const themeStorageKey = "athar-theme";
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  try {
    const value = window.localStorage.getItem(themeStorageKey);
    return value === "light" || value === "dark" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "dark" || mode === "light") {
    return mode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyResolvedTheme(resolvedTheme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  document.documentElement.dataset.theme = resolvedTheme;
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = React.useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    setThemeModeState(readStoredTheme());
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function syncTheme() {
      const nextResolvedTheme = resolveTheme(themeMode);
      setResolvedTheme(nextResolvedTheme);
      applyResolvedTheme(nextResolvedTheme);
    }

    syncTheme();

    if (themeMode !== "system") {
      return undefined;
    }

    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [themeMode]);

  const setThemeMode = React.useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      window.localStorage.setItem(themeStorageKey, mode);
    } catch {
      // Storage can be unavailable in private contexts; the DOM theme still updates.
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeMode(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setThemeMode]);

  const value = React.useMemo(
    () => ({ themeMode, resolvedTheme, setThemeMode, toggleTheme }),
    [resolvedTheme, setThemeMode, themeMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside Providers");
  }

  return context;
}

export function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return (
    <DirectionProvider dir={getDirection(locale)}>
      <ThemeProvider>{children}</ThemeProvider>
    </DirectionProvider>
  );
}
