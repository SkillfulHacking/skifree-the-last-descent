// Dev server for the Fjord art test scene (/artscene.html). Kept separate from the game's config:
// its own cache directory (the worktree's node_modules is shared), and it never touches the build.
//   npx vite --config tools/artscene/vite.config.mts --port 4480
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, '../..'),
  base: './',
  cacheDir: '/tmp/vite-artscene-cache',
  server: { host: '127.0.0.1', strictPort: true },
  logLevel: 'warn',
});
