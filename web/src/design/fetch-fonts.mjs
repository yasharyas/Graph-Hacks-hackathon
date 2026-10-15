#!/usr/bin/env node
// Fetches the Fontshare webfonts that Patient Zero self-hosts, into web/public/fonts/.
//
// Why a script instead of committed files: ITF Free Font License v2.0 §01 permits self-hosting
// on our own servers; §02 forbids redistributing the font files through a public repository and
// forbids subsetting or format conversion. So the official zips are downloaded at build time and
// the variable woff2 files are copied out byte-for-byte. See web/public/fonts/README.md.
//
// Usage: node web/src/design/fetch-fonts.mjs [--force]
// Zero dependencies: Node 24 fetch + zlib. Exits non-zero on any failure so a Docker build fails
// instead of shipping a site that renders the generic fallback fonts.

import { access, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', 'public', 'fonts');
const force = process.argv.includes('--force');

// slug → { zip entry suffix: output file name }
const FONTS = [
  {
    slug: 'satoshi',
    files: {
      'Fonts/WEB/fonts/Satoshi-Variable.woff2': 'Satoshi-Variable.woff2',
      'License/FFL.txt': 'FFL.txt',
    },
  },
  {
    slug: 'cabinet-grotesk',
    files: { 'Fonts/WEB/fonts/CabinetGrotesk-Variable.woff2': 'CabinetGrotesk-Variable.woff2' },
  },
];

const exists = (p) => access(p).then(() => true, () => false);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Minimal zip reader (stored + deflate, no zip64). Returns Map<entryName, Buffer>. */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`bad local header for ${name}`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + csize);
    const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    if (!data) throw new Error(`unsupported compression ${method} for ${name}`);
    if (data.length !== usize) throw new Error(`size mismatch for ${name}`);
    files.set(name, data);
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

async function fetchZip(slug) {
  const url = `https://api.fontshare.com/v2/fonts/download/${slug}`;
  const res = await fetch(url, { headers: { 'user-agent': 'patient-zero-build (fetch-fonts.mjs)' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  await mkdir(outDir, { recursive: true });
  let fetched = 0;
  for (const font of FONTS) {
    const targets = Object.entries(font.files);
    const missing = [];
    for (const [, out] of targets) if (force || !(await exists(path.join(outDir, out)))) missing.push(out);
    if (missing.length === 0) { console.log(`${font.slug}: present, skipping`); continue; }

    const entries = unzip(await fetchZip(font.slug));
    for (const [suffix, out] of targets) {
      const key = [...entries.keys()].find((k) => k.endsWith(suffix));
      if (!key) throw new Error(`${font.slug}: ${suffix} not found in download`);
      const data = entries.get(key);
      if (out.endsWith('.woff2') && data.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${out}: not a woff2 file`);
      await writeFile(path.join(outDir, out), data);
      console.log(`${out}  ${data.length} bytes  sha256 ${sha256(data)}`);
      fetched++;
    }
  }
  console.log(fetched ? `fetched ${fetched} file(s) into ${path.relative(process.cwd(), outDir)}` : 'nothing to do');
}

main().catch((err) => {
  console.error(`fetch-fonts: ${err.message}`);
  process.exit(1);
});
