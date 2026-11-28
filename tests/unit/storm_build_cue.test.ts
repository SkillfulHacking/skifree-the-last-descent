// W-102 (review B5-1): the Hard storm build-up past 3 km is told to the player (two captions), and only
// where a build-up exists (Whiteout Hard); a unit test of the build-up the captions follow.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';

type Fs = { readFileSync(p: string, e: string): string };

describe('Hard storm build-up cue', () => {
  it('the build-up is 0 before 3 km and reaches ×1.5 by 8 km on Whiteout Hard only', () => {
    for (const d of ['normal', 'hard'] as const) {
      const c = makeCourse('classic', 'standard', { biome: 'whiteout', difficulty: d });
      const env = new BiomeEnvironment(buildMountain(c), worldSeed(c), { difficulty: d });
      const k = (z: number) => env.intensityAt(z) / env.intensity - 1;
      expect(k(2500)).toBeCloseTo(0, 6);
      if (d === 'hard') {
        expect(k(4000)).toBeGreaterThan(0.05);
        expect(k(8500)).toBeCloseTo(0.5, 6);
      } else expect(k(8500)).toBeCloseTo(0, 6);
    }
  });
  it('the session captions the start and the peak of the build-up', async () => {
    const s = ((await import('node:fs' as string)) as Fs).readFileSync('src/game/GameSession.ts', 'utf8');
    expect(s).toMatch(/the storms grow stronger from here down the mountain/);
    expect(s).toMatch(/the storms are at their fiercest now/);
  });
});
