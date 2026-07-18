import type { Locale } from "@/lib/i18n";
export function formatMoney(value:number|null,locale:Locale){return value===null?"—":new Intl.NumberFormat(locale==="ar"?"ar-SA":"en-US",{style:"currency",currency:"SAR",maximumFractionDigits:0}).format(value)}
export function formatPercent(value:number|null,locale:Locale){return value===null?"—":new Intl.NumberFormat(locale==="ar"?"ar-SA":"en-US",{style:"percent",maximumFractionDigits:1}).format(value)}
