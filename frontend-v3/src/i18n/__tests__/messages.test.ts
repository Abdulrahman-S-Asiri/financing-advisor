import { describe, expect, it } from "vitest";

import arMessages from "../../../messages/ar.json";
import enMessages from "../../../messages/en.json";

function collectLeafSignatures(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectLeafSignatures(item, `${prefix}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((key) =>
        collectLeafSignatures(
          (value as Record<string, unknown>)[key],
          prefix ? `${prefix}.${key}` : key,
        ),
      );
  }

  return [`${prefix}:${typeof value}`];
}

describe("message catalogs", () => {
  it("keeps Arabic and English key sets in parity", () => {
    expect(collectLeafSignatures(enMessages).sort()).toEqual(
      collectLeafSignatures(arMessages).sort(),
    );
  });
});
