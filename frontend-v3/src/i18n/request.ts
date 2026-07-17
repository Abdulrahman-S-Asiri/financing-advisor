import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale } from "./locales";
import { getMessages } from "./messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return {
    locale,
    messages: getMessages(locale),
  };
});
