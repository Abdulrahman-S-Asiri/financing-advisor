import Link from "next/link";

import { AtharLogo } from "@/components/site/AtharLogo";
import { strings } from "@/lib/strings";

const links = [
  { href: "/", label: strings.nav.home },
  { href: "/journey", label: strings.nav.journey },
  { href: "/debt-payment", label: strings.nav.debtPayment },
  { href: "/docs", label: strings.nav.docs },
  { href: "/status", label: strings.nav.status },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <AtharLogo size="sm" variant="arabic" />
          <p className="mt-2 text-sm leading-7 text-muted">{strings.footer.about}</p>
          <p className="mt-3 text-xs font-bold text-warn">{strings.footer.disclaimer}</p>
        </div>
        <nav aria-label={strings.footer.linksTitle}>
          <p className="text-sm font-black text-ink">{strings.footer.linksTitle}</p>
          <ul className="mt-2 space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-muted transition-colors hover:text-brand"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-sm font-black text-ink">{strings.footer.transparencyTitle}</p>
          <p className="mt-2 text-sm leading-7 text-muted">{strings.footer.transparency}</p>
          <Link
            href="/docs"
            className="mt-2 inline-block text-sm font-bold text-brand hover:underline"
          >
            {strings.footer.docsLink}
          </Link>
        </div>
      </div>
    </footer>
  );
}
