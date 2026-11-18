/**
 * W-034 measurement runner (not part of the unit suite):
 *   npx vitest run --config vitest.sim.config.ts tests/sim/balance.measure.test.ts
 * env: BIOMES (whiteout,alpine,fjord) LENS (sprint,standard) DIFFS (relaxed,normal,hard)
 *      SEEDS (comma list, or N for W034-01..W034-N) POLS (policy names) OUT (jsonl path, appended)
 *      SHARD / SHARDS (split the run list across processes)
 */
import { it } from 'vitest';
import { measure, POLICIES, type RunSpec } from './balance';

const E = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const list = (v: string | undefined, d: string) => (v ?? d).split(',').map((s) => s.trim()).filter(Boolean);
const seeds = /^\d+$/.test(E.SEEDS ?? '') ? Array.from({ length: Number(E.SEEDS) }, (_, i) => `W034-${String(i + 1).padStart(2, '0')}`) : list(E.SEEDS, 'W034-01');

it('measure', async () => {
  const { appendFileSync } = (await import('node:fs' as string)) as { appendFileSync: (p: string, d: string) => void };
  const specs: RunSpec[] = [];
  for (const biome of list(E.BIOMES, 'whiteout'))
    for (const len of list(E.LENS, 'sprint'))
      for (const diff of list(E.DIFFS, 'normal'))
        for (const seed of seeds)
          for (const policy of list(E.POLS, 'informed,blind')) {
            if (!(policy in POLICIES)) throw new Error(`unknown policy ${policy}`);
            specs.push({ biome: biome as RunSpec['biome'], len: len as RunSpec['len'], diff: diff as RunSpec['diff'], seed, policy });
          }
  const shards = Number(E.SHARDS ?? 1);
  const shard = Number(E.SHARD ?? 0);
  const out = E.OUT ?? '/tmp/w034.jsonl';
  specs.forEach((s, i) => {
    if (i % shards !== shard) return;
    appendFileSync(out, JSON.stringify(measure(s)) + '\n');
  });
}, 86_400_000);
