/**
 * W-034 measurement runner (not part of the unit suite):
 *   npx vitest run --config vitest.sim.config.ts tests/sim/balance.measure.test.ts
 * env: BIOMES (whiteout,alpine,fjord) LENS (sprint,standard) DIFFS (relaxed,normal,hard)
 *      SEEDS (comma list, or N for <PREFIX>-01..N; PREFIX default W034, round-2 held-out set W2H) POLS (policy names) OUT (jsonl path, appended)
 *      SHARD / SHARDS (split the run list across processes)
 */
import { it } from 'vitest';
import { measure, POLICIES, type RunSpec } from './balance';

const E = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const list = (v: string | undefined, d: string) => (v ?? d).split(',').map((s) => s.trim()).filter(Boolean);
const seeds = /^\d+$/.test(E.SEEDS ?? '') ? Array.from({ length: Number(E.SEEDS) }, (_, i) => `${E.PREFIX ?? 'W034'}-${String(i + 1).padStart(2, '0')}`) : list(E.SEEDS, 'W034-01');

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
  const out = E.OUT ?? '.measure/w034.jsonl';
  // (round 3) resume: runs already in OUT are skipped (the cloud machine restarts long jobs)
  const fsx = (await import('node:fs' as string)) as { existsSync: (p: string) => boolean; readFileSync: (p: string, e: string) => string };
  const done = new Set<string>();
  const key = (r: { biome: string; len: string; diff: string; seed: string; policy: string }) => `${r.biome}|${r.len}|${r.diff}|${r.seed}|${r.policy}`;
  if (fsx.existsSync(out)) for (const line of fsx.readFileSync(out, 'utf8').split('\n')) if (line.trim()) done.add(key(JSON.parse(line)));
  specs.forEach((s, i) => {
    if (i % shards !== shard || done.has(key(s))) return;
    appendFileSync(out, JSON.stringify(measure(s)) + '\n');
  });
}, 86_400_000);
