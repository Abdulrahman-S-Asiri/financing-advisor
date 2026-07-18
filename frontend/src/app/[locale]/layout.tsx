import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { isLocale, locales, messages } from "@/lib/i18n";
import "../globals.css";

export const metadata:Metadata={title:"ATHAR / أثر",description:"Deterministic financing intelligence for Saudi consumers"};
export function generateStaticParams(){return locales.map(locale=>({locale}))}
export default async function LocaleLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){const {locale}=await params;if(!isLocale(locale))notFound();return <html lang={locale} dir={locale==="ar"?"rtl":"ltr"} suppressHydrationWarning><body><script dangerouslySetInnerHTML={{__html:"try{document.documentElement.classList.toggle('dark',localStorage.getItem('athar-theme')==='dark')}catch(e){}"}}/><Shell locale={locale} m={messages[locale]}>{children}</Shell></body></html>}
