// Dev server for the p5.brush scribble sketches and the design bench, plus an export endpoint that
// writes a rendered canvas into web/public/scribbles/. Run from the repo root:
//   node node_modules/vite/bin/vite.js --config design/scribbles/vite.config.mjs
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const outDir = path.join(repoRoot, 'web', 'public', 'scribbles');
const NAME = /^[a-z0-9-]{1,64}$/;
const FORMATS = new Set(['png', 'webp']);
const MAX_BYTES = 8 * 1024 * 1024;

export default defineConfig({
  root: here,
  cacheDir: path.join(repoRoot, 'node_modules', '.vite-scribbles'), // own optimizer cache: p5 deps must not invalidate the app's
  publicDir: path.join(repoRoot, 'web', 'public'), // serves /fonts/* and /scribbles/* like the app
  resolve: { alias: { '@design': path.join(repoRoot, 'web', 'src', 'design') } },
  server: { port: 5190, strictPort: true, fs: { allow: [repoRoot] } },
  optimizeDeps: { include: ['p5', 'p5.brush'] },
  plugins: [
    tailwindcss(), // the bench compiles web/src/design/tokens.css exactly as the app will
    {
      name: 'scribble-export',
      configureServer(server) {
        server.middlewares.use('/__export', (req, res) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          const name = url.searchParams.get('name') ?? '';
          const fmt = url.searchParams.get('fmt') ?? '';
          if (req.method !== 'POST' || !NAME.test(name) || !FORMATS.has(fmt)) {
            res.statusCode = 400;
            res.end('bad request');
            return;
          }
          const chunks = [];
          let size = 0;
          req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BYTES) req.destroy();
            else chunks.push(c);
          });
          req.on('end', async () => {
            try {
              await mkdir(outDir, { recursive: true });
              const file = path.join(outDir, `${name}.${fmt}`);
              const buf = Buffer.concat(chunks);
              await writeFile(file, buf);
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify({ ok: true, file: path.relative(repoRoot, file).replaceAll('\\', '/'), bytes: buf.length }));
            } catch (err) {
              res.statusCode = 500;
              res.end(String(err));
            }
          });
        });
      },
    },
  ],
});
