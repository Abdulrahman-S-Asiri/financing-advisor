import { describe, expect, it } from "vitest";
import { resolveLocaleRequest } from "next-intl/middleware";

import { config } from "@/middleware";
import { routing } from "../routing";

describe("locale middleware routing", () => {
  it("rewrites unprefixed routes to the default Arabic segment", () => {
    expect(resolveLocaleRequest("/", routing)).toEqual({
      type: "rewrite",
      locale: "ar",
      pathname: "/ar",
    });
    expect(resolveLocaleRequest("/journey", routing)).toEqual({
      type: "rewrite",
      locale: "ar",
      pathname: "/ar/journey",
    });
  });

  it("passes prefixed English routes through", () => {
    expect(resolveLocaleRequest("/en", routing)).toEqual({
      type: "next",
      locale: "en",
    });
    expect(resolveLocaleRequest("/en/journey", routing)).toEqual({
      type: "next",
      locale: "en",
    });
  });

  it("keeps backend, Next internals, and file paths out of the matcher", () => {
    expect(config.matcher).toEqual(["/((?!backend|_next|.*\\..*).*)"]);
  });
});
