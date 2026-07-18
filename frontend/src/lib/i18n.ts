import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export type Messages = typeof ar;
export const messages: Record<Locale, Messages> = { ar, en };
export function isLocale(value: string): value is Locale { return locales.includes(value as Locale); }
