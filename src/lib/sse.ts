export type SseEvent = {
  event: string;
  data: Record<string, unknown>;
};

function parseSseFrame(frame: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  try {
    const data: unknown = JSON.parse(dataLines.join("\n"));
    return data && typeof data === "object" && !Array.isArray(data)
      ? { event, data: data as Record<string, unknown> }
      : null;
  } catch {
    return null;
  }
}

export async function* readSse(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const event = parseSseFrame(frame);
        if (event) yield event;
      }

      if (done) break;
    }

    const finalEvent = parseSseFrame(buffer);
    if (finalEvent) yield finalEvent;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
