import { defineConfig } from 'vitest/config';
// balance / measurement runs (tests/sim/*.measure.test.ts): long, opt-in, never in the unit suite
export default defineConfig({ test: { include: ['tests/sim/**/*.measure.test.ts'], environment: 'node', testTimeout: 86_400_000 } });
