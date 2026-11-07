import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';

// preview benches are dev tools: only bundled when PREVIEWS=1
const previews = !process.env.PREVIEWS ? {} : Object.fromEntries(
  readdirSync(resolve(__dirname, 'preview'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [`preview_${f.replace('.html', '')}`, resolve(__dirname, 'preview', f)]),
);

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), ...previews } },
  },
  server: { host: '127.0.0.1' },
});
