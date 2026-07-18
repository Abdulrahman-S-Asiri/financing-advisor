"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import type { Locale, Messages } from "@/lib/i18n";

function pathFor(locale:Locale,path:string){const clean=path.replace(/^\/(ar|en)(?=\/|$)/,"")||"/";return locale==="ar"?clean:`/en${clean==="/"?"":clean}`}
export function Shell({locale,m,children}:{locale:Locale;m:Messages;children:React.ReactNode}){
 const pathname=usePathname(); const [dark,setDark]=useState(false);
 const toggle=()=>{const value=!dark;setDark(value);document.documentElement.classList.toggle("dark",value);localStorage.setItem("athar-theme",value?"dark":"light")};
 return <DirectionProvider dir={locale==="ar"?"rtl":"ltr"}><header className="header"><nav className="container nav" aria-label="Main"><Link className="brand" href={pathFor(locale,"/")}><span className="brandMark">أ</span><span>ATHAR / أثر</span></Link><div className="navLinks"><Link href={pathFor(locale,"/")}>{m.nav.home}</Link><Link href={pathFor(locale,"/journey")}>{m.nav.journey}</Link><Link href={pathFor(locale,"/docs")}>{m.nav.docs}</Link><Link href={pathFor(locale,"/status")}>{m.nav.status}</Link></div><div className="actions"><Link className="button buttonGhost" href={pathFor(locale==="ar"?"en":"ar",pathname)}>{locale==="ar"?"EN":"العربية"}</Link><button className="button buttonGhost" onClick={toggle} aria-label="Toggle theme">{dark?"☀":"☾"}</button></div></nav></header>{children}<footer className="footer"><div className="container footerRow"><strong>ATHAR / أثر</strong><span>{m.common.demo} — {locale==="ar"?"ليست موافقة تمويلية":"Not financing approval"}</span></div></footer></DirectionProvider>
}
