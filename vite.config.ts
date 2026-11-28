import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
// @ts-expect-error: a plain ESM helper shared with the evidence tools (no types)
import { buildInfo } from './tools/lib/build_info.mjs';

// preview benches are dev tools: only bundled when PREVIEWS=1
const previews = !process.env.PREVIEWS ? {} : Object.fromEntries(
  readdirSync(resolve(__dirname, 'preview'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [`preview_${f.replace('.html', '')}`, resolve(__dirname, 'preview', f)]),
);

export default defineConfig({
  base: './',
  // W-106: the build records what it was built from, so evidence binds to the served build
  plugins: [{ name: 'build-info', apply: 'build', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify(buildInfo()) }); } }],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), ...previews } },
  },
  server: { host: '127.0.0.1' },
});
