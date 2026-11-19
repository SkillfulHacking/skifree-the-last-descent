/**
 * Round 3 (R2 C N-1): on Whiteout the victory auto-steer stops the skier on the rescue station's
 * mark (the porch), not ~20 m short of it; the default stop (Alpine, Fjord) is unchanged.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse } from '../../src/game/CourseConfig';
import { SkierPhysics, PHYS_DT, DRIFT_MIN_SPEED } from '../../src/physics/SkierPhysics';
import { rescueLayout } from '../../src/world/biomes/whiteout/views/rescue';
import { victorySteer } from '../../src/game/victorySteer';

function arrive(speed: number, onMark: boolean) {
  const c = makeCourse('classic', 'sprint', { biome: 'whiteout' });
  const m = buildMountain(c);
  const fz = m.finishZ;
  const fx = m.routeX(fz);
  const sp = rescueLayout(m, { x: fx, z: fz }).stop;
  const phys = new SkierPhysics(m, null);
  phys.reset(fx, fz + 1, 0, speed);
  const st = { hockey: false };
  let t = 0;
  for (; t < 40; t += PHYS_DT) {
    const s = phys.s;
    const { input } = victorySteer(s, sp, st, { onMark, driftMin: DRIFT_MIN_SPEED });
    phys.step(input, PHYS_DT);
    phys.drainEvents();
    if (s.speed < 0.5) s.vel.multiplyScalar(0.9);
    if (t > 2 && s.speed < 0.3) break;
  }
  return { d: Math.hypot(phys.s.pos.x - sp.x, phys.s.pos.z - sp.z), t, crashed: phys.s.crashed };
}

describe('victory stop on the mark (R2 C N-1)', () => {
  for (const v of [8, 14, 20, 26]) {
    it(`Whiteout: arriving at ${v} m/s, the skier halts within 3 m of the porch mark`, () => {
      const r = arrive(v, true);
      expect(r.crashed).toBe(false);
      expect(r.d).toBeLessThan(3);
      expect(r.t).toBeLessThan(9);
    });
  }
  it('the default stop is the old one (halts short of the mark)', () => {
    expect(arrive(20, false).d).toBeGreaterThan(8);
  });
});
