// (round 6, W-105) time each slice of the Whiteout cave build (Cave.buildSteps) and its storm dressing
// (dressStormCaveSteps) in node: the CPU work per step, without the GPU upload. Each build runs REPS
// times (the first is cold: JIT); writes the slices, the build phases and the slowest warm step to OUT.
import { expect, it } from 'vitest';
const ctx2d: unknown = new Proxy(
  {},
  {
    get: (_t, k) =>
      k === 'createLinearGradient' || k === 'createRadialGradient'
        ? () => ({ addColorStop() {} })
        : k === 'createImageData' || k === 'getImageData'
          ? (a: number, b: number, c?: number, d?: number) => ({ width: c ?? a, height: d ?? b, data: new Uint8ClampedArray((c ?? a) * (d ?? b) * 4) })
          : () => {},
    set: () => true,
  },
);
(globalThis as unknown as { document: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
const P = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process;
await import('../../src/world/biomes');
const { buildMountain, makeCourse } = await import('../../src/game/CourseConfig');
const { Cave } = await import('../../src/world/Cave');
const { dressStormCaveSteps } = await import('../../src/world/biomes/whiteout/views/stormCave');

function timed<T>(job: Generator<void, T, void>): { value: T; steps: number[] } {
  const steps: number[] = [];
  let t0 = performance.now();
  let r = job.next();
  while (!r.done) {
    steps.push(performance.now() - t0);
    t0 = performance.now();
    r = job.next();
  }
  steps.push(performance.now() - t0);
  return { value: r.value, steps };
}

it('cave slices', async () => {
  const out: string[] = [];
  const reps = Number(P.env.REPS ?? 3);
  const m = buildMountain(makeCourse('classic', 'standard', { biome: 'whiteout', difficulty: 'normal' }));
  const encs = m.profile.encounters(0, 9000).slice(0, 2);
  let warmMax = 0;
  for (const e of encs) {
    for (let rep = 0; rep < reps; rep++) {
      const c = timed(Cave.buildSteps(m, e.anchor, 'high'));
      const d = timed(dressStormCaveSteps({ mountain: m, anchor: e.anchor, cave: c.value, quality: 'high', biome: m.biome } as never));
      const f = (a: number[]) => `n ${a.length} max ${Math.max(...a).toFixed(1)} [${a.map((x) => x.toFixed(0)).join(',')}]`;
      out.push(`enc ${e.index} rep ${rep} cave ${f(c.steps)}`, `  phases ${JSON.stringify(c.value.stats.phases)}`, `enc ${e.index} rep ${rep} dress ${f(d.steps)}`);
      if (rep > 0) warmMax = Math.max(warmMax, ...c.steps, ...d.steps);
      c.value.dispose();
    }
  }
  out.push(`encounters ${encs.length} warm max step ${warmMax.toFixed(1)} ms`);
  ((await import('node:fs' as string)) as { writeFileSync(p: string, d: string): void }).writeFileSync(P.env.OUT ?? '/tmp/slices.txt', out.join('\n'));
  expect(encs.length).toBeGreaterThan(0);
  expect(warmMax).toBeGreaterThan(0);
}, 600000);
