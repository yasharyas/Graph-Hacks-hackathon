// Writes .br and .gz next to every compressible file in web/dist, so serveStatic({ precompressed: true }) sends them
// without compressing per request. Run after vite build.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const dir = fileURLToPath(new URL('../web/dist/', import.meta.url));
let n = 0;
for (const f of readdirSync(dir, { recursive: true, withFileTypes: true })) {
  if (!f.isFile() || !/\.(js|css|html|svg|json|txt|map)$/.test(f.name)) continue;
  const path = join(f.parentPath, f.name);
  const buf = readFileSync(path);
  if (buf.length < 1024) continue;
  writeFileSync(path + '.br', brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }));
  writeFileSync(path + '.gz', gzipSync(buf, { level: 9 }));
  n++;
}
console.log(`precompressed ${n} files in web/dist`);
