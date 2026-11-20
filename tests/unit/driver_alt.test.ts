/**
 * Gitar (round 3): the measurement driver keeps an alternate line from its fork to where the lines
 * rejoin, and re-bases its plan when the reference line changes — its aim never jumps across the
 * piste (a gap steer used to drop it off the alt line with the plan still built against it).
 */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { whiteoutDriver } from '../sim/whiteoutDriver';
import { POLICIES } from '../sim/balance';

describe('measurement driver on the alternate lines', () => {
  it('the planned aim moves smoothly (no jump > 12 m between reads) on courses with alternate lines', () => {
    let alt = 0;
    for (const seed of ['W3H-01', 'W3H-02', 'W3H-03', 'W3H-04']) {
      const c = makeCourse('custom', 'sprint', { biome: 'whiteout', customText: seed, difficulty: 'relaxed' });
      const m = buildMountain(c);
      const ws = worldSeed(c);
      const env = new BiomeEnvironment(m, ws, { difficulty: 'relaxed' });
      const field = new ObstacleField(m, ws);
      const stats = { alt: 0, main: 0, gapSteers: 0, brakes: 0, maxAimJump: 0 };
      const drv = whiteoutDriver(m, env, ws, { ...POLICIES.driftsOnly! }, stats, 0.25, field);
      simulateCourse(m, field, drv, { streaming: true, environment: env, yetiSpeed: DIFFICULTY.relaxed.yetiSpeed, maxTime: 400 });
      alt += stats.alt;
      expect(stats.maxAimJump).toBeLessThan(12);
    }
    expect(alt).toBeGreaterThan(0);
  }, 600_000);
});
