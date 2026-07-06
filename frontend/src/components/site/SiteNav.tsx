"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import AtharLogo from "./AtharLogo";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/journey", label: "الرحلة" },
  { href: "/debt-payment", label: "سداد المديونية" },
  { href: "/docs", label: "كيف يعمل" },
  { href: "/status", label: "الحالة" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  // Offer-detail routes live under /journeys/... and belong to الرحلة.
  if (href === "/journey") {
    return pathname.startsWith("/journey");
  }
  return pathname.startsWith(href);
}

export default function SiteNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="siteNav">
      <div className="siteNavInner">
        <Link className="siteNavBrand" href="/" onClick={() => setMenuOpen(false)}>
          <AtharLogo size="sm" variant="arabic" />
          <span className="siteNavDemoPill">تجريبي</span>
        </Link>

        <button
          className="siteNavToggle"
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ☰
        </button>

        <nav
          className={`siteNavLinks${menuOpen ? " siteNavMenuOpen" : ""}`}
          aria-label="التنقل الرئيسي"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              className={`siteNavLink${isActive(pathname, link.href) ? " siteNavLinkActive" : ""}`}
              href={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
