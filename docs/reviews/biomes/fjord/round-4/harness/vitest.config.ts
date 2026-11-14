// Round-4 wind-decision harness. From the repo root:
//   OUT=x.jsonl LENS=sprint SEEDS=A,B DIFFS=normal DRIVERS=read,ignore npx vitest run --config docs/reviews/biomes/fjord/round-4/harness/vitest.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({ root: fileURLToPath(new URL('../../../../../..', import.meta.url)), test: { include: ['docs/reviews/biomes/fjord/round-4/harness/**/*.test.ts'], environment: 'node', testTimeout: 86_400_000 } });
