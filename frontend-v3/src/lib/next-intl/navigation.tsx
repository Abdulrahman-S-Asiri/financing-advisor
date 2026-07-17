import NextLink from "next/link";
import {
  redirect as nextRedirect,
  usePathname as nextUsePathname,
  useRouter as nextUseRouter,
} from "next/navigation";

import type { RoutingConfig } from "./routing";

function localizePathname(pathname: string, locale: string, defaultLocale: string) {
  if (locale === defaultLocale) {
    return pathname || "/";
  }

  const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `/${locale}${normalizedPathname === "/" ? "" : normalizedPathname}`;
}

export function createNavigation<const Locales extends readonly string[]>(
  routing: RoutingConfig<Locales>,
) {
  return {
    Link: NextLink,
    redirect: nextRedirect,
    usePathname: nextUsePathname,
    useRouter: nextUseRouter,
    getPathname({
      href,
      locale,
    }: {
      href: string;
      locale?: Locales[number];
    }) {
      return localizePathname(href, locale ?? routing.defaultLocale, routing.defaultLocale);
    },
  };
}
