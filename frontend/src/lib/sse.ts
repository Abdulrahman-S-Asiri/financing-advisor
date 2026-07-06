// SSE frame parsing + stream consumption, ported from v1's proven logic
// (partial-frame buffering included). Frames: event/id/retry/data lines,
// blocks separated by blank lines, data is JSON.
import { strings } from "@/lib/strings";

export type SseEvent<T> = {
  event: string;
  id?: string;
  retry?: string;
  data: T;
};

export function parseSseEvent<T>(rawEvent: string): SseEvent<T> | null {
  const frame: { event?: string; id?: string; retry?: string; dataLines: string[] } = {
    dataLines: [],
  };

  for (const line of rawEvent.split(/\r?\n/)) {
    if (line.startsWith(":") || !line.includes(":")) {
      continue;
    }
    const separator = line.indexOf(":");
    const field = line.slice(0, separator);
    let value = line.slice(separator + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    if (field === "data") {
      frame.dataLines.push(value);
    } else if (field === "event" || field === "id" || field === "retry") {
      frame[field] = value;
    }
  }

  if (frame.dataLines.length === 0) {
    return null;
  }

  try {
    return {
      event: frame.event ?? "message",
      id: frame.id,
      retry: frame.retry,
      data: JSON.parse(frame.dataLines.join("\n")) as T,
    };
  } catch {
    return null;
  }
}

/** Reads a streaming Response body and invokes onFrame per complete frame. */
export async function consumeSseResponse(
  response: Response,
  onFrame: (rawEvent: string) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(strings.common.streamReadError);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const rawEvent of frames) {
      onFrame(rawEvent);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    onFrame(buffer);
  }
}
