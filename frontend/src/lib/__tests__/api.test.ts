import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError, api, fetchJson } from "@/lib/api";

describe("API client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("validates successful JSON responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchJson("/backend/example", z.object({ ok: z.boolean() }))).resolves.toEqual({
      ok: true,
    });
  });

  it("throws backend detail messages on non-ok responses", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "تفاصيل الخطأ" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchJson("/backend/example", z.object({ ok: z.boolean() }))).rejects.toMatchObject({
      message: "تفاصيل الخطأ",
      status: 400,
    } satisfies Partial<ApiError>);
  });

  it("routes streaming helpers through backend proxy paths", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock;

    await api.connectJourneyStream({
      persona_id: "ahmed_borderline",
      requested_amount: 80000,
      requested_tenor_months: 48,
      age: 28,
      nationality: "saudi",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/backend/journey/connect/stream",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
