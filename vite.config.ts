import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The app lives in web/; the repo root is allowed so mock mode can import shared/fixtures/*.json.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist', // relative to root: web/dist
    // No inline scripts: production CSP is `script-src 'self'`.
    modulePreload: { polyfill: false },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8080' },
    fs: { allow: [repoRoot] },
  },
});
