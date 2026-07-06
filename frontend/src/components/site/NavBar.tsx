"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AtharLogo } from "@/components/site/AtharLogo";
import { Badge } from "@/components/ui";
import { strings } from "@/lib/strings";

const links = [
  { href: "/", label: strings.nav.home },
  { href: "/journey", label: strings.nav.journey },
  { href: "/debt-payment", label: strings.nav.debtPayment },
  { href: "/docs", label: strings.nav.docs },
  { href: "/status", label: strings.nav.status },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  // Offer-detail routes belong to the journey section.
  if (href === "/journey") {
    return pathname.startsWith("/journey") || pathname.startsWith("/journeys");
  }
  return pathname.startsWith(href);
}

function toggleTheme() {
  const root = document.documentElement;
  const enabled = root.classList.toggle("dark");
  try {
    window.localStorage.setItem("athar-theme", enabled ? "dark" : "light");
  } catch {
    // Storage unavailable (private mode) — the toggle still works this session.
  }
  return enabled;
}

export function NavBar() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <AtharLogo size="sm" variant="arabic" />
          </Link>
          <Badge tone="warn">{strings.common.demo}</Badge>
        </div>

        <ul className="hidden items-center gap-1 min-[761px]:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                  isActive(pathname, link.href)
                    ? "bg-surface-soft text-brand"
                    : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={dark}
            aria-label={strings.nav.toggleTheme}
            onClick={() => setDark(toggleTheme())}
            className="group grid size-10 place-items-center rounded-xl border border-line text-ink transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span
              aria-hidden="true"
              className={`block size-4 rounded-full border-2 border-current transition-all ${
                dark ? "bg-current shadow-[inset_6px_0_0_var(--surface)]" : "bg-transparent"
              }`}
            />
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? strings.nav.closeMenu : strings.nav.openMenu}
            onClick={() => setOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-xl border border-line text-ink transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent min-[761px]:hidden"
          >
            <span aria-hidden="true" className="grid w-4 gap-1">
              <span
                className={`h-0.5 rounded-full bg-current transition-transform ${
                  open ? "translate-y-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`h-0.5 rounded-full bg-current transition-opacity ${
                  open ? "opacity-0" : ""
                }`}
              />
              <span
                className={`h-0.5 rounded-full bg-current transition-transform ${
                  open ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </nav>

      {open && (
        <ul
          id={menuId}
          className="border-t border-line bg-surface px-4 py-2 shadow-athar min-[761px]:hidden"
        >
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2.5 text-sm font-bold ${
                  isActive(pathname, link.href) ? "bg-surface-soft text-brand" : "text-ink"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
