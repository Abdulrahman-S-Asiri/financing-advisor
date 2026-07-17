import ar from "../../messages/ar.json";
import en from "../../messages/en.json";
import { defaultLocale, isLocale, type Locale } from "./locales";

const messages = {
  ar,
  en,
} satisfies Record<Locale, IntlMessages>;

export function getMessages(locale: string | undefined): IntlMessages {
  return messages[isLocale(locale) ? locale : defaultLocale];
}
