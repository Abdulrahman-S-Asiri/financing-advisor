import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { Footer } from "@/components/site/Footer";
import { NavBar } from "@/components/site/NavBar";
import { RouteFocusManager } from "@/components/site/RouteFocusManager";
import { strings } from "@/lib/strings";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: strings.meta.title,
    template: `%s | ${strings.common.brand}`,
  },
  description: strings.meta.description,
};

function ThemeScript() {
  const code = `
(() => {
  try {
    const stored = window.localStorage.getItem("athar-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const enabled = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", enabled);
  } catch (_) {}
})();
`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      {/* Must run before paint but <script> is only valid inside body/head —
          first child of body avoids the React invalid-nesting hydration error. */}
      <body className={`${plex.variable} ${space.variable} ${mono.variable}`}>
        <ThemeScript />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-navy"
        >
          {strings.nav.skip}
        </a>
        <div className="flex min-h-screen flex-col bg-background text-ink">
          <NavBar />
          <RouteFocusManager />
          <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
