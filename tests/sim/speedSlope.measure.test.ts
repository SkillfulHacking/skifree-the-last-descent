/**
 * Round 6 (owner ruling 2): how fast skilled and competent skiers actually go on each grade of ground, per
 * location and weather, during chases. The terrain-paced pursuit sets the Yeti's pace from this, not from
 * the theoretical tucked terminal speed (round 6 trial: terminal overstated real speeds by 15–30 %).
 *   OUT=… SEEDS=CLASSIC,R6T:6 npx vitest run --config vitest.sim.config.ts tests/sim/speedSlope.measure.test.ts
 */
import { expect, it } from 'vitest';
import '../../src/world/biomes';
import { CHASE_SAMPLER, measure, type RunSpec } from './balance';
import { EXPERT_TUCK } from './whiteoutDriver';
import { outPath } from './outPath';

const P = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;
const E = P.env;
const seeds = (E.SEEDS ?? 'CLASSIC,R6T:6').split(',').flatMap((s) => (/^[A-Z0-9]+:\d+$/.test(s) ? Array.from({ length: Number(s.split(':')[1]) }, (_, i) => `${s.split(':')[0]}-${String(i + 1).padStart(2, '0')}`) : [s]));

it('speed by slope', async () => {
  const fs = (await import('node:fs' as string)) as { writeFileSync(p: string, d: string): void };
  Object.assign(EXPERT_TUCK, { on: true, band: 0.3 });
  // samples once a second of chase: [slope deg (1° bins), speed]
  const bins: Record<string, number[][]> = {};
  let key = '';
  let next = 0;
  CHASE_SAMPLER.fn = (m, s, _y, ct) => {
    if (ct < next) return;
    next = Math.floor(ct) + 1;
    if (s.crashed || ct < 4) return;
    const b = Math.round(m.slopeDeg(s.pos.z));
    (bins[key] ??= []).push([b, s.speed]);
  };
  let runs = 0;
  for (const biome of ['alpine', 'fjord', 'whiteout'] as const)
    for (const sloppy of [false, true])
      for (const len of ['sprint', 'standard'] as const)
        for (const seed of seeds) {
          key = `${biome}|${sloppy ? 'competent' : 'expert'}`;
          next = 0;
          const spec: RunSpec = { biome, len, diff: 'normal', seed, policy: biome === 'whiteout' ? 'informed2NoLee' : 'blind', pole: true, fjordRead: true, sloppy };
          // a generous Yeti so the chase runs the whole course: the skier's speed is what is measured
          measure(spec);
          runs++;
        }
  CHASE_SAMPLER.fn = null;
  const out: Record<string, Record<number, { n: number; p25: number; p50: number; p75: number }>> = {};
  for (const [k, v] of Object.entries(bins)) {
    const by: Record<number, number[]> = {};
    for (const [b, sp] of v) (by[b!] ??= []).push(sp!);
    out[k] = {};
    for (const [b, a] of Object.entries(by)) {
      a.sort((x, y) => x - y);
      const q = (f: number) => +a[Math.min(a.length - 1, Math.floor(f * a.length))]!.toFixed(2);
      out[k]![Number(b)] = { n: a.length, p25: q(0.25), p50: q(0.5), p75: q(0.75) };
    }
  }
  fs.writeFileSync(await outPath(E.OUT, '.measure/speed_slope.json'), JSON.stringify(out, null, 1));
  expect(runs).toBeGreaterThan(0);
  expect(Object.keys(out).length).toBe(6);
}, 86_400_000);
