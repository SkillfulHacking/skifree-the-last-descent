import { defineConfig } from '@playwright/test';

/**
 * Browser integration tests run against the production build (`npm run build` first).
 * By default they use a locally installed Chrome; set PW_CHROME to another binary, or unset it
 * to use Playwright's bundled Chromium (`npx playwright install chromium`).
 * Software rendering (SwiftShader) is forced so the tests also run on GPU-less CI machines —
 * frame rates there are NOT representative of real hardware.
 */
const chrome = process.env.PW_CHROME ?? '/usr/bin/google-chrome';
/** PW_PORT: preview port (lets several worktrees run their e2e suites side by side) */
const port = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 15 * 60 * 1000,
  expect: { timeout: 120_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 960, height: 540 },
    launchOptions: {
      executablePath: chrome || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    },
    actionTimeout: 120_000,
  },
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
