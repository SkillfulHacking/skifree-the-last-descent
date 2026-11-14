/**
 * Round 4b (reviewer B r4 #1, Critical): the wall rule could leave a skier in a pocket at the foot of
 * the first cave's mouth — before the cave trigger, so no Yeti and no relocation came — on Alpine and
 * on the Fjord. SkierPhysics.pinWatchdog puts a boxed-in or stranded skier back on the piste. These
 * are reviewer B's trapped cases (scratch/review-b-r4/pinsweep): each must be back on the line.
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { NO_INPUT, PHYS_DT, SkierPhysics } from '../../src/physics/SkierPhysics';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { clamp } from '../../src/core/rng';

const wrap2 = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const CASES = [
  ['alpine', 'B4C3', 'endurance', -60, 28, 0.8],
  ['alpine', 'B4C3', 'endurance', -60, 40, 0.8],
  ['alpine', 'B4C1', 'endurance', -100, 18, 0.4],
  ['fjord', 'B4C2', 'standard', -60, 40, 0.8],
] as const;

describe('no unrecoverable pocket at a cave mouth (engine-wide)', () => {
  for (const [biome, sd, len, dz0, v0, ang] of CASES)
    it(`${biome} ${sd} ${len}: a skier steered into the cave side gets back to the line`, () => {
      const c = makeCourse('custom', len, { biome, customText: sd });
      const m = buildMountain(c);
      const side = biome === 'fjord' ? -1 : 1;
      const e = m.profile.encounters(-Infinity, m.finishZ)[0]!;
      const z0 = e.caveZ + dz0;
      const p = new SkierPhysics(m, null, () => [], new BiomeEnvironment(m, worldSeed(c)));
      p.reset(m.routeX(z0) + side * 4, z0, side * ang, v0);
      // drive into the cave side, tucked, for 9 s
      for (let i = 0; i < 9 / PHYS_DT; i++) p.step({ ...NO_INPUT, steer: clamp(-wrap2(side * ang - p.s.heading) * 3, -1, 1), tuck: 1, recover: p.s.crashTime > 1.4 });
      // then try to get back to the piste
      let back = false;
      for (let i = 0; i < 20 / PHYS_DT && !back; i++) {
        const s = p.s;
        p.step({ ...NO_INPUT, steer: clamp(-wrap2(Math.atan2(m.routeX(s.pos.z + 20) - s.pos.x, 20) - s.heading) * 3, -1, 1), tuck: 1, recover: s.crashTime > 1.4 });
        back = Math.abs(s.pos.x - m.routeX(s.pos.z)) < 12;
      }
      expect(back).toBe(true);
    });
});
