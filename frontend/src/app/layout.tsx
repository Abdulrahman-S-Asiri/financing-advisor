import type { Metadata } from "next";
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
  Space_Grotesk,
} from "next/font/google";

import SiteFooter from "../components/site/SiteFooter";
import SiteNav from "../components/site/SiteNav";
import "./globals.css";

// IBM Plex Sans Arabic tops out at weight 700; heavier existing usages
// synthesize from it. The system stack in globals.css stays as fallback.
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
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
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "أثر",
    template: "%s | أثر",
  },
  description:
    "أثر مستشار تمويل وكيلي يقرأ الوضع المالي، يقارن العروض، ويشرح كل قرار بالعربية — عرض تجريبي.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${plex.variable} ${space.variable} ${mono.variable}`}>
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
