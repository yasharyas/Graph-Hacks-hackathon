// POST-SSE reader: fetch + ReadableStream, events split on blank lines, `data:` lines parsed as JSON.
// (EventSource cannot POST, so the browser primitive is not an option.) Pure: no vite or DOM globals.

/** Parse one SSE block ("event:/data:/: comment" lines). Returns null for comment-only blocks. */
export function parseSSEBlock<T>(block: string): T | null {
  const data = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
  return data ? (JSON.parse(data) as T) : null;
}

/** Yield every JSON event in `body` as it arrives. Cancels the stream when the consumer stops early. */
export async function* readSSE<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder(); // stream: true keeps multi-byte characters split across chunks intact
  let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // Normalise the whole buffer: a CRLF can be split across two chunks.
      buf = (buf + decoder.decode(value, { stream: true })).replaceAll('\r\n', '\n');
      for (let i = buf.indexOf('\n\n'); i >= 0; i = buf.indexOf('\n\n')) {
        const event = parseSSEBlock<T>(buf.slice(0, i));
        buf = buf.slice(i + 2);
        if (event) yield event;
      }
    }
    const tail = parseSSEBlock<T>((buf + decoder.decode()).trim());
    if (tail) yield tail;
  } finally {
    reader.cancel().catch(() => {});
  }
}
