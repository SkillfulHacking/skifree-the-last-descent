// W-089 (Review B3-7): the headless simulator streams hazards ahead of the skier as the game does
// (World.stream → environment.stream: z − 80 … z + 400). Round 3's simulator generated a hazard band
// only when the skier entered it, so a weather reader could not see rows and cells in the next band
// and the alert logic could not track them — every balance table measured a blinder skier than the game.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { ObstacleField } from '../../src/physics/obstacles';
import { simulateCourse } from '../../src/game/simulate';
import { autopilotInput } from '../../src/debug/autopilot';
import type { HazardInstance } from '../../src/world/hazards/hazard';

describe('W-089 the simulator streams hazards ahead', () => {
  for (const streaming of [false, true]) {
    it(`what a driver can query ahead matches the game's window (streaming ${streaming})`, () => {
      const c = makeCourse('classic', 'sprint', { biome: 'whiteout', difficulty: 'normal' });
      const m = buildMountain(c);
      const ws = worldSeed(c);
      const env = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
      // the game's view of the hazards (a fully generated field)
      const all = new BiomeEnvironment(m, ws, { difficulty: 'normal' });
      all.hazards.ensure(-300, m.finishZ + 400);
      let checks = 0, missing = 0;
      const near: HazardInstance[] = [];
      simulateCourse(m, new ObstacleField(m, ws), (s, t) => {
        if (Math.floor(t * 2) !== Math.floor((t - 1 / 120) * 2)) {
          // every hazard the game holds within 300 m ahead must be visible to the driver too
          const want = all.hazards.near(s.pos.x, s.pos.z + 150, 150, []).filter((h) => h.z > s.pos.z + 5 && h.z < s.pos.z + 300).map((h) => h.id);
          const have = new Set(env.hazards.near(s.pos.x, s.pos.z + 150, 150, near).map((h) => h.id));
          checks += want.length;
          missing += want.filter((id) => !have.has(id)).length;
        }
        return autopilotInput(m, s, 'skilled', t);
      }, { environment: env, maxTime: 120, streaming });
      expect(checks).toBeGreaterThan(50);
      expect(missing).toBe(0);
    });
  }
});
