import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { RoutingConfig } from "./routing";

export type LocaleMiddlewareAction =
  | { type: "next"; locale?: string }
  | { type: "rewrite"; locale: string; pathname: string };

export function resolveLocaleRequest<const Locales extends readonly string[]>(
  pathname: string,
  routing: RoutingConfig<Locales>,
): LocaleMiddlewareAction {
  const [, firstSegment] = pathname.split("/");
  const locale = routing.locales.find((candidate) => candidate === firstSegment);

  if (locale) {
    return { type: "next", locale };
  }

  const prefix = `/${routing.defaultLocale}`;
  return {
    type: "rewrite",
    locale: routing.defaultLocale,
    pathname: pathname === "/" ? prefix : `${prefix}${pathname}`,
  };
}

export default function createMiddleware<const Locales extends readonly string[]>(
  routing: RoutingConfig<Locales>,
) {
  return function middleware(request: NextRequest) {
    const action = resolveLocaleRequest(request.nextUrl.pathname, routing);

    if (action.type === "next") {
      return NextResponse.next();
    }

    const url = request.nextUrl.clone();
    url.pathname = action.pathname;
    return NextResponse.rewrite(url);
  };
}
