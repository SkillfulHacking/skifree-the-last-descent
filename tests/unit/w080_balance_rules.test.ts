// Round 4, owner's decision A (W-079 / W-080): the rule changes behind the Hard ladder.
import { describe, expect, it } from 'vitest';
import '../../src/world/biomes';
import { buildMountain, makeCourse, worldSeed } from '../../src/game/CourseConfig';
import { BiomeEnvironment } from '../../src/world/capabilities/environment';
import { HEADWIND_STANCE, makeEnvQuery, makeEnvSample } from '../../src/physics/environment';
import { TUNING } from '../../src/physics/SkierPhysics';
import { getBiome } from '../../src/world/biome';
import { CREST_LEE, whiteoutExposure } from '../../src/world/biomes/whiteout/storm';
import { DRIFT, type DriftParams } from '../../src/world/biomes/whiteout/hazards';

describe('W-080 headwind drag follows the stance', () => {
  it('the tucked share is the ratio of the skier\'s own drag coefficients', () => {
    expect(HEADWIND_STANCE.tuck).toBeCloseTo(TUNING.dragTuck / TUNING.dragUpright, 6);
  });
  for (const biome of ['fjord', 'whiteout'] as const) {
    it(`${biome}: a tucked skier takes ${(HEADWIND_STANCE.tuck * 100).toFixed(0)}% of an upright one's headwind drag`, () => {
      const c = makeCourse('classic', 'sprint', { biome, difficulty: 'normal' });
      const m = buildMountain(c);
      const env = new BiomeEnvironment(m, worldSeed(c), { difficulty: 'normal' });
      const noWind = new BiomeEnvironment(m, worldSeed(c), { difficulty: 'normal', headwind: false });
      expect(env.headwind).toBeGreaterThan(0);
      const drag = (e: BiomeEnvironment, tuck: number) => {
        const q = makeEnvQuery();
        Object.assign(q, { x: m.routeX(600), z: 600, y: m.heightAt(m.routeX(600), 600), t: 40, speed: 18, grounded: true, crashed: false, tuck });
        const o = makeEnvSample();
        e.sample(q, o);
        return o.surface.dragAdd;
      };
      const up = drag(env, 0) - drag(noWind, 0);
      const tk = drag(env, 1) - drag(noWind, 1);
      expect(up).toBeGreaterThan(0);
      expect(tk / up).toBeCloseTo(HEADWIND_STANCE.tuck, 2);
    });
  }
});

describe('W-080 Whiteout terrain and lines', () => {
  it('regular segments keep at least 15° (the storm floor)', () => {
    expect((getBiome('whiteout').terrain as { minSlope?: number }).minSlope).toBe(15);
  });
  it('where a crest line runs, the main line beside it takes CREST_LEE.main of the wind; the crest takes all of it', () => {
    expect(CREST_LEE.main).toBe(0.75);
    const c = makeCourse('classic', 'standard', { biome: 'whiteout', difficulty: 'normal' });
    const m = buildMountain(c);
    let checked = 0;
    for (let z = 400; z < m.finishZ - 200 && checked < 20; z += 25) {
      const a = m.profile.altRouteX(z);
      if (a === null || Math.abs(a - m.routeX(z)) < 20) continue;
      const main = whiteoutExposure(m, m.routeX(z), z);
      const crest = whiteoutExposure(m, a, z);
      expect(crest).toBeGreaterThan(0.99);
      expect(main).toBeLessThanOrEqual(0.75 + 1e-9);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});

describe('W-080 drift gaps are reachable in a storm', () => {
  it('an off-line row leaves its gap 12–18 m from the line (round 3: up to 22)', () => {
    expect(DRIFT.gapOffset).toEqual([14, 18]);
    let off = 0;
    for (const seed of ['W3H-01', 'W3H-02', 'W3H-03', 'W3H-04']) {
      const c = makeCourse('custom', 'standard', { biome: 'whiteout', customText: seed, difficulty: 'normal' });
      const m = buildMountain(c);
      const env = new BiomeEnvironment(m, worldSeed(c), { difficulty: 'normal' });
      env.hazards.ensure(0, m.finishZ);
      for (const h of env.hazards.near(0, m.finishZ / 2, 1e6, [])) {
        const p = h.params as DriftParams;
        if (h.kind !== 'wind-drift' || !p.lead || p.gapX === undefined || p.lineX === undefined) continue;
        const d = Math.abs(p.gapX - p.lineX);
        if (d < 0.5) continue;
        off++;
        expect(d).toBeGreaterThanOrEqual(12 - 1e-9);
        expect(d).toBeLessThanOrEqual(18 + 1e-9);
      }
    }
    expect(off).toBeGreaterThan(10);
  });
});

describe('W-079 Alpine pace', () => {
  it('Alpine encounters run at ×1.05 (round 3: ×1.10); Fjord and Whiteout at ×1', () => {
    for (const [b, p] of [['alpine', 1.05], ['fjord', 1], ['whiteout', 1]] as const) {
      const m = buildMountain(makeCourse('classic', 'standard', { biome: b, difficulty: 'normal' }));
      expect(m.profile.encounters(0, m.finishZ)[0]!.speedMul).toBeCloseTo(p, 6);
    }
  });
});
