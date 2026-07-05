import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

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

export const metadata: Metadata = {
  title: {
    default: "مستشار التمويل",
    template: "%s | مستشار التمويل",
  },
  description:
    "مستشار تمويل رقمي يقرأ الوضع المالي، يقارن العروض، ويشرح كل قرار بالعربية — عرض تجريبي.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={plex.variable}>
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
