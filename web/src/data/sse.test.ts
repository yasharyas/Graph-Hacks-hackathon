// Run: node --test web/src/data/sse.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readSSE } from './sse.ts';

const stream = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const s of chunks) c.enqueue(new TextEncoder().encode(s));
      c.close();
    },
  });

const collect = async (body: ReadableStream<Uint8Array>) => {
  const out: unknown[] = [];
  for await (const e of readSSE(body)) out.push(e);
  return out;
};

test('splits on blank lines, across chunk boundaries and CRLF, skipping comments', async () => {
  const out = await collect(
    stream('data: {"type":"a"}\n\n: keep-alive\n\ndata: {"ty', 'pe":"b"}\r', '\n\r\ndata: {"type":', '"c"}\n\n'),
  );
  assert.deepEqual(out, [{ type: 'a' }, { type: 'b' }, { type: 'c' }]);
});

test('yields a final event with no trailing blank line, and joins multi-line data', async () => {
  assert.deepEqual(await collect(stream('data: {"x":\ndata: 1}')), [{ x: 1 }]);
});

test('malformed JSON rejects instead of being swallowed', async () => {
  await assert.rejects(collect(stream('data: {nope\n\n')), SyntaxError);
});
