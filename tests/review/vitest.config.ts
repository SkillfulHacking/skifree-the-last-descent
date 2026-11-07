// Reviewer B (internal) probe suite. Run from the repo root:
//   npx vitest run --config tests/review/vitest.config.ts --disableConsoleIntercept
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({ root: fileURLToPath(new URL('../..', import.meta.url)), test: { include: ['tests/review/**/*.test.ts'], environment: 'node', testTimeout: 1_500_000 } });
