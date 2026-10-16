// Run: node --test web/src/design/fetch-fonts.test.ts
// The font fetch against a local server standing in for Fontshare (FONTSHARE_API): a 5xx or a dead socket is tried 3 times,
// a 4xx or a hash mismatch fails at once, and a 5xx that clears lets the build go on. `--force` makes the script download
// even when the fonts are on disk; it writes only bytes that match the pinned hashes, so a failing run touches no file.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const script = fileURLToPath(new URL('./fetch-fonts.mjs', import.meta.url));
const fonts = fileURLToPath(new URL('../../public/fonts/', import.meta.url));

/** A stored (uncompressed) zip holding `entries`. */
function zip(entries: Record<string, Buffer>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of Object.entries(entries)) {
    const n = Buffer.from(name);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt32LE(crc32(data), 14);
    head.writeUInt32LE(data.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(n.length, 26);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt32LE(crc32(data), 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    local.push(head, n, data);
    central.push(dir, n);
    offset += head.length + n.length + data.length;
  }
  const dirs = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(dirs.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, dirs, end]);
}

/** Runs the script against `api` (waits of 5 ms, not 1 s). */
const fetchFonts = (api: string) =>
  new Promise<{ code: number; stderr: string }>((ok) =>
    execFile(process.execPath, [script, '--force'], { env: { ...process.env, FONTSHARE_API: api, FONTS_RETRY_MS: '5' } }, (err, _stdout, stderr) => ok({ code: err ? Number(err.code) : 0, stderr })),
  );

/** Answers the n-th request with `reply(n, path)`: a status, or a zip as a 200. Returns how the script fared and how often it asked. */
async function serve(reply: (n: number, path: string) => number | Buffer) {
  let requests = 0;
  const server = createServer((req, res) => {
    const r = reply(requests++, req.url ?? '');
    if (typeof r === 'number') res.writeHead(r).end();
    else res.writeHead(200).end(r);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const out = await fetchFonts(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  server.close();
  return { ...out, requests };
}

test('a 5xx is tried 3 times, then the build fails', async () => {
  const r = await serve(() => 503);
  assert.equal(r.code, 1);
  assert.equal(r.requests, 3);
  assert.equal(r.stderr.match(/retrying in/g)?.length, 2);
  assert.match(r.stderr, /HTTP 503 \(after 3 tries\)/);
});

test('a 4xx is not retried', async () => {
  const r = await serve(() => 404);
  assert.equal(r.code, 1);
  assert.equal(r.requests, 1);
  assert.doesNotMatch(r.stderr, /retrying/);
  assert.match(r.stderr, /HTTP 404/);
});

test('a hash mismatch fails at once, even after a retry got the file through', async () => {
  const woff2 = Buffer.concat([Buffer.from('wOF2'), Buffer.from('not the real Satoshi')]);
  const bad = zip({ 'Fonts/WEB/fonts/Satoshi-Variable.woff2': woff2, 'License/FFL.txt': Buffer.from('licence') });
  const r = await serve((n) => (n === 0 ? 503 : bad));
  assert.equal(r.code, 1);
  assert.equal(r.requests, 2); // the 503, then the file: the mismatch is not tried again
  assert.match(r.stderr, /Satoshi-Variable\.woff2: sha256 [0-9a-f]{64} does not match the pinned hash/);
});

test('a dead socket is tried 3 times too', async () => {
  const server = createServer();
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const api = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await new Promise<void>((ok) => server.close(() => ok())); // nothing listens there now
  const r = await fetchFonts(api);
  assert.equal(r.code, 1);
  assert.equal(r.stderr.match(/ECONNREFUSED; retrying in/g)?.length, 2);
  assert.match(r.stderr, /ECONNREFUSED \(after 3 tries\)/);
});

// With the real fonts on disk (they are fetched at build, never committed): serve their own bytes after one 503. The
// pinned hashes pass, the script rewrites the same bytes and exits 0.
const have = ['Satoshi-Variable.woff2', 'CabinetGrotesk-Variable.woff2', 'FFL.txt'].every((f) => existsSync(fonts + f));
test('a 5xx that clears is retried and the build goes on', { skip: !have && 'the Fontshare fonts are not on disk' }, async () => {
  const file = (f: string) => readFileSync(fonts + f);
  const satoshi = zip({ 'Fonts/WEB/fonts/Satoshi-Variable.woff2': file('Satoshi-Variable.woff2'), 'License/FFL.txt': file('FFL.txt') });
  const cabinet = zip({ 'Fonts/WEB/fonts/CabinetGrotesk-Variable.woff2': file('CabinetGrotesk-Variable.woff2') });
  const r = await serve((n, path) => (n === 0 ? 503 : path.endsWith('/satoshi') ? satoshi : cabinet));
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.requests, 3); // satoshi twice, cabinet once
  assert.equal(r.stderr.match(/retrying in/g)?.length, 1);
});
