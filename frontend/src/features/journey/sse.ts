import type { SseEvent } from "./types";

export function parseSseEvent<T>(rawEvent: string): SseEvent<T> | null {
  const lines = rawEvent.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const idLine = lines.find((line) => line.startsWith("id:"));
  const retryLine = lines.find((line) => line.startsWith("retry:"));
  const dataLines = lines.filter((line) => line.startsWith("data:"));
  if (dataLines.length === 0) {
    return null;
  }

  try {
    return {
      event: eventLine?.replace("event:", "").trim() ?? "message",
      id: idLine?.replace("id:", "").trim(),
      retry: retryLine?.replace("retry:", "").trim(),
      data: JSON.parse(
        dataLines.map((line) => line.replace(/^data:\s?/, "")).join("\n"),
      ) as T,
    };
  } catch {
    return null;
  }
}
