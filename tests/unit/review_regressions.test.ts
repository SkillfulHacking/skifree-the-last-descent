import { describe, expect, it } from 'vitest';
import { Mountain } from '../../src/world/course';
import { ObstacleField } from '../../src/physics/obstacles';
import { PHYS_DT, SkierPhysics, type SkierInput } from '../../src/physics/SkierPhysics';
import { MenuSystem } from '../../src/ui/Menu';
import { parseCourseId } from '../../src/game/CourseConfig';

// Regression tests ported from the internal reviewers' probes (B14).

function run(m: Mountain, f: ObstacleField, zA: number, zB: number, target: (z: number) => number) {
  const phys = new SkierPhysics(m, f);
  const x0 = m.routeX(zA);
  f.ensure(zA - 300, zB + 700);
  phys.teleport(x0, zA, Math.atan2(m.routeX(zA + 10) - x0, 10), 20);
  let t = 0;
  let ice = 0, n = 0;
  while (phys.s.pos.z < zB && t < 300) {
    const s = phys.s;
    const look = 7 + s.speed * 0.55;
    const tx = target(s.pos.z + look);
    const desired = Math.atan2(tx - s.pos.x, look);
    let err = desired - s.heading; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI;
    const inp: SkierInput = { steer: Math.max(-1, Math.min(1, -err * 3.2)), tuck: Math.abs(err) < 0.16 ? 1 : 0, brake: 0, drift: false, pop: false, recover: s.crashTime > 1.4 };
    phys.step(inp, PHYS_DT); t += PHYS_DT;
    if (m.surfaceAt(s.pos.x, s.pos.z) === 'ice') ice++; n++;
  }
  return { t, crashes: phys.s.crashes, ice: ice / Math.max(1, n), v: phys.s.speed };
}

describe('review regressions', () => {
  it('B3: alternate lines save time over the guaranteed route for a skilled driver', { timeout: 600_000 }, () => {
    const saves: number[] = [];
    for (const seed of [7, 4242]) {
      const m = Mountain.generated(seed, 20000);
      const f = new ObstacleField(m, seed);
      for (const a of m.profile.altRoutes(400, 19000)) {
        const zA = a.z0 - 40;
        const zB = a.z1 + 40;
        const r = run(m, f, zA, zB, (z) => m.routeX(z));
        const al = run(m, f, zA, zB, (z) => (z >= a.z0 && z <= a.z1 ? m.profile.altX(a, z) : m.routeX(z)));
        saves.push(r.t - al.t);
      }
    }
    expect(saves.length).toBeGreaterThan(4);
    const mean = saves.reduce((p, q) => p + q, 0) / saves.length;
    expect(mean).toBeGreaterThan(0.3);
    expect(saves.filter((s) => s > 0).length / saves.length).toBeGreaterThan(0.75);
  });

  it('E12: an invalid unconfirmed course code blocks Start instead of starting the old course', () => {
    let started = 0;
    let codeError: string | null = null;
    const items = [
      { kind: 'button' as const, label: 'Start', primary: true, action: () => void started++ },
      {
        kind: 'text' as const,
        label: 'Enter a course code',
        get: () => '',
        set: (v: string) => {
          if (!parseCourseId(v)) {
            codeError = 'bad';
            return false;
          }
          codeError = null;
        },
      },
    ];
    // drive the real Menu logic without a DOM
    const fake = { drafts: new Map<unknown, string>(), current: { items }, index: 0, onSound: () => {}, commitDrafts: (MenuSystem.prototype as unknown as { commitDrafts: () => unknown }).commitDrafts } as unknown as Record<string, unknown> & { drafts: Map<unknown, string>; current: { items: typeof items } };
    Object.defineProperty(fake, 'current', { value: { items } });
    fake.drafts.set(items[1], 'NOPE-123');
    (MenuSystem.prototype as unknown as { activate: () => void }).activate.call(fake);
    expect(started).toBe(0);
    expect(codeError).toBe('bad');
    // a valid draft is applied and Start proceeds
    fake.drafts.set(items[1], 'CLASSIC-SPR');
    (MenuSystem.prototype as unknown as { activate: () => void }).activate.call(fake);
    expect(started).toBe(1);
  });
});
