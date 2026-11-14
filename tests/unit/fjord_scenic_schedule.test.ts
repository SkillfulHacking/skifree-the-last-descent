/**
 * The key schedules used by tests/e2e/scenic.spec.ts (the real Scenic Route journey) still reach
 * the first viewpoint of The Last Descent (Sprint) on the Fjord Coast in the headless physics, with
 * the keyboard steering ramp and 1/60 s frames, across ±0.15 s of timing error.
 */
import { expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { ObstacleField } from '../../src/physics/obstacles';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { NO_INPUT, PHYS_DT, SkierPhysics } from '../../src/physics/SkierPhysics';
const c = makeCourse('classic', 'sprint', { biome: 'fjord' });
const m = buildMountain(c);
const f = new ObstacleField(m, worldSeed(c));
f.ensure(-100, 600);
const L = m.coast!.lookouts(0, 300)[0]!;
const DT = 1/60;
function run(sched: [number, number, number][], jitter: number) {
  const p = new SkierPhysics(m, f, () => [], new BiomeEnvironment(m, f.seed));
  p.reset(m.routeX(2), 2, 0, 0);
  let kb = 0; let best = 1e9; let crash = false; let acc = 0; let bt = 0;
  for (let t = 0; t < 40; t += DT) {
    let tgt = 0;
    for (const [a, b, v] of sched) if (t >= a + jitter && t < b + jitter) tgt = v;
    const rate = tgt === 0 ? 12 : Math.sign(tgt) !== Math.sign(kb) ? 22 : 9;
    kb += Math.max(-rate*DT, Math.min(rate*DT, tgt - kb));
    if (tgt === 0 && Math.abs(kb) < 0.02) kb = 0;
    acc += DT;
    while (acc >= PHYS_DT) { p.step({ ...NO_INPUT, steer: kb }, PHYS_DT); acc -= PHYS_DT; }
    if (p.s.crashed) crash = true;
    const d = Math.hypot(p.s.pos.x - L.x, p.s.pos.z - L.z);
    if (d < best) { best = d; bt = t; }
    if (p.s.pos.z > L.z + 40) break;
  }
  return { best, crash, bt };
}
it('the e2e Scenic Route key schedules pass through the first Sprint viewpoint', () => {
  expect(L.r).toBe(14);
  expect(L.z).toBeLessThan(200);
  for (const j of [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15]) {
    const r = run([[1.5, 1.7, 1], [7.7, 7.8, -1]], j);
    expect(r.crash).toBe(false);
    expect(r.best, `jitter ${j}`).toBeLessThan(L.r - 3);
  }
  // the fallback schedule (after a Restart)
  expect(run([[1, 1.5, 1], [4.5, 5, -1]], 0).best).toBeLessThan(L.r - 3);
});
