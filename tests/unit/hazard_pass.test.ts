/** Hazard pass reports: each hazard is reported passed at most once per run (engine-wide). */
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, DIFFICULTY, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';

describe('Hazard pass reports', () => {
  it('each hazard is reported passed at most once per run (Fjord)', () => {
    const c = makeCourse('custom', 'sprint', { biome: 'fjord', customText: 'HP1', difficulty: 'normal' });
    const ws = worldSeed(c);
    const m = buildMountain(c);
    const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
    const seen = new Map<number, number>();
    env.listen((e) => {
      if (e.type === 'hazard-passed') seen.set(e.hazard.id, (seen.get(e.hazard.id) ?? 0) + 1);
    });
    simulateCourse(m, new ObstacleField(m, ws), (s, t) => autopilotInput(m, s, 'skilled', t), { streaming: true, environment: env, yetiSpeed: DIFFICULTY.normal.yetiSpeed, maxTime: 400 });
    expect(seen.size).toBeGreaterThan(3);
    for (const [id, n] of seen) expect(n, `hazard ${id}`).toBe(1);
  }, 300_000);
});
