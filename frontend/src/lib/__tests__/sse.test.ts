import { describe, expect, it } from "vitest";

import { consumeSseResponse, parseSseEvent } from "@/lib/sse";

describe("SSE parsing", () => {
  it("parses event metadata and JSON data", () => {
    const parsed = parseSseEvent<{ ok: boolean }>(
      'event: finding\nid: 7\ndata: {"ok":true}\n',
    );

    expect(parsed).toEqual({
      event: "finding",
      id: "7",
      retry: undefined,
      data: { ok: true },
    });
  });

  it("defaults missing event names to message", () => {
    expect(parseSseEvent<{ ok: boolean }>('data: {"ok":true}')).toMatchObject({
      event: "message",
      data: { ok: true },
    });
  });

  it("buffers partial frames while consuming a stream", async () => {
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('event: one\ndata: {"a"'));
          controller.enqueue(encoder.encode(":1}\n\n"));
          controller.enqueue(encoder.encode('event: two\r\ndata: {"b":2}\r\n\r\n'));
          controller.close();
        },
      }),
    );
    const frames: string[] = [];

    await consumeSseResponse(response, (frame) => frames.push(frame));

    expect(frames).toHaveLength(2);
    expect(parseSseEvent<{ a: number }>(frames[0])?.data).toEqual({ a: 1 });
    expect(parseSseEvent<{ b: number }>(frames[1])?.data).toEqual({ b: 2 });
  });
});
